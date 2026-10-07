"""Business rules shared by the views and build.py: offers, stock, sales figures."""
from datetime import date
from decimal import Decimal

from django.db import transaction
from django.db.models import DecimalField, ExpressionWrapper, F, Sum
from django.utils import timezone

from shop.models import Product

from .models import (ZERO, Article, Expense, OfferItem, PurchaseOrder, Quote, QuoteLine, StockMovement,
                     article_for)

MONTHS_FR = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."]


# ---------------------------------------------------------------- offers
def sync_offers(today=None):
    """Put running offers' prices on the catalog and restore the others.

    While an offer runs, Product.price is the offer price and Product.old_price the
    usual one, so the public site shows the usual price struck through.
    """
    today = today or timezone.localdate()
    changed = 0
    for item in OfferItem.objects.select_related("offer", "product"):
        product = item.product
        if item.offer.is_running(today) and not item.applied:
            item.original_price, item.applied = product.price, True
            product.old_price, product.price = product.price, item.offer_price
        elif not item.offer.is_running(today) and item.applied:
            product.price, product.old_price = item.original_price, None
            item.applied = False
        else:
            continue
        product.save(update_fields=["price", "old_price"])
        item.save(update_fields=["original_price", "applied"])
        changed += 1
    return changed


def restore_offer(offer):
    for item in offer.items.filter(applied=True).select_related("product"):
        item.product.price, item.product.old_price = item.original_price, None
        item.product.save(update_fields=["price", "old_price"])
        item.applied = False
        item.save(update_fields=["applied"])


# ---------------------------------------------------------------- stock
def _stock_lines(quote):
    """(product, quantity) taken from the warehouse by a devis; packs give their parts."""
    for line in quote.lines.select_related("product"):
        product = line.product
        if not product:
            continue
        if product.kind == Product.KIND_PRODUCT:
            yield product, line.quantity
        elif product.kind == Product.KIND_PACK:
            for item in product.pack_items.select_related("component"):
                yield item.component, item.quantity * line.quantity


@transaction.atomic
def set_quote_status(quote, status):
    """Change a devis status. 'Réalisé' takes the goods out of stock; leaving it puts them back."""
    if status == Quote.DONE and not quote.stock_done:
        for product, qty in _stock_lines(quote):
            StockMovement.objects.create(product=product, kind="sortie", quantity=-qty,
                                         reason=f"Devis {quote.number} · {quote.customer}", quote=quote)
        quote.stock_done = True
        quote.done_date = quote.done_date or timezone.localdate()
    elif status != Quote.DONE and quote.stock_done:
        for product, qty in _stock_lines(quote):
            StockMovement.objects.create(product=product, kind="entree", quantity=qty,
                                         reason=f"Annulation réalisation devis {quote.number}", quote=quote)
        quote.stock_done = False
        quote.done_date = None
    quote.status = status
    quote.save()


@transaction.atomic
def receive_order(order):
    """Goods of a purchase order arrive: stock goes up, buying prices and costs are recorded."""
    if order.status == PurchaseOrder.RECEIVED:
        return
    for line in order.lines.select_related("product"):
        StockMovement.objects.create(product=line.product, kind="entree", quantity=line.quantity,
                                     reason=f"Réception {order.number} · {order.supplier}", purchase_order=order)
        article = article_for(line.product)
        article.cost_price = line.unit_cost
        if not article.supplier_id:
            article.supplier = order.supplier
        article.save()
    order.status, order.received_date = PurchaseOrder.RECEIVED, timezone.localdate()
    order.save()
    Expense.objects.update_or_create(purchase_order=order, defaults={
        "date": order.received_date, "category": Expense.PURCHASES, "supplier": order.supplier,
        "label": f"Bon de commande {order.number}", "amount": order.total,
    })


def ensure_articles():
    """Every catalog item gets its stock / cost record."""
    missing = Product.objects.filter(article__isnull=True)
    Article.objects.bulk_create([Article(product=p) for p in missing])


def stock_value():
    value = (Article.objects.filter(product__kind=Product.KIND_PRODUCT, stock__gt=0)
             .aggregate(v=Sum(F("stock") * F("cost_price"), output_field=DecimalField()))["v"])
    return value or ZERO


def low_stock():
    return (Article.objects.filter(product__kind=Product.KIND_PRODUCT, product__active=True,
                                   stock__lte=F("min_stock"))
            .select_related("product", "supplier").order_by("stock"))


# ---------------------------------------------------------------- sales figures
def month_start(d=None, shift=0):
    d = d or timezone.localdate()
    m = d.month - 1 + shift
    return date(d.year + m // 12, m % 12 + 1, 1)


def done_quotes(start=None, end=None):
    qs = Quote.objects.filter(status=Quote.DONE)
    if start:
        qs = qs.filter(done_date__gte=start)
    if end:
        qs = qs.filter(done_date__lt=end)
    return qs.prefetch_related("lines")


def revenue(start=None, end=None):
    return sum((q.total_ht for q in done_quotes(start, end)), ZERO)


def costs(start=None, end=None):
    qs = Expense.objects.all()
    if start:
        qs = qs.filter(date__gte=start)
    if end:
        qs = qs.filter(date__lt=end)
    return qs.aggregate(t=Sum("amount"))["t"] or ZERO


def monthly(n=6):
    """Revenue and costs for the last n months, oldest first."""
    rows = []
    for shift in range(-(n - 1), 1):
        start, end = month_start(shift=shift), month_start(shift=shift + 1)
        rows.append({"label": f"{MONTHS_FR[start.month - 1]} {str(start.year)[2:]}",
                     "revenue": revenue(start, end), "costs": costs(start, end)})
    return rows


def best_sellers(kind, start=None, limit=5):
    """Products (or packs) sold in devis marked 'Réalisé', by quantity."""
    qs = QuoteLine.objects.filter(quote__status=Quote.DONE, product__kind=kind)
    if start:
        qs = qs.filter(quote__done_date__gte=start)
    amount = ExpressionWrapper(F("quantity") * F("unit_price"), output_field=DecimalField())
    return list(qs.values("product__id", "product__name_fr", "product__price")
                .annotate(qty=Sum("quantity"), amount=Sum(amount)).order_by("-qty", "-amount")[:limit])


def pct(part, whole):
    return round(Decimal(part) * 100 / Decimal(whole)) if whole else 0


def trend(now, before):
    """'+12 % vs mois dernier' style comparison."""
    if not before:
        return ""
    change = round((Decimal(now) - Decimal(before)) * 100 / abs(Decimal(before)))
    return f"{'+' if change >= 0 else ''}{change} % vs mois dernier"

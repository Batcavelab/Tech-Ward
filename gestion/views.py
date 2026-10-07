"""Tech-Ward back office (runs on the PC only, at http://127.0.0.1:8000/gestion/)."""
import os
import re
import subprocess
import sys
from urllib.parse import quote as urlquote

from django.conf import settings
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.core.mail import EmailMessage
from django.db import transaction
from django.db.models import Count, F, Max, Q, Sum
from django.http import HttpResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.utils import timezone
from django.views.decorators.http import require_POST

from shop.models import Category, Product

from . import pdf
from .forms import (ArticleForm, CustomerForm, ExpenseForm, OfferForm, OfferItemFormSet, PackItemFormSet,
                    ProductForm, PurchaseLineFormSet, PurchaseOrderForm, QuoteForm, QuoteLineFormSet,
                    SiteSettingsForm, StockAdjustForm, SupplierForm)
from .models import (ZERO, Article, Customer, Expense, Offer, PurchaseOrder, Quote, QuoteLine, SiteSettings,
                     StockMovement,
                     Supplier, article_for, unit_cost)
from .services import (best_sellers, costs, done_quotes, ensure_articles, low_stock, month_start, monthly, pct,
                       receive_order, restore_offer, revenue, set_quote_status, stock_value, sync_offers, trend)
from .templatetags.gestion import mad


def kpi(label, value, sub="", tone=""):
    return {"label": label, "value": value, "sub": sub, "tone": tone}


def _search(qs, request, *fields):
    q = request.GET.get("q", "").strip()
    if q:
        cond = Q()
        for f in fields:
            cond |= Q(**{f"{f}__icontains": q})
        qs = qs.filter(cond)
    return qs, q


# ====================================================================== dashboard
@login_required
def dashboard(request):
    sync_offers()
    ensure_articles()
    this, last, nxt = month_start(), month_start(shift=-1), month_start(shift=1)
    rev, rev_last = revenue(this, nxt), revenue(last, this)
    cost = costs(this, nxt)
    pending = Quote.objects.filter(status__in=[Quote.SENT, Quote.ACCEPTED]).prefetch_related("lines")
    lows = low_stock()
    months = monthly(6)
    top_packs = best_sellers(Product.KIND_PACK)
    top_products = best_sellers(Product.KIND_PRODUCT)
    return render(request, "gestion/dashboard.html", {
        "section": "dashboard",
        "kpis": [
            kpi("Chiffre d'affaires du mois", mad(rev), trend(rev, rev_last) or "Devis réalisés ce mois"),
            kpi("Bénéfice du mois", mad(rev - cost), f"Dépenses : {mad(cost)}",
                "good" if rev - cost >= 0 else "bad"),
            kpi("Devis en attente", pending.count(), f"{mad(sum((q.total_ttc for q in pending), ZERO))} à confirmer"),
            kpi("Valeur du stock", mad(stock_value()), "Au prix d'achat"),
            kpi("À réapprovisionner", lows.count(), "Produits sous le seuil d'alerte", "warn" if lows else ""),
        ],
        "best_pack": top_packs[0] if top_packs else None,
        "best_product": top_products[0] if top_products else None,
        "top_products": top_products, "top_packs": top_packs,
        "chart": chart(months),
        "recent_quotes": Quote.objects.select_related("customer").prefetch_related("lines")[:6],
        "lows": lows[:6],
        "offers": [o for o in Offer.objects.prefetch_related("items") if o.is_running()],
        "open_orders": PurchaseOrder.objects.filter(status=PurchaseOrder.SENT).select_related("supplier")[:5],
    })


def chart(rows, height=200, width=600):
    """Grouped bars (revenue vs costs) drawn as SVG coordinates for the template."""
    top = max([max(r["revenue"], r["costs"]) for r in rows] + [1])
    step = 10 ** (len(str(int(top))) - 1)
    top = ((int(top) // step) + 1) * step
    slot = width / len(rows)
    bars = []
    for i, r in enumerate(rows):
        x = i * slot
        for j, key in enumerate(["revenue", "costs"]):
            h = float(r[key]) / top * height
            bars.append({"x": f"{x + slot * (0.2 + 0.31 * j):.2f}", "w": f"{slot * 0.29:.2f}", "h": f"{h:.1f}",
                         "y": f"{height - h:.1f}", "cls": key, "value": mad(r[key]), "label": r["label"]})
    ticks = [{"y": f"{height - height * k / 4:.1f}", "label": f"{int(top * k / 4):,}".replace(",", " ")}
             for k in range(5)]
    return {"rows": rows, "bars": bars, "ticks": ticks, "height": height, "width": width,
            "labels": [{"x": f"{i * slot + slot / 2:.2f}", "text": r["label"]} for i, r in enumerate(rows)]}


# ====================================================================== catalog
@login_required
def products(request):
    ensure_articles()
    kind = request.GET.get("type", "")
    qs = (Product.objects.exclude(kind=Product.KIND_PACK).select_related("category", "article", "article__supplier")
          .order_by("kind", "category__order", "order", "name_fr"))
    if kind in (Product.KIND_PRODUCT, Product.KIND_SERVICE):
        qs = qs.filter(kind=kind)
    cat = request.GET.get("cat", "")
    if cat:
        qs = qs.filter(category__slug=cat)
    qs, q = _search(qs, request, "name_fr", "name_ar", "brand", "article__sku")
    rows = []
    for p in qs:
        cost = p.article.cost_price
        rows.append({"p": p, "a": p.article, "margin": (p.price - cost) if p.price and cost else None,
                     "margin_pct": pct(p.price - cost, p.price) if p.price and cost else None})
    all_items = Product.objects.exclude(kind=Product.KIND_PACK)
    priced = [r for r in rows if r["margin_pct"] is not None]
    return render(request, "gestion/products.html", {
        "section": "products", "rows": rows, "q": q, "kind": kind, "cat": cat,
        "categories": Category.objects.all(),
        "kpis": [
            kpi("Articles en ligne", all_items.filter(active=True).count(), f"{all_items.count()} au total"),
            kpi("Produits", all_items.filter(kind=Product.KIND_PRODUCT).count(),
                f"{all_items.filter(kind=Product.KIND_SERVICE).count()} services"),
            kpi("Sur devis", all_items.filter(price__isnull=True).count(), "Sans prix affiché"),
            kpi("Marge moyenne", f"{round(sum(r['margin_pct'] for r in priced) / len(priced)) if priced else 0} %",
                "Sur les articles avec prix d'achat"),
            kpi("En promotion", all_items.filter(old_price__isnull=False).count(), "Prix barré sur le site"),
        ],
    })


def _product_edit(request, pk, kind, template, section, list_url):
    product = get_object_or_404(Product, pk=pk) if pk else None
    if product:
        kind = product.kind
    article = article_for(product) if product else Article()
    is_pack = kind == Product.KIND_PACK
    if request.method == "POST":
        form = ProductForm(request.POST, request.FILES, instance=product, kind=kind)
        aform = ArticleForm(request.POST, instance=article)
        items = PackItemFormSet(request.POST, instance=product or Product()) if is_pack else None
        if form.is_valid() and aform.is_valid() and (items is None or items.is_valid()):
            with transaction.atomic():
                product = form.save()
                article = aform.save(commit=False)
                article.product = product
                article.save()
                if items is not None:
                    items.instance = product
                    items.save()
            messages.success(request, f"« {product.name_fr} » enregistré. Il sera sur le site après « Publier ».")
            return redirect(list_url)
    else:
        form = ProductForm(instance=product, kind=kind)
        aform = ArticleForm(instance=article)
        items = PackItemFormSet(instance=product or Product()) if is_pack else None
    stats = {}
    if product:
        sold = QuoteLine.objects.filter(product=product, quote__status=Quote.DONE)
        stats = {"sold": sold.aggregate(n=Sum("quantity"))["n"] or 0,
                 "cost": unit_cost(product), "movements": product.stock_movements.all()[:8]}
    return render(request, template, {"section": section, "form": form, "aform": aform, "items": items,
                                      "product": product, "kind": kind, "stats": stats})


@login_required
def product_edit(request, pk=None):
    kind = Product.KIND_SERVICE if request.GET.get("type") == Product.KIND_SERVICE else Product.KIND_PRODUCT
    return _product_edit(request, pk, kind, "gestion/product_form.html", "products", "gestion:products")


@login_required
@require_POST
def product_delete(request, pk):
    product = get_object_or_404(Product, pk=pk)
    used = product.quote_lines.exists() or product.purchase_lines.exists() or product.in_packs.exists()
    if used:
        product.active = False
        product.save(update_fields=["active"])
        messages.info(request, f"« {product} » est utilisé dans des devis, packs ou commandes : il est masqué du site.")
    else:
        product.delete()
        messages.success(request, f"« {product} » supprimé.")
    return redirect("gestion:packs" if product.kind == Product.KIND_PACK else "gestion:products")


# ====================================================================== packs
@login_required
def packs(request):
    ensure_articles()
    rows = []
    sold = {r["product__id"]: r for r in best_sellers(Product.KIND_PACK, limit=100)}
    for p in Product.objects.filter(kind=Product.KIND_PACK).prefetch_related("pack_items__component"):
        cost = unit_cost(p)
        rows.append({"p": p, "cost": cost, "items": p.pack_items.all(),
                     "margin_pct": pct(p.price - cost, p.price) if p.price else None,
                     "sold": sold.get(p.pk, {}).get("qty", 0)})
    best = max(rows, key=lambda r: r["sold"], default=None)
    priced = [r["margin_pct"] for r in rows if r["margin_pct"] is not None]
    return render(request, "gestion/packs.html", {
        "section": "packs", "rows": rows,
        "kpis": [
            kpi("Packs", len(rows), f"{sum(r['p'].active for r in rows)} visibles sur le site"),
            kpi("Pack le plus vendu", best["p"].name_fr if best and best["sold"] else "—",
                f"{best['sold']} vendu(s)" if best and best["sold"] else "Aucune vente réalisée"),
            kpi("Packs vendus", sum(r["sold"] for r in rows), "Devis réalisés"),
            kpi("Marge moyenne", f"{round(sum(priced) / len(priced)) if priced else 0} %", "Prix vs matériel + pose"),
        ],
    })


@login_required
def pack_edit(request, pk=None):
    return _product_edit(request, pk, Product.KIND_PACK, "gestion/pack_form.html", "packs", "gestion:packs")


# ====================================================================== offers
@login_required
def offers(request):
    sync_offers()
    all_offers = list(Offer.objects.prefetch_related("items__product"))
    running = [o for o in all_offers if o.is_running()]
    today = timezone.localdate()
    ending = [o for o in running if o.end_date and (o.end_date - today).days <= 7]
    promo_sales = QuoteLine.objects.filter(quote__status=Quote.DONE, product__offer_items__offer__in=running,
                                           quote__date__gte=min((o.start_date for o in running), default=today))
    return render(request, "gestion/offers.html", {
        "section": "offers", "offers": all_offers, "today": today,
        "kpis": [
            kpi("Offres en cours", len(running), f"{len(all_offers)} au total"),
            kpi("Articles en promo", sum(o.items.count() for o in running), "Prix barré sur le site"),
            kpi("Se terminent sous 7 jours", len(ending), ", ".join(o.name for o in ending)[:60], "warn" if ending else ""),
            kpi("Ventes en promo", promo_sales.aggregate(n=Sum("quantity"))["n"] or 0, "Unités vendues pendant les offres en cours"),
        ],
    })


@login_required
def offer_edit(request, pk=None):
    offer = get_object_or_404(Offer, pk=pk) if pk else Offer()
    if request.method == "POST":
        form = OfferForm(request.POST, instance=offer)
        items = OfferItemFormSet(request.POST, instance=offer)
        if form.is_valid() and items.is_valid():
            with transaction.atomic():
                if offer.pk:
                    restore_offer(offer)
                offer = form.save()
                items.instance = offer
                items.save()
                sync_offers()
            messages.success(request, f"Offre « {offer} » enregistrée. Publiez le site pour l'afficher en ligne.")
            return redirect("gestion:offers")
    else:
        form, items = OfferForm(instance=offer), OfferItemFormSet(instance=offer)
    return render(request, "gestion/offer_form.html", {"section": "offers", "form": form, "items": items,
                                                       "offer": offer if offer.pk else None})


@login_required
@require_POST
def offer_delete(request, pk):
    offer = get_object_or_404(Offer, pk=pk)
    restore_offer(offer)
    offer.delete()
    messages.success(request, "Offre supprimée, les prix habituels sont rétablis.")
    return redirect("gestion:offers")


# ====================================================================== customers
@login_required
def customers(request):
    qs = Customer.objects.annotate(n_quotes=Count("quotes"), last_quote=Max("quotes__date"))
    qs, q = _search(qs, request, "name", "phone", "email", "city")
    spent = {}
    for quote in done_quotes():
        spent[quote.customer_id] = spent.get(quote.customer_id, ZERO) + quote.total_ttc
    rows = [{"c": c, "spent": spent.get(c.pk, ZERO)} for c in qs]
    top = max(spent.items(), key=lambda kv: kv[1], default=None)
    buyers = len(spent)
    total = Customer.objects.count()
    return render(request, "gestion/customers.html", {
        "section": "customers", "rows": rows, "q": q,
        "kpis": [
            kpi("Clients", total, f"{Customer.objects.filter(created_at__date__gte=month_start()).count()} nouveaux ce mois"),
            kpi("Clients ayant acheté", buyers, f"{pct(buyers, total)} % des clients"),
            kpi("Panier moyen", mad(sum(spent.values(), ZERO) / buyers if buyers else 0), "Par client acheteur"),
            kpi("Meilleur client", Customer.objects.get(pk=top[0]).name if top else "—", mad(top[1]) if top else ""),
        ],
    })


@login_required
def customer_edit(request, pk=None):
    customer = get_object_or_404(Customer, pk=pk) if pk else Customer()
    form = CustomerForm(request.POST or None, instance=customer)
    if request.method == "POST" and form.is_valid():
        customer = form.save()
        messages.success(request, f"Client « {customer} » enregistré.")
        if request.GET.get("next") == "devis":
            return redirect(f"/gestion/devis/nouveau/?client={customer.pk}")
        return redirect("gestion:customer", pk=customer.pk)
    quotes = customer.quotes.prefetch_related("lines") if customer.pk else []
    done = [q for q in quotes if q.status == Quote.DONE]
    return render(request, "gestion/customer_form.html", {
        "section": "customers", "form": form, "customer": customer if customer.pk else None, "quotes": quotes,
        "kpis": [
            kpi("Devis", len(quotes), f"{len(done)} réalisés"),
            kpi("Total acheté", mad(sum((q.total_ttc for q in done), ZERO)), ""),
            kpi("En attente", mad(sum((q.total_ttc for q in quotes if q.status in (Quote.SENT, Quote.ACCEPTED)), ZERO)), ""),
        ] if customer.pk else [],
    })


# ====================================================================== website basics
@login_required
def site_settings(request):
    from .site import DEFAULTS, apply_site_settings
    site = SiteSettings.load()
    form = SiteSettingsForm(request.POST or None, request.FILES or None, instance=site)
    if request.method == "POST" and form.is_valid():
        form.save()
        apply_site_settings()
        messages.success(request, "Réglages enregistrés. Publiez le site pour les mettre en ligne.")
        return redirect("gestion:site")
    tw = settings.TECHWARD
    return render(request, "gestion/site.html", {
        "section": "site", "form": form, "site": site, "defaults": DEFAULTS,
        "kpis": [
            kpi("Téléphone", tw["phone_display"], f"WhatsApp {tw['whatsapp']}"),
            kpi("Email", tw["email"], ""),
            kpi("Bannière", "Personnalisée" if (site.hero_image or site.hero_title_fr or site.hero_text_fr) else "Par défaut",
                f"Modifiée le {timezone.localtime(site.updated_at):%d/%m/%Y}" if site.updated_at else ""),
        ],
    })


# ====================================================================== suppliers
@login_required
def suppliers(request):
    qs = Supplier.objects.annotate(n_orders=Count("orders", distinct=True), n_articles=Count("articles", distinct=True))
    qs, q = _search(qs, request, "name", "contact_name", "phone", "city", "brands")
    bought = {}
    for e in Expense.objects.filter(supplier__isnull=False).values("supplier").annotate(t=Sum("amount")):
        bought[e["supplier"]] = e["t"]
    rows = [{"s": s, "bought": bought.get(s.pk, ZERO)} for s in qs]
    month_buys = Expense.objects.filter(category=Expense.PURCHASES, date__gte=month_start()).aggregate(t=Sum("amount"))["t"]
    open_orders = PurchaseOrder.objects.filter(status=PurchaseOrder.SENT)
    top = max(bought.items(), key=lambda kv: kv[1], default=None)
    return render(request, "gestion/suppliers.html", {
        "section": "suppliers", "rows": rows, "q": q,
        "kpis": [
            kpi("Fournisseurs", Supplier.objects.count(), ""),
            kpi("Achats du mois", mad(month_buys or 0), "Bons de commande reçus"),
            kpi("Commandes en cours", open_orders.count(),
                mad(sum((o.total for o in open_orders.prefetch_related("lines")), ZERO))),
            kpi("Fournisseur principal", Supplier.objects.get(pk=top[0]).name if top else "—", mad(top[1]) if top else ""),
        ],
    })


@login_required
def supplier_edit(request, pk=None):
    supplier = get_object_or_404(Supplier, pk=pk) if pk else Supplier()
    form = SupplierForm(request.POST or None, instance=supplier)
    if request.method == "POST" and form.is_valid():
        supplier = form.save()
        messages.success(request, f"Fournisseur « {supplier} » enregistré.")
        return redirect("gestion:supplier", pk=supplier.pk)
    orders = supplier.orders.prefetch_related("lines") if supplier.pk else []
    return render(request, "gestion/supplier_form.html", {
        "section": "suppliers", "form": form, "supplier": supplier if supplier.pk else None, "orders": orders,
        "articles": supplier.articles.select_related("product") if supplier.pk else [],
    })


# ====================================================================== devis
@login_required
def quotes(request):
    qs = Quote.objects.select_related("customer").prefetch_related("lines")
    status = request.GET.get("statut", "")
    if status:
        qs = qs.filter(status=status)
    qs, q = _search(qs, request, "number", "customer__name", "customer__phone")
    this = month_start()
    month = Quote.objects.filter(date__gte=this).prefetch_related("lines")
    decided = Quote.objects.filter(status__in=[Quote.ACCEPTED, Quote.DONE, Quote.REFUSED]).count()
    won = Quote.objects.filter(status__in=[Quote.ACCEPTED, Quote.DONE]).count()
    pending = Quote.objects.filter(status__in=[Quote.SENT, Quote.ACCEPTED]).prefetch_related("lines")
    return render(request, "gestion/quotes.html", {
        "section": "quotes", "quotes": qs, "q": q, "status": status, "statuses": Quote.STATUSES,
        "kpis": [
            kpi("Devis ce mois", month.count(), mad(sum((x.total_ttc for x in month), ZERO))),
            kpi("En attente de réponse", pending.count(), mad(sum((x.total_ttc for x in pending), ZERO))),
            kpi("Taux d'acceptation", f"{pct(won, decided)} %", f"{won} acceptés sur {decided} décidés"),
            kpi("Réalisés ce mois", done_quotes(this).count(), mad(revenue(this))),
            kpi("Brouillons", Quote.objects.filter(status=Quote.DRAFT).count(), "À envoyer"),
        ],
    })


def _price_data():
    return {p.pk: {"price": float(p.price) if p.price is not None else "", "name": p.name_fr}
            for p in Product.objects.all()}


@login_required
def quote_edit(request, pk=None):
    quote = get_object_or_404(Quote, pk=pk) if pk else Quote()
    if request.method == "POST":
        form = QuoteForm(request.POST, instance=quote)
        lines = QuoteLineFormSet(request.POST, instance=quote)
        if form.is_valid() and lines.is_valid():
            with transaction.atomic():
                redo_stock = quote.stock_done  # a finished devis: put its goods back, then take the new ones
                if redo_stock:
                    set_quote_status(quote, Quote.ACCEPTED)
                quote = form.save()
                lines.instance = quote
                lines.save()
                if redo_stock:
                    set_quote_status(quote, Quote.DONE)
            messages.success(request, f"Devis {quote.number} enregistré.")
            return redirect("gestion:quote", pk=quote.pk)
    else:
        initial = {}
        if request.GET.get("client"):
            initial["customer"] = request.GET["client"]
        form, lines = QuoteForm(instance=quote, initial=initial), QuoteLineFormSet(instance=quote)
    return render(request, "gestion/quote_form.html", {"section": "quotes", "form": form, "lines": lines,
                                                       "quote": quote if quote.pk else None,
                                                       "prices": _price_data()})


def _wa_number(phone):
    digits = re.sub(r"\D", "", phone or "")
    if digits.startswith("00"):
        digits = digits[2:]
    if digits.startswith("0"):
        digits = "212" + digits[1:]
    return digits


@login_required
def quote_detail(request, pk):
    quote = get_object_or_404(Quote.objects.select_related("customer"), pk=pk)
    c = quote.customer
    text = (f"Bonjour {c.name},\n\nVoici votre devis Tech-Ward N° {quote.number} d'un montant de "
            f"{mad(quote.total_ttc)}, valable jusqu'au {quote.valid_until:%d/%m/%Y}.\n"
            f"Le devis détaillé (PDF) est joint à ce message.\n\n"
            f"Paiement en espèces à la confirmation. N'hésitez pas à nous écrire pour toute question.\n"
            f"Tech-Ward · {settings.TECHWARD['phone_display']}")
    return render(request, "gestion/quote_detail.html", {
        "section": "quotes", "quote": quote, "lines": quote.lines.select_related("product"),
        "statuses": Quote.STATUSES, "wa_url": f"https://wa.me/{_wa_number(c.phone)}?text={urlquote(text)}",
        "mail_url": f"mailto:{c.email}?subject={urlquote(f'Devis Tech-Ward {quote.number}')}&body={urlquote(text)}",
        "can_email": bool(settings.EMAIL_HOST_PASSWORD), "movements": quote.movements.select_related("product"),
    })


@login_required
def quote_pdf(request, pk):
    quote = get_object_or_404(Quote, pk=pk)
    response = HttpResponse(pdf.quote_pdf(quote), content_type="application/pdf")
    disposition = "attachment" if request.GET.get("dl") else "inline"
    response["Content-Disposition"] = f'{disposition}; filename="Devis-{quote.number}.pdf"'
    return response


@login_required
@require_POST
def quote_status(request, pk):
    quote = get_object_or_404(Quote, pk=pk)
    status = request.POST.get("status")
    if status in dict(Quote.STATUSES):
        set_quote_status(quote, status)
        note = " Le matériel est sorti du stock." if status == Quote.DONE else ""
        messages.success(request, f"Devis {quote.number} : {quote.get_status_display()}.{note}")
    return redirect("gestion:quote", pk=quote.pk)


@login_required
@require_POST
def quote_sent(request, pk):
    """WhatsApp button: mark the devis as sent, then open WhatsApp."""
    quote = get_object_or_404(Quote, pk=pk)
    if quote.status == Quote.DRAFT:
        set_quote_status(quote, Quote.SENT)
    return redirect(request.POST["url"])


def _send_mail(request, to, subject, body, filename, content):
    if not to:
        messages.error(request, "Ajoutez d'abord une adresse email sur la fiche.")
        return False
    mail = EmailMessage(subject, body, settings.DEFAULT_FROM_EMAIL, [to], reply_to=[settings.TECHWARD["email"]])
    mail.attach(filename, content, "application/pdf")
    try:
        mail.send()
    except Exception as exc:  # network, wrong password...
        messages.error(request, f"L'email n'est pas parti : {exc}")
        return False
    messages.success(request, f"Envoyé à {to} avec le PDF en pièce jointe.")
    return True


@login_required
@require_POST
def quote_email(request, pk):
    quote = get_object_or_404(Quote.objects.select_related("customer"), pk=pk)
    body = (f"Bonjour {quote.customer.name},\n\nVeuillez trouver ci-joint notre devis N° {quote.number} "
            f"d'un montant de {mad(quote.total_ttc)}, valable jusqu'au {quote.valid_until:%d/%m/%Y}.\n\n"
            f"Paiement en espèces à la confirmation du devis.\n\nCordialement,\nTech-Ward\n"
            f"{settings.TECHWARD['phone_display']}")
    if _send_mail(request, quote.customer.email, f"Devis Tech-Ward {quote.number}", body,
                  f"Devis-{quote.number}.pdf", pdf.quote_pdf(quote)) and quote.status == Quote.DRAFT:
        set_quote_status(quote, Quote.SENT)
    return redirect("gestion:quote", pk=quote.pk)


@login_required
@require_POST
def quote_duplicate(request, pk):
    source = get_object_or_404(Quote, pk=pk)
    copy = Quote.objects.create(customer=source.customer, discount=source.discount, tva_rate=source.tva_rate,
                                notes=source.notes)
    for line in source.lines.all():
        QuoteLine.objects.create(quote=copy, product=line.product, description=line.description,
                                 quantity=line.quantity, unit_price=line.unit_price)
    messages.success(request, f"Copie créée : {copy.number}.")
    return redirect("gestion:quote_edit", pk=copy.pk)


# ====================================================================== purchase orders
@login_required
def orders(request):
    qs = PurchaseOrder.objects.select_related("supplier").prefetch_related("lines")
    status = request.GET.get("statut", "")
    if status:
        qs = qs.filter(status=status)
    qs, q = _search(qs, request, "number", "supplier__name")
    open_orders = PurchaseOrder.objects.filter(status=PurchaseOrder.SENT).prefetch_related("lines")
    received = PurchaseOrder.objects.filter(status=PurchaseOrder.RECEIVED, received_date__gte=month_start())
    late = open_orders.filter(expected_date__lt=timezone.localdate())
    return render(request, "gestion/orders.html", {
        "section": "orders", "orders": qs, "q": q, "status": status, "statuses": PurchaseOrder.STATUSES,
        "kpis": [
            kpi("Commandes en cours", open_orders.count(), mad(sum((o.total for o in open_orders), ZERO))),
            kpi("En retard", late.count(), "Date de livraison dépassée", "warn" if late.exists() else ""),
            kpi("Reçues ce mois", received.count(), mad(sum((o.total for o in received.prefetch_related("lines")), ZERO))),
            kpi("Brouillons", PurchaseOrder.objects.filter(status=PurchaseOrder.DRAFT).count(), "À envoyer"),
        ],
    })


@login_required
def order_edit(request, pk=None):
    order = get_object_or_404(PurchaseOrder, pk=pk) if pk else PurchaseOrder()
    if order.status == PurchaseOrder.RECEIVED:
        messages.info(request, "Ce bon de commande est déjà reçu : il ne peut plus être modifié.")
        return redirect("gestion:order", pk=order.pk)
    if request.method == "POST":
        form = PurchaseOrderForm(request.POST, instance=order)
        lines = PurchaseLineFormSet(request.POST, instance=order)
        if form.is_valid() and lines.is_valid():
            with transaction.atomic():
                order = form.save()
                lines.instance = order
                lines.save()
            messages.success(request, f"Bon de commande {order.number} enregistré.")
            return redirect("gestion:order", pk=order.pk)
    else:
        initial = {}
        if request.GET.get("fournisseur"):
            initial["supplier"] = request.GET["fournisseur"]
        form, lines = PurchaseOrderForm(instance=order, initial=initial), PurchaseLineFormSet(instance=order)
        if not order.pk and request.GET.get("reappro"):
            # Pre-fill with every product under its alert level.
            lows = low_stock()
            if request.GET.get("fournisseur"):
                lows = lows.filter(supplier_id=request.GET["fournisseur"])
            data = [{"product": a.product_id, "quantity": max(a.min_stock * 2 - a.stock, 1),
                     "unit_cost": a.cost_price} for a in lows]
            PurchaseLineFormSet.extra = max(len(data), 4)
            lines = PurchaseLineFormSet(instance=order, initial=data)
            PurchaseLineFormSet.extra = 4
    costs_data = {a.product_id: float(a.cost_price) for a in Article.objects.all()}
    return render(request, "gestion/order_form.html", {"section": "orders", "form": form, "lines": lines,
                                                       "order": order if order.pk else None, "costs": costs_data})


@login_required
def order_detail(request, pk):
    order = get_object_or_404(PurchaseOrder.objects.select_related("supplier"), pk=pk)
    s = order.supplier
    items = "\n".join(f"- {line.quantity} × {line.product.name_fr}" for line in order.lines.select_related("product"))
    text = (f"Bonjour {s.contact_name or s.name},\n\nVoici notre bon de commande N° {order.number} :\n{items}\n\n"
            f"Total : {mad(order.total)}. Le bon de commande (PDF) est joint.\n"
            f"Merci de confirmer la disponibilité et le délai de livraison.\n\nTech-Ward · {settings.TECHWARD['phone_display']}")
    return render(request, "gestion/order_detail.html", {
        "section": "orders", "order": order, "lines": order.lines.select_related("product"),
        "wa_url": f"https://wa.me/{_wa_number(s.phone)}?text={urlquote(text)}",
        "mail_url": f"mailto:{s.email}?subject={urlquote(f'Bon de commande Tech-Ward {order.number}')}&body={urlquote(text)}",
        "can_email": bool(settings.EMAIL_HOST_PASSWORD),
    })


@login_required
def order_pdf(request, pk):
    order = get_object_or_404(PurchaseOrder, pk=pk)
    response = HttpResponse(pdf.order_pdf(order), content_type="application/pdf")
    disposition = "attachment" if request.GET.get("dl") else "inline"
    response["Content-Disposition"] = f'{disposition}; filename="BC-{order.number}.pdf"'
    return response


@login_required
@require_POST
def order_status(request, pk):
    order = get_object_or_404(PurchaseOrder, pk=pk)
    status = request.POST.get("status")
    if status == PurchaseOrder.RECEIVED:
        receive_order(order)
        messages.success(request, f"{order.number} reçu : stock, prix d'achat et dépenses mis à jour.")
    elif status in (PurchaseOrder.SENT, PurchaseOrder.CANCELLED, PurchaseOrder.DRAFT) and order.status != PurchaseOrder.RECEIVED:
        order.status = status
        order.save()
        messages.success(request, f"{order.number} : {order.get_status_display()}.")
    if request.POST.get("url"):
        return redirect(request.POST["url"])
    return redirect("gestion:order", pk=order.pk)


@login_required
@require_POST
def order_email(request, pk):
    order = get_object_or_404(PurchaseOrder.objects.select_related("supplier"), pk=pk)
    body = (f"Bonjour {order.supplier.contact_name or order.supplier.name},\n\nVeuillez trouver ci-joint notre bon "
            f"de commande N° {order.number}.\nMerci de nous confirmer la disponibilité et le délai de livraison."
            f"\n\nCordialement,\nTech-Ward\n{settings.TECHWARD['phone_display']}")
    if _send_mail(request, order.supplier.email, f"Bon de commande Tech-Ward {order.number}", body,
                  f"BC-{order.number}.pdf", pdf.order_pdf(order)) and order.status == PurchaseOrder.DRAFT:
        order.status = PurchaseOrder.SENT
        order.save()
    return redirect("gestion:order", pk=order.pk)


# ====================================================================== inventory
@login_required
def stock(request):
    ensure_articles()
    if request.method == "POST":
        form = StockAdjustForm(request.POST)
        if form.is_valid():
            change = form.save()
            p = form.cleaned_data["product"]
            messages.success(request, f"{p} : {'+' if change > 0 else ''}{change} → stock {article_for(p).stock}.")
            return redirect("gestion:stock")
    else:
        form = StockAdjustForm(initial={"product": request.GET.get("produit")})
    qs = (Article.objects.filter(product__kind=Product.KIND_PRODUCT).select_related("product", "product__category", "supplier")
          .annotate(value=F("stock") * F("cost_price")).order_by("product__category__order", "product__name_fr"))
    flt = request.GET.get("filtre", "")
    if flt == "alerte":
        qs = qs.filter(stock__lte=F("min_stock"))
    qs, q = _search(qs, request, "product__name_fr", "sku", "location")
    this = month_start()
    month_moves = StockMovement.objects.filter(date__date__gte=this)
    out_qty = -(month_moves.filter(quantity__lt=0).aggregate(n=Sum("quantity"))["n"] or 0)
    in_qty = month_moves.filter(quantity__gt=0).aggregate(n=Sum("quantity"))["n"] or 0
    tracked = Article.objects.filter(product__kind=Product.KIND_PRODUCT)
    return render(request, "gestion/stock.html", {
        "section": "stock", "articles": qs, "form": form, "q": q, "flt": flt,
        "movements": StockMovement.objects.select_related("product")[:15],
        "kpis": [
            kpi("Valeur du stock", mad(stock_value()), "Au prix d'achat"),
            kpi("Unités en entrepôt", tracked.filter(stock__gt=0).aggregate(n=Sum("stock"))["n"] or 0,
                f"{tracked.filter(stock__gt=0).count()} références"),
            kpi("En rupture", tracked.filter(stock__lte=0, product__active=True).count(), "Stock à zéro",
                "bad" if tracked.filter(stock__lte=0, product__active=True).exists() else ""),
            kpi("Sous le seuil", low_stock().count(), "À réapprovisionner", "warn" if low_stock().exists() else ""),
            kpi("Mouvements du mois", f"+{in_qty} / −{out_qty}", "Entrées / sorties"),
        ],
    })


# ====================================================================== finances
@login_required
def finances(request):
    if request.method == "POST":
        form = ExpenseForm(request.POST)
        if form.is_valid():
            form.save()
            messages.success(request, "Dépense ajoutée.")
            return redirect("gestion:finances")
    else:
        form = ExpenseForm()
    this, nxt = month_start(), month_start(shift=1)
    year = month_start().replace(month=1)
    rev, cost = revenue(this, nxt), costs(this, nxt)
    rev_y, cost_y = revenue(year), costs(year)
    cogs = sum((q.cost for q in done_quotes(this, nxt)), ZERO)
    months = monthly(12)
    for m in months:
        m["profit"] = m["revenue"] - m["costs"]
    cats = (Expense.objects.filter(date__gte=year).values("category").annotate(t=Sum("amount")).order_by("-t"))
    labels = dict(Expense.CATEGORIES)
    by_cat = [{"label": labels.get(c["category"], c["category"]), "total": c["t"], "pct": pct(c["t"], cost_y)}
              for c in cats]
    return render(request, "gestion/finances.html", {
        "section": "finances", "form": form, "chart": chart(months[-6:]), "months": months, "by_cat": by_cat,
        "expenses": Expense.objects.select_related("supplier")[:30],
        "kpis": [
            kpi("CA du mois", mad(rev), "Devis réalisés (HT)"),
            kpi("Dépenses du mois", mad(cost), "Achats et frais"),
            kpi("Bénéfice du mois", mad(rev - cost), f"Marge {pct(rev - cost, rev)} %" if rev else "",
                "good" if rev - cost >= 0 else "bad"),
            kpi("Marge brute du mois", mad(rev - cogs), "CA moins coût du matériel vendu"),
            kpi(f"Bénéfice {year.year}", mad(rev_y - cost_y), f"CA {mad(rev_y)} · dépenses {mad(cost_y)}",
                "good" if rev_y - cost_y >= 0 else "bad"),
        ],
    })


@login_required
def expense_edit(request, pk):
    expense = get_object_or_404(Expense, pk=pk)
    if request.method == "POST" and request.POST.get("delete"):
        expense.delete()
        messages.success(request, "Dépense supprimée.")
        return redirect("gestion:finances")
    form = ExpenseForm(request.POST or None, instance=expense)
    if request.method == "POST" and form.is_valid():
        form.save()
        messages.success(request, "Dépense modifiée.")
        return redirect("gestion:finances")
    return render(request, "gestion/expense_form.html", {"section": "finances", "form": form, "expense": expense})


# ====================================================================== publish
@login_required
def publish(request):
    output, ok = "", None
    if request.method == "POST":
        result = subprocess.run([sys.executable, str(settings.BASE_DIR / "build.py")], cwd=settings.BASE_DIR,
                                capture_output=True, text=True, encoding="utf-8", errors="replace",
                                env={**os.environ, "PYTHONIOENCODING": "utf-8"})
        output, ok = (result.stdout + result.stderr).strip(), result.returncode == 0
        if ok and request.POST.get("open") and sys.platform == "win32":
            os.startfile(settings.BUILD_DIR)  # noqa: S606 - opens the dist folder in Explorer
    changed = Product.objects.filter(active=True)
    return render(request, "gestion/publish.html", {
        "section": "publish", "output": output, "ok": ok, "dist": settings.BUILD_DIR,
        "count": changed.count(), "on_pc": sys.platform == "win32", "built": (settings.BUILD_DIR / "index.html").exists(),
    })


@login_required
def publish_zip(request):
    """The generated site as one zip, for when the back office runs online (no dist folder to drag)."""
    import io
    import zipfile
    root = settings.BUILD_DIR
    if not (root / "index.html").exists():
        messages.error(request, "Générez d'abord le site.")
        return redirect("gestion:publish")
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for path in sorted(root.rglob("*")):
            if path.is_file():
                zf.write(path, path.relative_to(root).as_posix())
    response = HttpResponse(buf.getvalue(), content_type="application/zip")
    response["Content-Disposition"] = 'attachment; filename="tech-ward-site.zip"'
    return response

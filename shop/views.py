from django.conf import settings
from django.shortcuts import get_object_or_404, render
from django.utils.translation import get_language

from .cart import whatsapp_url
from .i18n import STRINGS, t
from .models import Category, Product

# Text the browser cart needs to write the WhatsApp message (see static/js/app.js).
CART_KEYS = ["on_quote", "free", "currency", "wa_hello", "wa_total", "wa_quote_note",
             "wa_name", "wa_city", "wa_phone", "wa_notes", "wa_ref"]


def _lang():
    return (get_language() or "fr")[:2]


def _visible():
    return Product.objects.filter(active=True).select_related("category")


def home(request):
    return render(request, "shop/home.html", {
        "featured": _visible().filter(kind=Product.KIND_PRODUCT, featured=True)[:4],
        "packs": _visible().filter(kind=Product.KIND_PACK)[:4],
        "services": _visible().filter(kind=Product.KIND_SERVICE)[:4],
        "wa_visit_url": whatsapp_url(t("wa_visit", _lang())),
    })


def product_list(request, cat=""):
    """All products, a group (cameras, alarm...) or one category. Search runs in the browser."""
    products = _visible().filter(kind=Product.KIND_PRODUCT)
    current_name = ""
    if cat:
        if cat in dict(Category.GROUPS):
            products = products.filter(category__group=cat)
            current_name = t(f"grp_{cat}", _lang())
        else:
            category = get_object_or_404(Category, slug=cat)
            products = products.filter(category=category)
            current_name = category.tr("name")
    return render(request, "shop/product_list.html", {
        "products": products, "categories": Category.objects.all(),
        "current": cat, "current_name": current_name,
    })


def product_detail(request, slug):
    product = get_object_or_404(_visible(), slug=slug)
    related = _visible().filter(kind=product.kind).exclude(pk=product.pk)
    if product.category_id:
        related = related.filter(category__group=product.category.group)
    question = f"{t('wa_about', _lang())} {product.tr('name')}"
    return render(request, "shop/product_detail.html", {
        "product": product, "related": related[:4], "question_url": whatsapp_url(question),
    })


def packs(request):
    return render(request, "shop/packs.html", {"packs": _visible().filter(kind=Product.KIND_PACK)})


def security(request):
    return render(request, "shop/security.html", {
        "services": _visible().filter(kind=Product.KIND_SERVICE),
        "products": _visible().filter(kind=Product.KIND_PRODUCT,
                                      category__group__in=["alarm", "access"]),
    })


def contact(request):
    return render(request, "shop/contact.html", {"question_url": whatsapp_url(t("wa_question", _lang()))})


def cart(request):
    """The cart lives in the visitor's browser; this page ships every item it may show."""
    lang = _lang()
    return render(request, "shop/cart.html", {
        "items": _visible(),
        "cart_data": {
            "whatsapp": settings.TECHWARD["whatsapp"],
            "lang": lang,
            "t": {key: STRINGS[key][0 if lang == "fr" else 1] for key in CART_KEYS},
        },
    })

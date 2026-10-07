"""Price and WhatsApp helpers. The cart itself lives in the visitor's browser (static/js/app.js)."""
from urllib.parse import quote

from django.conf import settings

from .i18n import t


def format_mad(value, lang):
    """3499 -> '3 499 MAD' (or درهم in Arabic). Same rule as formatMad() in app.js."""
    if value is None:
        return t("on_quote", lang)
    if value == 0:
        return t("free", lang)
    number = f"{int(value):,}".replace(",", " ")
    return f"{number} {t('currency', lang)}"


def whatsapp_url(text):
    return f"https://wa.me/{settings.TECHWARD['whatsapp']}?text={quote(text)}"

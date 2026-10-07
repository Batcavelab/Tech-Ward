from django.conf import settings
from django.utils.translation import get_language

from .cart import whatsapp_url
from .i18n import t


def site(request):
    lang = (get_language() or "fr")[:2]
    return {
        "TW": settings.TECHWARD,
        "LANG": lang,
        "IS_RTL": lang == "ar",
        "wa_contact_url": whatsapp_url(t("wa_question", lang)),
    }

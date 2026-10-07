"""Website basics from Gestion → Site web, applied on top of settings.TECHWARD."""
from django.conf import settings
from django.db import DatabaseError
from django.utils.translation import get_language

DEFAULTS = dict(settings.TECHWARD)
FIELDS = ["phone_display", "whatsapp", "email", "address"]


def apply_site_settings():
    """Copy the saved contact details into settings.TECHWARD (used by the site, PDFs and WhatsApp links)."""
    from .models import SiteSettings
    try:
        site = SiteSettings.objects.filter(pk=1).first()
    except DatabaseError:  # table not created yet (before migrate)
        site = None
    for key in FIELDS:
        settings.TECHWARD[key] = (getattr(site, key, "") if site else "") or DEFAULTS[key]
    return site


class SiteSettingsMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request.site_settings = apply_site_settings()
        return self.get_response(request)


def hero(request):
    """Banner overrides for the home page: HERO.image / HERO.title / HERO.text (empty = template defaults)."""
    site = getattr(request, "site_settings", None)
    if not site:
        return {"HERO": {}}
    lang = (get_language() or "fr")[:2]
    return {"HERO": {
        "image": site.hero_image.url if site.hero_image else "",
        "title": getattr(site, f"hero_title_{lang}", "").strip(),
        "text": getattr(site, f"hero_text_{lang}", "").strip(),
    }}

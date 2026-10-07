from django import template
from django.utils.translation import get_language

from ..cart import format_mad
from ..i18n import t as translate

register = template.Library()


def _lang():
    return (get_language() or "fr")[:2]


@register.simple_tag
def t(key):
    return translate(key, _lang())


@register.filter
def tr(obj, field):
    return obj.tr(field)


@register.filter
def mad(value):
    return format_mad(value, _lang())


@register.simple_tag(takes_context=True)
def lang_url(context, code):
    """Same page in the other language: /fr/packs/ -> /ar/packs/."""
    request = context["request"]
    parts = request.path.split("/", 2)
    if len(parts) > 1 and parts[1] in ("fr", "ar"):
        parts[1] = code
        return "/".join(parts)
    return f"/{code}/"

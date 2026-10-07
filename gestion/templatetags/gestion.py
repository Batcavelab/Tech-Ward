from django import template

register = template.Library()


@register.filter
def mad(value):
    """3499.5 -> '3 499,50 MAD'. Empty -> 'Sur devis'."""
    if value is None or value == "":
        return "Sur devis"
    value = round(float(value), 2)
    whole, cents = divmod(round(abs(value) * 100), 100)
    text = f"{int(whole):,}".replace(",", " ")
    if cents:
        text += f",{int(cents):02d}"
    return f"{'-' if value < 0 else ''}{text} MAD"


@register.filter
def num(value):
    return f"{int(value or 0):,}".replace(",", " ")


@register.filter
def status_class(value):
    return {"brouillon": "grey", "envoye": "blue", "accepte": "teal", "realise": "green", "recu": "green",
            "refuse": "red", "annule": "red"}.get(value, "grey")

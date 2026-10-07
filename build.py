"""Generate the whole site as static files in dist/, ready for Netlify.

    python build.py

Pages are rendered by the Django views and templates from the catalog in
db.sqlite3 (edit it in the admin with run.bat). Upload dist/ to Netlify:
drag the folder onto https://app.netlify.com/drop, or let Netlify run this
script itself (see netlify.toml).
"""
import os
import shutil
import sys
from pathlib import Path

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "techward.settings")

import django  # noqa: E402

django.setup()

from django.conf import settings  # noqa: E402
from django.core.management import call_command  # noqa: E402
from django.test import Client  # noqa: E402

from shop.models import Category, Product  # noqa: E402

LANGS = [code for code, _ in settings.LANGUAGES]


def pages():
    paths = ["", "boutique/", "packs/", "alarme-acces/", "contact/", "panier/"]
    paths += [f"boutique/{group}/" for group, _ in Category.GROUPS]
    paths += [f"boutique/{c.slug}/" for c in Category.objects.all()]
    paths += [f"produit/{p.slug}/" for p in Product.objects.filter(active=True)]
    return paths


def main():
    call_command("makemigrations", "shop", "gestion", verbosity=0)
    call_command("migrate", verbosity=0)
    if not Product.objects.exists():
        call_command("seed_demo")
    # Offers from the back office (/gestion/): apply running ones, end expired ones.
    from gestion.services import sync_offers
    sync_offers()

    out = Path(settings.BUILD_DIR)
    if out.exists():
        shutil.rmtree(out)
    out.mkdir(parents=True)

    client = Client()
    count = 0
    for lang in LANGS:
        for path in pages():
            url = f"/{lang}/{path}"
            response = client.get(url, HTTP_ACCEPT_LANGUAGE=lang)
            if response.status_code != 200:
                sys.exit(f"Erreur {response.status_code} sur {url}")
            target = out / url.strip("/") / "index.html"
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(response.content)
            count += 1

    # Visitors arriving on "/" go to Arabic or French from their browser language.
    (out / "_redirects").write_text("/  /ar/  302  Language=ar\n/  /fr/  302\n", encoding="utf-8")
    (out / "index.html").write_text(
        '<!doctype html><meta charset="utf-8"><title>Tech-Ward</title>'
        '<script>location.replace((navigator.language||"").startsWith("ar")?"/ar/":"/fr/")</script>'
        '<a href="/fr/">Tech-Ward</a>', encoding="utf-8")

    shutil.copytree(settings.BASE_DIR / "static", out / "static")
    if Path(settings.MEDIA_ROOT).exists():
        shutil.copytree(settings.MEDIA_ROOT, out / "media")

    print(f"{count} pages générées dans {out}")


if __name__ == "__main__":
    main()

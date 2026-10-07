# Tech-Ward website

Django site for Tech-Ward (cameras, installation packs, alarm and access control), in French and Arabic, prices in MAD. Customers fill a cart and the **Commander sur WhatsApp** button opens WhatsApp (0675474294) with the cart already written. No online payment: customers pay cash once the quote (devis) is confirmed.

The public site is static so it can be hosted free on Netlify (tech-ward.netlify.app): `build.py` renders every page with Django into `dist/`, and the cart lives in the visitor's browser. Django and its admin run only on your PC, to edit the catalog.

## Run it on Windows

1. Install Python 3.10 or newer from python.org (tick "Add Python to PATH").
2. Double-click `run.bat`. The first run takes a minute to install Django; the site then opens at http://127.0.0.1:8000/.
3. Double-click `create_admin.bat` once to create your admin login, then go to http://127.0.0.1:8000/admin/.

On Mac/Linux use `./run.sh`.

## Publish on Netlify (free)

1. Double-click `build.bat`. It writes the finished site to the `dist` folder and opens it.
2. Go to https://app.netlify.com/drop (logged in with Tech-Ward@gmail.com) and drag the `dist` folder onto the page.
3. In Netlify › Site configuration › Change site name, set it to `tech-ward` so the address is tech-ward.netlify.app.

After changing products or prices in the admin, run `build.bat` again and drag the new `dist` folder onto the site's Deploys page. (If the project is later put on GitHub, `netlify.toml` lets Netlify rebuild it on every push.)

## What's where

| Page | URL |
|---|---|
| Home (hero, featured cameras, packs, alarm & access, how to order) | `/fr/` and `/ar/` |
| Shop, categories (`/fr/boutique/cameras/`...) and search | `/fr/boutique/` |
| Product page | `/fr/produit/<slug>/` |
| Installation packs (Essentiel, Confort, Pro, Business) | `/fr/packs/` |
| Alarm and access control (quoted services) | `/fr/alarme-acces/` |
| Cart and WhatsApp order | `/fr/panier/` |
| Contact | `/fr/contact/` |
| Admin (on your PC only): products, prices, photos | `/admin/` |

## Editing content

- **Products, packs, services**: admin › *Produits, packs et services*. Each item has French and Arabic fields. Leave the price empty for "Sur devis", 0 for "Gratuit". Upload a photo to replace the placeholder drawing. Tick "Mis en avant" to show it on the home page.
- **Orders** arrive only on WhatsApp, each with a reference like TW-261006-1430 (date and time). Nothing is stored on the site.
- **Interface text** (menu, buttons, headings, WhatsApp message): `shop/i18n.py`, French then Arabic.
- **Phone, email**: `TECHWARD` at the bottom of `techward/settings.py`.
- **Colors and layout**: `static/css/style.css`. Hero picture: `static/img/hero.svg` (replace with a real photo later). Logo images in `static/img/` were cut from `Surveillance LOGO.png`.

The catalog loaded by `run.bat` is placeholder data (`shop/management/commands/seed_demo.py`): names, specs and prices are examples to replace with the real supplier list.

## Management system (Gestion)

A back office for running the business, in French, on your PC only: double-click `gestion.bat`, then log in at http://127.0.0.1:8000/gestion/ with the account made by `create_admin.bat`.

| Module | What it does |
|---|---|
| Tableau de bord | Month revenue, profit, pending devis, stock value, items to reorder, best-selling pack and product, revenue vs costs chart |
| Devis | Create devis from the catalog, PDF, send by WhatsApp or email, follow status. "Réalisé et payé" takes the goods (and pack contents) out of stock and counts the sale |
| Clients | Customer list and history |
| Produits et prix | Edit products and services, selling and buying prices, margins. Same catalog as the website |
| Packs | Create packs, choose the equipment inside each one, see their margin |
| Offres et promos | Promotions with dates: the site shows the old price struck through while they run |
| Bons de commande | Purchase orders to suppliers, PDF, WhatsApp or email. "Marchandise reçue" adds stock, updates buying prices and records the cost |
| Fournisseurs | Supplier list, what they supply, what you bought |
| Stock | Quantities, value, alerts, manual entries and inventory counts |
| Coûts et revenus | Expenses, monthly revenue vs costs, profit |
| Publier le site | Rebuilds `dist/` with the new prices and offers, then drag it onto Netlify |

Each module has its own KPI strip at the top. Data lives in `db.sqlite3`: back it up from time to time (copy the file). Code is in the `gestion` app; it uses the `shop` catalog and does not change the website templates.

- **Business details on documents** (address, ICE, RC, IF, default VAT): `TECHWARD` in `techward/settings.py`.
- **Sending email directly** with the PDF attached: create a Gmail app password for Tech-Ward@gmail.com and save it in a file named `gmail_app_password.txt` next to `manage.py`. Without it, the Email button opens your mail app and you attach the PDF yourself.
- **WhatsApp**: the button downloads the PDF and opens the chat with the message ready; attach the PDF before sending (WhatsApp links cannot attach files).

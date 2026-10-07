# Tech-Ward

One Netlify site with two parts that share the same data:

- **The website** (`/fr/...` and `/ar/...`): cameras, installation packs, alarm and access control, prices in MAD. Customers fill a cart and **Commander sur WhatsApp** opens WhatsApp with the order written. No online payment: customers pay cash once the devis is confirmed.
- **Gestion** (`/gestion/`): the back office. Catalogue and prices, packs, offers, customers, suppliers, devis (PDF, WhatsApp), purchase orders, stock, costs and revenue, and the website basics (phone, email, address, home banner).

Every change saved in Gestion is on the website at the next page load. There is nothing to build or publish.

## How it runs

- `netlify/functions/app.mjs` answers every address that isn't a file in `public/`. It calls `app/server.mjs`.
- The data is one JSON document plus the uploaded pictures, kept in **Netlify Blobs** on the site (`app/storage.mjs`). The first visit creates it from the catalogue in `app/seed.json`.
- `public/static/` holds the CSS, JavaScript and images, served directly by Netlify.
- Pushing to the `main` branch on GitHub makes Netlify deploy the new version. The data is not in the code, so a deploy never erases it.

## First use

1. Open https://techward.netlify.app/gestion/ and create your login (the first visit asks for it).
2. **Pilotage › Sauvegarde et import**: import `export-gestion.json` (the export of the old PC version) to bring back your customers, suppliers, devis, purchase orders and buying prices.

Download a backup from the same page from time to time.

## Where things are

| What | File |
|---|---|
| Website pages | `app/shop.mjs` |
| Website text in French and Arabic | `app/i18n.mjs` |
| Gestion pages | `app/gestion/*.mjs` |
| Business rules (stock, devis, offers, figures) | `app/model.mjs` |
| Devis and purchase order PDFs | `app/pdf.mjs` |
| Colors and layout | `public/static/css/style.css`, `public/static/gestion/gestion.css` |
| Cart and WhatsApp order (in the browser) | `public/static/js/app.js` |

## Run it on a computer

With Node.js 20 or newer: `node dev.mjs`, then open http://localhost:8888/. The data is kept in a local `.data` folder.

## Business rules

- A devis set to **Réalisé et payé** counts as revenue (before VAT) and takes the goods out of stock; a pack takes out its contents.
- A purchase order set to **Reçu** puts the goods in stock, updates the buying prices and records the expense.
- While an offer runs, the site shows the offer price with the usual price struck through; prices go back by themselves when it ends.
- Numbers follow DV-YYYY-NNNN (devis) and BC-YYYY-NNNN (purchase orders).

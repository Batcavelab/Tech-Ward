// Catalogue: products and services, installation packs, offers. Same items as the public site.
import { html, raw } from "../html.mjs";
import { gicon } from "../svg.mjs";
import {
  ART, PRODUCT_PRIVATE, bestSellers, byId, insert, isLow, offerRunning, packItems, pct, remove, restoreOffer,
  syncOffers, today, uniqueSlug, unitCost,
} from "../model.mjs";
import { photoOf } from "../shop.mjs";
import { deleteUpload, saveUpload } from "./files.mjs";
import { dmy, errorList, field, input, kpi, kpis, mad, page, readForm, readRows, toNum, top } from "./ui.mjs";

const byName = (a, b) => a.name_fr.localeCompare(b.name_fr, "fr");
const sortedCategories = (db) => [...db.categories].sort((a, b) => (a.order - b.order) || a.name_fr.localeCompare(b.name_fr, "fr"));
const marginBadge = (m) => (m === null ? html`<span class="muted">—</span>`
  : html`<span class="badge ${m < 15 ? "red" : m < 30 ? "warn" : "green"}">${m} %</span>`);

// ====================================================================== products and services
function products(ctx) {
  const db = ctx.db;
  const kind = ctx.query.get("type") || "", cat = ctx.query.get("cat") || "", q = (ctx.query.get("q") || "").trim();
  const catOrder = (p) => byId(db, "categories", p.category_id)?.order ?? -1;
  let list = db.products.filter((p) => p.kind !== "pack")
    .sort((a, b) => a.kind.localeCompare(b.kind) || catOrder(a) - catOrder(b) || a.order - b.order || byName(a, b));
  if (kind === "product" || kind === "service") list = list.filter((p) => p.kind === kind);
  if (cat) list = list.filter((p) => byId(db, "categories", p.category_id)?.slug === cat);
  if (q) {
    const s = q.toLowerCase();
    list = list.filter((p) => [p.name_fr, p.name_ar, p.brand, p.sku].some((v) => (v || "").toLowerCase().includes(s)));
  }
  const rows = list.map((p) => {
    const priced = p.price && p.cost_price;
    return { p, margin_pct: priced ? pct(p.price - p.cost_price, p.price) : null };
  });
  const all = db.products.filter((p) => p.kind !== "pack");
  const priced = rows.filter((r) => r.margin_pct !== null);
  const content = html`
${top("Catalogue", "Produits et prix", html`
  <a class="btn primary" href="/gestion/catalogue/nouveau/">${gicon("plus")}Nouveau produit</a>
  <a class="btn" href="/gestion/catalogue/nouveau/?type=service">${gicon("plus")}Nouveau service</a>`)}
${kpis([
    kpi("Articles en ligne", all.filter((p) => p.active).length, `${all.length} au total`),
    kpi("Produits", all.filter((p) => p.kind === "product").length, `${all.filter((p) => p.kind === "service").length} services`),
    kpi("Sur devis", all.filter((p) => p.price === null).length, "Sans prix affiché"),
    kpi("Marge moyenne", `${priced.length ? Math.round(priced.reduce((s, r) => s + r.margin_pct, 0) / priced.length) : 0} %`,
      "Sur les articles avec prix d'achat"),
    kpi("En promotion", all.filter((p) => p.old_price !== null && p.old_price !== undefined).length, "Prix barré sur le site"),
  ])}
<div class="card">
  <form class="filters" method="get">
    <input type="search" name="q" value="${q}" placeholder="Rechercher nom, marque, référence…">
    <select name="type" onchange="this.form.submit()"><option value="">Produits et services</option><option value="product"${kind === "product" ? raw(" selected") : ""}>Produits</option><option value="service"${kind === "service" ? raw(" selected") : ""}>Services</option></select>
    <select name="cat" onchange="this.form.submit()"><option value="">Toutes les catégories</option>${sortedCategories(db).map((c) => html`<option value="${c.slug}"${cat === c.slug ? raw(" selected") : ""}>${c.name_fr}</option>`)}</select>
    <button class="btn">Filtrer</button>
  </form>
  <div class="table-wrap"><table class="t">
    <thead><tr><th></th><th>Article</th><th>Catégorie</th><th class="num">Prix d'achat</th><th class="num">Prix de vente</th><th class="num">Marge</th><th class="num">Stock</th><th>Site</th></tr></thead>
    <tbody>${rows.length ? rows.map(({ p, margin_pct }) => html`<tr>
      <td>${photoOf(p) ? html`<img class="thumb" src="${photoOf(p)}" alt="">` : html`<span class="thumb"></span>`}</td>
      <td><a href="/gestion/catalogue/${p.id}/"><b>${p.name_fr}</b></a><br><span class="small muted">${p.kind === "service" ? "Service" : p.brand || "—"}${p.sku ? ` · ${p.sku}` : ""}</span></td>
      <td>${byId(db, "categories", p.category_id)?.name_fr || "—"}</td>
      <td class="num">${p.cost_price ? mad(p.cost_price) : html`<span class="muted">—</span>`}</td>
      <td class="num">${p.old_price ? html`<s class="muted small">${mad(p.old_price)}</s><br>` : ""}<b>${mad(p.price)}</b></td>
      <td class="num">${marginBadge(margin_pct)}</td>
      <td class="num">${p.kind === "product" ? html`<span class="badge ${p.stock <= 0 ? "red" : isLow(p) ? "warn" : ""}">${p.stock}</span>` : html`<span class="muted">—</span>`}</td>
      <td>${p.active ? html`<span class="badge green">Visible</span>` : html`<span class="badge">Masqué</span>`}${p.featured ? html` <span class="badge blue">Accueil</span>` : ""}</td>
    </tr>`) : html`<tr><td colspan="8" class="empty">Aucun article.</td></tr>`}</tbody>
  </table></div>
</div>`;
  return page(ctx, { title: "Produits et prix", section: "products", content });
}

function productDefs(db, kind) {
  const defs = {
    name_fr: { name: "name_fr", label: "Nom (FR)", required: true, maxlength: 120 },
    name_ar: { name: "name_ar", label: "Nom (AR)", maxlength: 120, dir: "rtl" },
    short_fr: { name: "short_fr", label: "Accroche (FR)", maxlength: 160 },
    short_ar: { name: "short_ar", label: "Accroche (AR)", maxlength: 160, dir: "rtl" },
    specs_fr: { name: "specs_fr", label: "Caractéristiques (FR)", type: "textarea", help: "Une par ligne." },
    specs_ar: { name: "specs_ar", label: "Caractéristiques (AR)", type: "textarea", dir: "rtl", help: "Une par ligne." },
    description_fr: { name: "description_fr", label: "Description (FR)", type: "textarea" },
    description_ar: { name: "description_ar", label: "Description (AR)", type: "textarea", dir: "rtl" },
    price: { name: "price", label: "Prix (MAD)", type: "money", step: "1", round: 0, min: 0, help: "Vide = « Sur devis » sur le site. 0 = gratuit." },
    old_price: { name: "old_price", label: "Ancien prix (MAD)", type: "money", step: "1", round: 0, min: 0,
      help: "Affiché barré sur le site (géré automatiquement par les offres)." },
    cost_price: { name: "cost_price", label: "Prix d'achat (MAD)", type: "money", min: 0, default: 0,
      help: "Pour un pack ou un service : coût de main d'œuvre et divers." },
    supplier_id: { name: "supplier_id", label: "Fournisseur habituel", type: "select", numeric: true,
      choices: [...db.suppliers].sort((a, b) => a.name.localeCompare(b.name, "fr")).map((s) => [s.id, s.name]) },
    category_id: { name: "category_id", label: "Catégorie", type: "select", numeric: true,
      choices: sortedCategories(db).map((c) => [c.id, c.name_fr]) },
    brand: { name: "brand", label: "Marque", maxlength: 40 },
    sku: { name: "sku", label: "Référence", maxlength: 40 },
    min_stock: { name: "min_stock", label: "Seuil d'alerte", type: "int", min: 0, default: 2 },
    location: { name: "location", label: "Emplacement", maxlength: 60, help: "Ex. Étagère A2" },
    active: { name: "active", label: "Visible", type: "checkbox" },
    featured: { name: "featured", label: "Mis en avant (accueil)", type: "checkbox" },
    art: { name: "art", label: "Dessin par défaut", type: "select", blank: false, choices: ART },
    order: { name: "order", label: "Ordre", type: "int", min: 0, default: 0 },
    slug: { name: "slug", label: "Adresse sur le site", maxlength: 50,
      help: "Adresse de la page sur le site. Laisser vide pour la créer depuis le nom." },
  };
  if (kind === "pack") { delete defs.category_id; delete defs.brand; delete defs.art; }
  return defs;
}

async function productEdit(ctx, id, forceKind) {
  const db = ctx.db;
  const product = id ? byId(db, "products", id) : null;
  if (id && !product) return null;
  const kind = product ? product.kind : forceKind || (ctx.query.get("type") === "service" ? "service" : "product");
  const isPack = kind === "pack";
  const listUrl = isPack ? "/gestion/packs/" : "/gestion/catalogue/";
  const defs = productDefs(db, kind);
  let values = product ? { ...product } : { ...PRODUCT_PRIVATE, active: true, featured: false, art: isPack ? "pack" : "bullet", order: 0, price: null, old_price: null };
  let errors = {};
  let items = product ? db.packItems.filter((i) => i.pack_id === product.id) : [];

  if (ctx.method === "POST") {
    const form = await ctx.form();
    const read = readForm(Object.values(defs), form);
    values = { ...values, ...read.values };
    errors = read.errors;
    // Pack contents.
    let newItems = [];
    if (isPack) {
      for (const r of readRows(form, "items")) {
        if (r.DELETE || !r.component_id) continue;
        const comp = byId(db, "products", r.component_id);
        const qty = Math.max(1, parseInt(r.quantity, 10) || 1);
        if (comp && comp.kind === "product") newItems.push({ component_id: comp.id, quantity: qty });
      }
      items = newItems;
    }
    const [imageUrl, imageError] = Object.keys(errors).length ? [null, null] : await saveUpload(ctx, form.get("image"), "products");
    if (imageError) errors.image = imageError;
    if (!Object.keys(errors).length) {
      const target = product || insert(db, "products", { kind, image: "", ...PRODUCT_PRIVATE });
      const { stock, ...rest } = values;  // stock only changes through movements
      Object.assign(target, rest, { kind: target.kind });
      if (isPack) target.art = "pack";
      if (!target.name_ar) target.name_ar = "";
      target.slug = uniqueSlug(db, values.slug, values.name_fr, target.id);
      if (imageUrl) { await deleteUpload(ctx, product?.image); target.image = imageUrl; }
      else if (form.has("image_clear") && target.image) { await deleteUpload(ctx, target.image); target.image = ""; }
      if (isPack) {
        remove(db, "packItems", (i) => i.pack_id === target.id);
        for (const i of newItems) insert(db, "packItems", { pack_id: target.id, ...i });
      }
      await ctx.commit();
      ctx.flash("success", `« ${target.name_fr} » enregistré. Il est déjà à jour sur le site.`);
      return ctx.redirect(listUrl);
    }
  }

  const f = (name, opts) => (defs[name] ? field(defs[name], values, errors, opts) : "");
  let stats = null;
  if (product) {
    const done = new Set(db.quotes.filter((q) => q.status === "realise").map((q) => q.id));
    stats = {
      sold: db.quoteLines.filter((l) => l.product_id === product.id && done.has(l.quote_id)).reduce((s, l) => s + l.quantity, 0),
      cost: unitCost(db, product),
      movements: db.movements.filter((m) => m.product_id === product.id).sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id).slice(0, 8),
    };
  }
  const title = product ? product.name_fr : kind === "service" ? "Nouveau service" : isPack ? "Nouveau pack" : "Nouveau produit";
  const components = db.products.filter((p) => p.kind === "product").sort(byName);
  const itemRows = [...items, ...Array(3).fill({ component_id: "", quantity: "" })];
  const packCard = isPack ? html`
<div class="card"><h2>Contenu du pack</h2>
  <p class="small muted" style="margin-top:-6px">Le matériel du pack sort du stock quand un devis contenant ce pack passe en « Réalisé et payé ». Le prix d'achat du pack (à droite) correspond à la pose et aux fournitures.</p>
  <table class="t lines" id="lines"><thead><tr><th>Produit</th><th style="width:110px">Quantité</th><th class="del" style="width:70px">Retirer</th></tr></thead><tbody>
  ${itemRows.map((it, n) => html`<tr><td>${input({ name: "component_id", type: "select", choices: components.map((p) => [p.id, p.name_fr]) }, it.component_id, { prefix: `items-${n}-` })}</td><td>${input({ name: "quantity", type: "int", min: 1 }, it.quantity, { prefix: `items-${n}-` })}</td><td class="del">${it.component_id ? html`<input type="checkbox" name="items-${n}-DELETE">` : ""}</td></tr>`)}
  </tbody></table>
  <div class="form-actions" style="justify-content:flex-start;margin-top:8px"><button type="button" class="btn sm" id="add-line">${gicon("plus")}Ajouter une ligne</button></div>
</div>` : "";
  const siteUrl = product ? (isPack ? "/fr/packs/" : `/fr/produit/${product.slug}/`) : "";
  const content = html`
${top(isPack ? html`<a href="/gestion/packs/">Packs</a>` : html`<a href="/gestion/catalogue/">Produits et prix</a>`, title,
    product ? html`${product.active ? html`<a class="btn" href="${siteUrl}" target="_blank">Voir sur le site</a>` : ""}
    ${product.kind === "product" ? html`<a class="btn" href="/gestion/stock/?produit=${product.id}#ajuster">Ajuster le stock</a>` : ""}` : "")}
${product ? html`<section class="kpis">
  <div class="kpi"><div class="label">Prix de vente</div><div class="value">${mad(product.price)}</div>${product.old_price ? html`<div class="sub">au lieu de ${mad(product.old_price)}</div>` : ""}</div>
  <div class="kpi"><div class="label">Coût</div><div class="value">${mad(stats.cost)}</div></div>
  ${product.kind === "product" ? html`<div class="kpi ${isLow(product) ? "warn" : ""}"><div class="label">En stock</div><div class="value">${product.stock}</div><div class="sub">Seuil d'alerte ${product.min_stock}</div></div>` : ""}
  <div class="kpi"><div class="label">Vendus</div><div class="value">${stats.sold}</div><div class="sub">Devis réalisés</div></div>
</section>` : ""}
<form method="post" enctype="multipart/form-data">
  ${Object.keys(errors).length ? html`<div class="note">Corrigez les champs en rouge.</div>` : ""}
  <div class="grid g-main">
    <div class="stack">
      <div class="card"><h2>Français</h2><div class="form-grid">
        ${f("name_fr", { wide: true })}${f("short_fr", { wide: true })}${f("specs_fr")}${f("description_fr")}
      </div></div>
      <div class="card"><h2>العربية</h2><div class="form-grid">
        ${f("name_ar", { wide: true })}${f("short_ar", { wide: true })}${f("specs_ar")}${f("description_ar")}
      </div></div>
      ${packCard}
    </div>
    <div class="stack">
      <div class="card"><h2>Prix et achat</h2><div class="form-grid" style="grid-template-columns:1fr">
        ${f("price")}${f("cost_price")}${f("old_price")}${f("supplier_id")}
      </div></div>
      ${!isPack ? html`<div class="card"><h2>Classement</h2><div class="form-grid" style="grid-template-columns:1fr">
        ${f("category_id")}${f("brand")}
      </div></div>` : ""}
      ${kind === "product" ? html`<div class="card"><h2>Stock</h2><div class="form-grid" style="grid-template-columns:1fr">
        ${f("sku")}${f("min_stock")}${f("location")}
      </div></div>` : html`<div style="display:none">${input(defs.sku, values.sku)}${input(defs.min_stock, values.min_stock)}${input(defs.location, values.location)}</div>`}
      <div class="card"><h2>Sur le site</h2><div class="form-grid" style="grid-template-columns:1fr">
        ${f("active")}${f("featured")}
        <div class="field"><label for="id_image">Photo</label>
          ${values.image ? html`<img src="${values.image}" alt="" style="max-width:160px;border-radius:8px">
          <label class="small"><input type="checkbox" name="image_clear"> Retirer la photo</label>` : ""}
          <input type="file" name="image" id="id_image" accept="image/*">${errorList(errors.image)}</div>
        ${f("art")}${f("order")}${f("slug")}
      </div></div>
    </div>
  </div>
  <div class="form-actions">
    ${product ? html`<button class="btn danger" form="del" data-confirm="Supprimer cet article ? S'il apparaît dans des devis ou commandes, il sera seulement masqué du site.">Supprimer</button>` : ""}
    <a class="btn" href="${listUrl}">Annuler</a>
    <button class="btn primary">Enregistrer</button>
  </div>
</form>
${product ? html`<form id="del" method="post" action="/gestion/catalogue/${product.id}/supprimer/"></form>
${stats.movements.length ? html`<div class="card" style="margin-top:16px"><h2>Derniers mouvements de stock</h2><table class="t"><tbody>${stats.movements.map((m) => html`<tr><td>${dmy(m.date, { time: true })}</td><td>${m.reason}</td><td class="num">${m.quantity > 0 ? "+" : ""}${m.quantity}</td></tr>`)}</tbody></table></div>` : ""}` : ""}`;
  return page(ctx, { title, section: isPack ? "packs" : "products", content, scripts: isPack ? addLineScript : "" });
}

// "Ajouter une ligne" for simple line tables (copies the last row with the next number).
export const addLineScript = raw(`<script>
document.getElementById("add-line").addEventListener("click", function () {
  var body = document.querySelector("#lines tbody"), rows = body.querySelectorAll("tr"), clone = rows[rows.length - 1].cloneNode(true);
  var n = rows.length;
  clone.querySelectorAll("input, select").forEach(function (el) {
    el.name = el.name.replace(/-\\d+-/, "-" + n + "-"); el.id = el.id.replace(/-\\d+-/, "-" + n + "-");
    if (el.type === "checkbox") el.remove(); else el.value = "";
  });
  body.appendChild(clone);
});
</script>`);

async function productDelete(ctx, id) {
  const db = ctx.db, product = byId(db, "products", id);
  if (!product) return null;
  const used = db.quoteLines.some((l) => l.product_id === product.id) || db.orderLines.some((l) => l.product_id === product.id)
    || db.packItems.some((i) => i.component_id === product.id);
  if (used) {
    product.active = false;
    ctx.flash("info", `« ${product.name_fr} » est utilisé dans des devis, packs ou commandes : il est masqué du site.`);
  } else {
    await deleteUpload(ctx, product.image);
    remove(db, "products", (p) => p.id === product.id);
    remove(db, "packItems", (i) => i.pack_id === product.id);
    remove(db, "offerItems", (i) => i.product_id === product.id);
    remove(db, "movements", (m) => m.product_id === product.id);
    ctx.flash("success", `« ${product.name_fr} » supprimé.`);
  }
  await ctx.commit();
  return ctx.redirect(product.kind === "pack" ? "/gestion/packs/" : "/gestion/catalogue/");
}

// ====================================================================== packs
function packs(ctx) {
  const db = ctx.db;
  const sold = new Map(bestSellers(db, "pack", null, 1000).map((r) => [r.id, r.qty]));
  const rows = db.products.filter((p) => p.kind === "pack").sort((a, b) => a.order - b.order || a.id - b.id).map((p) => {
    const cost = unitCost(db, p);
    return { p, cost, items: packItems(db, p), margin_pct: p.price ? pct(p.price - cost, p.price) : null, sold: sold.get(p.id) || 0 };
  });
  const best = rows.reduce((b, r) => (!b || r.sold > b.sold ? r : b), null);
  const priced = rows.filter((r) => r.margin_pct !== null).map((r) => r.margin_pct);
  const content = html`
${top("Catalogue", "Packs d'installation", html`<a class="btn primary" href="/gestion/packs/nouveau/">${gicon("plus")}Nouveau pack</a>`)}
${kpis([
    kpi("Packs", rows.length, `${rows.filter((r) => r.p.active).length} visibles sur le site`),
    kpi("Pack le plus vendu", best && best.sold ? best.p.name_fr : "—", best && best.sold ? `${best.sold} vendu(s)` : "Aucune vente réalisée"),
    kpi("Packs vendus", rows.reduce((s, r) => s + r.sold, 0), "Devis réalisés"),
    kpi("Marge moyenne", `${priced.length ? Math.round(priced.reduce((a, b) => a + b, 0) / priced.length) : 0} %`, "Prix vs matériel + pose"),
  ])}
<div class="grid g3">${rows.length ? rows.map((r) => html`
  <div class="card">
    <div class="card-head"><h2><a href="/gestion/packs/${r.p.id}/">${r.p.name_fr}</a></h2>${r.p.active ? html`<span class="badge green">Visible</span>` : html`<span class="badge">Masqué</span>`}</div>
    <p class="small muted" style="margin:-4px 0 10px">${r.p.short_fr}</p>
    <div class="totals" style="width:100%">
      <div><span>Prix de vente</span><b>${r.p.old_price ? html`<s class="muted small">${mad(r.p.old_price)}</s> ` : ""}${mad(r.p.price)}</b></div>
      <div><span>Coût (matériel + pose)</span><span>${mad(r.cost)}</span></div>
      <div><span>Marge</span>${marginBadge(r.margin_pct)}</div>
      <div><span>Vendus</span><b>${r.sold}</b></div>
    </div>
    <h3 style="margin-top:10px">Contenu</h3>
    ${r.items.length ? html`<ul class="small" style="margin:0;padding-left:18px">${r.items.map((i) => html`<li>${i.quantity} × ${i.component.name_fr}</li>`)}</ul>`
      : html`<p class="small muted" style="margin:0">Pas encore de matériel lié. <a href="/gestion/packs/${r.p.id}/">Ajouter le contenu</a> pour suivre le stock et la marge.</p>`}
  </div>`) : html`<div class="card"><p class="muted">Aucun pack.</p></div>`}</div>`;
  return page(ctx, { title: "Packs", section: "packs", content });
}

// ====================================================================== offers
function offerStatus(o, d) {
  if (offerRunning(o, d)) return html`<span class="badge green">En cours</span>`;
  if (!o.active) return html`<span class="badge">Désactivée</span>`;
  if (o.start_date > d) return html`<span class="badge blue">À venir</span>`;
  return html`<span class="badge">Terminée</span>`;
}

function offers(ctx) {
  const db = ctx.db, d = today();
  const all = [...db.offers].sort((a, b) => b.start_date.localeCompare(a.start_date));
  const running = all.filter((o) => offerRunning(o, d));
  const daysLeft = (o) => (new Date(o.end_date) - new Date(d)) / 86400000;
  const ending = running.filter((o) => o.end_date && daysLeft(o) <= 7);
  const runningIds = new Set(running.map((o) => o.id));
  const promoProducts = new Set(db.offerItems.filter((i) => runningIds.has(i.offer_id)).map((i) => i.product_id));
  const since = running.map((o) => o.start_date).sort()[0] || d;
  const doneIds = new Set(db.quotes.filter((q) => q.status === "realise" && q.date >= since).map((q) => q.id));
  const promoSales = db.quoteLines.filter((l) => doneIds.has(l.quote_id) && promoProducts.has(l.product_id)).reduce((s, l) => s + l.quantity, 0);
  const itemsOf = (o) => db.offerItems.filter((i) => i.offer_id === o.id);
  const content = html`
${top("Catalogue", "Offres et promotions", html`<a class="btn primary" href="/gestion/offres/nouvelle/">${gicon("plus")}Nouvelle offre</a>`)}
${kpis([
    kpi("Offres en cours", running.length, `${all.length} au total`),
    kpi("Articles en promo", running.reduce((s, o) => s + itemsOf(o).length, 0), "Prix barré sur le site"),
    kpi("Se terminent sous 7 jours", ending.length, ending.map((o) => o.name).join(", ").slice(0, 60), ending.length ? "warn" : ""),
    kpi("Ventes en promo", promoSales, "Unités vendues pendant les offres en cours"),
  ])}
<p class="note info" style="margin:0 0 16px">Pendant une offre, le site affiche le prix promo avec l'ancien prix barré. À la fin de l'offre, le prix habituel revient tout seul.</p>
<div class="card"><div class="table-wrap"><table class="t">
  <thead><tr><th>Offre</th><th>Période</th><th>Articles</th><th>Statut</th></tr></thead>
  <tbody>${all.length ? all.map((o) => html`<tr>
    <td><a href="/gestion/offres/${o.id}/"><b>${o.name}</b></a><br><span class="small muted">${o.description}</span></td>
    <td>${dmy(o.start_date)} → ${o.end_date ? dmy(o.end_date) : "sans fin"}</td>
    <td class="small">${itemsOf(o).map((i, n) => html`${n ? html`<br>` : ""}${byId(db, "products", i.product_id)?.name_fr} : <b>${mad(i.offer_price)}</b>`)}</td>
    <td>${offerStatus(o, d)}</td>
  </tr>`) : html`<tr><td colspan="4" class="empty">Aucune offre. <a href="/gestion/offres/nouvelle/">Créer une promotion</a></td></tr>`}</tbody>
</table></div></div>`;
  return page(ctx, { title: "Offres et promos", section: "offers", content });
}

const OFFER_DEFS = [
  { name: "name", label: "Nom de l'offre", required: true, maxlength: 120 },
  { name: "start_date", label: "Début", type: "date", required: true },
  { name: "end_date", label: "Fin", type: "date", help: "Vide = sans date de fin." },
  { name: "active", label: "Active", type: "checkbox" },
  { name: "description", label: "Description", maxlength: 250 },
];

async function offerEdit(ctx, id) {
  const db = ctx.db;
  const offer = id ? byId(db, "offers", id) : null;
  if (id && !offer) return null;
  let values = offer ? { ...offer } : { name: "", start_date: today(), end_date: null, active: true, description: "" };
  let errors = {};
  let items = offer ? db.offerItems.filter((i) => i.offer_id === offer.id) : [];
  if (ctx.method === "POST") {
    const form = await ctx.form();
    const read = readForm(OFFER_DEFS, form);
    values = read.values;
    errors = read.errors;
    if (values.end_date && values.start_date && values.end_date < values.start_date) errors.end_date = "La fin doit être après le début.";
    const newItems = [];
    for (const r of readRows(form, "items")) {
      if (r.DELETE || !r.product_id) continue;
      const p = byId(db, "products", r.product_id), price = toNum(r.offer_price);
      if (!p) continue;
      if (price === null || price < 0) { errors.items = "Indiquez un prix promo pour chaque article."; continue; }
      newItems.push({ product_id: p.id, offer_price: Math.round(price) });
    }
    items = newItems;
    if (!Object.keys(errors).length) {
      if (offer) restoreOffer(db, offer);
      const target = offer || insert(db, "offers", {});
      Object.assign(target, values);
      remove(db, "offerItems", (i) => i.offer_id === target.id);
      for (const i of newItems) insert(db, "offerItems", { offer_id: target.id, ...i, original_price: null, applied: false });
      syncOffers(db);
      await ctx.commit();
      ctx.flash("success", `Offre « ${target.name} » enregistrée. Le site est à jour.`);
      return ctx.redirect("/gestion/offres/");
    }
  }
  const choices = db.products.filter((p) => p.kind !== "service").sort((a, b) => a.kind.localeCompare(b.kind) || byName(a, b))
    .map((p) => [p.id, `${p.name_fr}${p.price !== null ? ` (${mad(p.price)})` : ""}`]);
  const rows = [...items, ...Array(3).fill({ product_id: "", offer_price: "" })];
  const f = (name, opts) => field(OFFER_DEFS.find((d) => d.name === name), values, errors, opts);
  const title = offer ? offer.name : "Nouvelle offre";
  const content = html`
${top(html`<a href="/gestion/offres/">Offres et promos</a>`, title)}
<form method="post">
  <div class="card"><div class="form-grid">
    ${f("name")}${f("start_date")}${f("end_date")}${f("active")}${f("description", { wide: true })}
  </div></div>
  <div class="card"><h2>Articles en promotion</h2>
    ${errors.items ? html`<div class="note">${errors.items}</div>` : ""}
    <table class="t lines" id="lines"><thead><tr><th>Produit ou pack</th><th style="width:200px">Prix promo (MAD)</th><th class="del" style="width:70px">Retirer</th></tr></thead><tbody>
    ${rows.map((it, n) => html`<tr><td>${input({ name: "product_id", type: "select", choices }, it.product_id, { prefix: `items-${n}-` })}</td><td>${input({ name: "offer_price", type: "money", step: "1", min: 0 }, it.offer_price, { prefix: `items-${n}-` })}</td><td class="del">${it.product_id ? html`<input type="checkbox" name="items-${n}-DELETE">` : ""}</td></tr>`)}
    </tbody></table>
    <div class="form-actions" style="justify-content:flex-start;margin-top:8px"><button type="button" class="btn sm" id="add-line">${gicon("plus")}Ajouter une ligne</button></div>
  </div>
  <div class="form-actions">
    ${offer ? html`<button class="btn danger" form="del" data-confirm="Supprimer cette offre et remettre les prix habituels ?">Supprimer</button>` : ""}
    <a class="btn" href="/gestion/offres/">Annuler</a><button class="btn primary">Enregistrer</button>
  </div>
</form>
${offer ? html`<form id="del" method="post" action="/gestion/offres/${offer.id}/supprimer/"></form>` : ""}`;
  return page(ctx, { title, section: "offers", content, scripts: addLineScript });
}

async function offerDelete(ctx, id) {
  const db = ctx.db, offer = byId(db, "offers", id);
  if (!offer) return null;
  restoreOffer(db, offer);
  remove(db, "offerItems", (i) => i.offer_id === offer.id);
  remove(db, "offers", (o) => o.id === offer.id);
  await ctx.commit();
  ctx.flash("success", "Offre supprimée, les prix habituels sont rétablis.");
  return ctx.redirect("/gestion/offres/");
}

export const catalogRoutes = [
  { method: "GET", path: /^\/gestion\/catalogue\/$/, handler: products },
  { path: /^\/gestion\/catalogue\/nouveau\/$/, handler: (ctx) => productEdit(ctx, null) },
  { path: /^\/gestion\/catalogue\/(\d+)\/$/, handler: (ctx, id) => productEdit(ctx, Number(id)) },
  { method: "POST", path: /^\/gestion\/catalogue\/(\d+)\/supprimer\/$/, handler: (ctx, id) => productDelete(ctx, Number(id)) },
  { method: "GET", path: /^\/gestion\/packs\/$/, handler: packs },
  { path: /^\/gestion\/packs\/nouveau\/$/, handler: (ctx) => productEdit(ctx, null, "pack") },
  { path: /^\/gestion\/packs\/(\d+)\/$/, handler: (ctx, id) => productEdit(ctx, Number(id), "pack") },
  { method: "GET", path: /^\/gestion\/offres\/$/, handler: offers },
  { path: /^\/gestion\/offres\/nouvelle\/$/, handler: (ctx) => offerEdit(ctx, null) },
  { path: /^\/gestion\/offres\/(\d+)\/$/, handler: (ctx, id) => offerEdit(ctx, Number(id)) },
  { method: "POST", path: /^\/gestion\/offres\/(\d+)\/supprimer\/$/, handler: (ctx, id) => offerDelete(ctx, Number(id)) },
];

// Site web: contact details and home banner (photo, title, text), live on the website as soon as they are saved.
// Sauvegarde et import: download all the data, or load a backup / the export from the old PC version.
import { html } from "../html.mjs";
import { t } from "../i18n.mjs";
import { DEFAULTS, PRODUCT_PRIVATE, TABLES, fixSeq, nowLocal, siteInfo, syncOffers } from "../model.mjs";
import { Conflict } from "../server.mjs";
import { deleteUpload, saveUpload } from "./files.mjs";
import { dmy, errorList, field, kpi, kpis, page, readForm, top } from "./ui.mjs";

const SITE_DEFS = [
  { name: "hero_title_fr", label: "Titre de la bannière (français)", type: "textarea", rows: 2,
    help: "Vide = titre actuel. Un retour à la ligne coupe le titre.", placeholder: `${t("hero_title_1", "fr")}\n${t("hero_title_2", "fr")}` },
  { name: "hero_title_ar", label: "Titre de la bannière (arabe)", type: "textarea", rows: 2, dir: "rtl",
    placeholder: `${t("hero_title_1", "ar")}\n${t("hero_title_2", "ar")}` },
  { name: "hero_text_fr", label: "Texte de la bannière (français)", type: "textarea", rows: 3, placeholder: t("hero_text", "fr") },
  { name: "hero_text_ar", label: "Texte de la bannière (arabe)", type: "textarea", rows: 3, dir: "rtl", placeholder: t("hero_text", "ar") },
  { name: "phone_display", label: "Téléphone affiché", maxlength: 40, placeholder: DEFAULTS.phone_display,
    help: "Tel qu'il apparaît sur le site, ex. 06 75 47 42 94." },
  { name: "whatsapp", label: "Numéro WhatsApp", maxlength: 20, placeholder: DEFAULTS.whatsapp,
    help: "Format international sans + ni espaces, ex. 212675474294. Reçoit les commandes et les questions." },
  { name: "email", label: "Email", type: "email", placeholder: DEFAULTS.email },
  { name: "address", label: "Adresse", maxlength: 200, help: "Affichée sur la page Contact, en bas du site et sur les devis." },
];

function cleanWhatsapp(text) {
  let n = String(text || "").replace(/\D/g, "");
  if (n.startsWith("00")) n = n.slice(2);
  if (n.startsWith("0") && n.length === 10) n = "212" + n.slice(1);  // 06xxxxxxxx -> 2126xxxxxxxx
  if (n && (n.length < 10 || n.length > 15)) return [n, "Numéro invalide. Exemple : 212675474294."];
  return [n, null];
}

async function siteSettings(ctx) {
  const db = ctx.db;
  db.site = db.site || {};
  let values = { ...db.site }, errors = {};
  if (ctx.method === "POST") {
    const form = await ctx.form();
    const read = readForm(SITE_DEFS, form);
    values = read.values; errors = read.errors;
    const [wa, waErr] = cleanWhatsapp(values.whatsapp);
    values.whatsapp = wa;
    if (waErr) errors.whatsapp = waErr;
    const [url, imgErr] = Object.keys(errors).length ? [null, null] : await saveUpload(ctx, form.get("hero_image"), "site");
    if (imgErr) errors.hero_image = imgErr;
    if (!Object.keys(errors).length) {
      const old = db.site.hero_image;
      if (url) { await deleteUpload(ctx, old); values.hero_image = url; }
      else if (form.has("reset_hero")) { await deleteUpload(ctx, old); values.hero_image = ""; }
      else values.hero_image = old || "";
      db.site = { ...values, updated_at: nowLocal() };
      await ctx.commit();
      ctx.flash("success", "Réglages enregistrés. Ils sont déjà en ligne sur le site.");
      return ctx.redirect("/gestion/site-web/");
    }
    values.hero_image = db.site.hero_image;
  }
  const TW = siteInfo(db), s = db.site;
  const f = (name, opts) => field(SITE_DEFS.find((d) => d.name === name), values, errors, opts);
  const content = html`
${top("Pilotage", "Site web", html`<a class="btn" href="/fr/" target="_blank">Voir le site</a>`)}
${kpis([
    kpi("Téléphone", TW.phone_display, `WhatsApp ${TW.whatsapp}`),
    kpi("Email", TW.email, ""),
    kpi("Bannière", s.hero_image || s.hero_title_fr || s.hero_text_fr ? "Personnalisée" : "Par défaut",
      s.updated_at ? `Modifiée le ${dmy(s.updated_at)}` : ""),
  ])}
<p class="note info" style="margin-bottom:16px">Les champs vides gardent le contenu actuel du site (affiché en gris). Dès que vous enregistrez, le site est à jour.</p>
<form method="post" enctype="multipart/form-data">
  ${Object.keys(errors).length ? html`<div class="note">Corrigez les champs en rouge.</div>` : ""}
  <div class="grid g-main">
    <div class="stack">
      <div class="card"><h2>Bannière de la page d'accueil</h2>
        ${s.hero_image ? html`<img src="${s.hero_image}" alt="Bannière actuelle" style="width:100%;max-height:220px;object-fit:cover;border-radius:10px;margin-bottom:12px">` : ""}
        <div class="form-grid">
          <div class="field wide"><label for="id_hero_image">Image de la bannière</label><input type="file" name="hero_image" id="id_hero_image" accept="image/*">
            <span class="help">Photo large, idéalement 1600 × 700 px. Vide = photo actuelle.</span>${errorList(errors.hero_image)}</div>
          ${s.hero_image ? html`<div class="field check wide"><input type="checkbox" name="reset_hero" id="id_reset_hero"><label for="id_reset_hero">Remettre la photo d'origine</label></div>` : ""}
          ${f("hero_title_fr")}${f("hero_title_ar")}${f("hero_text_fr")}${f("hero_text_ar")}
        </div>
      </div>
    </div>
    <div class="stack">
      <div class="card"><h2>Coordonnées</h2><div class="form-grid" style="grid-template-columns:1fr">
        ${f("phone_display")}${f("whatsapp")}${f("email")}${f("address")}
      </div></div>
    </div>
  </div>
  <div class="form-actions"><button class="btn primary">Enregistrer</button></div>
</form>`;
  return page(ctx, { title: "Site web", section: "site", content });
}

// ====================================================================== backup and import
function backup(ctx) {
  const { secret, users, ...data } = ctx.db;
  return ctx.file(JSON.stringify(data, null, 1), "application/json", {
    "Content-Disposition": `attachment; filename="tech-ward-sauvegarde-${nowLocal().slice(0, 10)}.json"`, "Cache-Control": "no-store" });
}

const bool = (v) => v === true || v === 1 || v === "1" || v === "true";
const num = (v) => (v === null || v === undefined || v === "" ? null : Number(v));
const date = (v) => (v ? String(v).slice(0, 10) : null);
const stamp = (v) => (v ? String(v).replace(" ", "T").slice(0, 16) : "");

// The export of the first (Django) version on the PC: {"shop_product": [...], "gestion_quote": [...], ...}.
function fromDjango(src) {
  const rows = (k) => src[k] || [];
  const articles = new Map(rows("gestion_article").map((a) => [a.product_id, a]));
  const site = rows("gestion_sitesettings")[0] || {};
  return {
    site: Object.fromEntries(["phone_display", "whatsapp", "email", "address", "hero_title_fr", "hero_title_ar", "hero_text_fr", "hero_text_ar"]
      .map((k) => [k, site[k] || ""])),
    categories: rows("shop_category").map((c) => ({ id: c.id, slug: c.slug, group: c.group, name_fr: c.name_fr, name_ar: c.name_ar || "", order: c.order })),
    products: rows("shop_product").map((p) => {
      const a = articles.get(p.id) || {};
      return { id: p.id, kind: p.kind, category_id: p.category_id, slug: p.slug, brand: p.brand || "",
        name_fr: p.name_fr, name_ar: p.name_ar || "", short_fr: p.short_fr || "", short_ar: p.short_ar || "",
        description_fr: p.description_fr || "", description_ar: p.description_ar || "", specs_fr: p.specs_fr || "", specs_ar: p.specs_ar || "",
        price: num(p.price), old_price: num(p.old_price), image: "", art: p.art, featured: bool(p.featured), active: bool(p.active), order: p.order || 0,
        cost_price: num(a.cost_price) || 0, sku: a.sku || "", supplier_id: a.supplier_id ?? null, stock: a.stock || 0,
        min_stock: a.min_stock ?? 2, location: a.location || "" };
    }),
    packItems: rows("gestion_packitem").map((i) => ({ id: i.id, pack_id: i.pack_id, component_id: i.component_id, quantity: i.quantity })),
    offers: rows("gestion_offer").map((o) => ({ id: o.id, name: o.name, description: o.description || "", start_date: date(o.start_date),
      end_date: date(o.end_date), active: bool(o.active) })),
    offerItems: rows("gestion_offeritem").map((i) => ({ id: i.id, offer_id: i.offer_id, product_id: i.product_id, offer_price: num(i.offer_price),
      original_price: num(i.original_price), applied: bool(i.applied) })),
    customers: rows("gestion_customer").map((c) => ({ id: c.id, name: c.name, kind: c.kind, phone: c.phone || "", email: c.email || "",
      city: c.city || "", address: c.address || "", ice: c.ice || "", notes: c.notes || "", created_at: stamp(c.created_at) })),
    suppliers: rows("gestion_supplier").map((s) => ({ id: s.id, name: s.name, contact_name: s.contact_name || "", phone: s.phone || "",
      email: s.email || "", city: s.city || "", address: s.address || "", ice: s.ice || "", brands: s.brands || "", notes: s.notes || "",
      created_at: stamp(s.created_at) })),
    quotes: rows("gestion_quote").map((q) => ({ id: q.id, number: q.number, customer_id: q.customer_id, date: date(q.date),
      valid_until: date(q.valid_until), status: q.status, discount: num(q.discount) || 0, tva_rate: num(q.tva_rate) || 0, notes: q.notes || "",
      done_date: date(q.done_date), stock_done: bool(q.stock_done), created_at: stamp(q.created_at) })),
    quoteLines: rows("gestion_quoteline").map((l) => ({ id: l.id, quote_id: l.quote_id, product_id: l.product_id, description: l.description || "",
      quantity: l.quantity, unit_price: num(l.unit_price) || 0, unit_cost: num(l.unit_cost) || 0 })),
    orders: rows("gestion_purchaseorder").map((o) => ({ id: o.id, number: o.number, supplier_id: o.supplier_id, date: date(o.date),
      expected_date: date(o.expected_date), status: o.status, notes: o.notes || "", received_date: date(o.received_date), created_at: stamp(o.created_at) })),
    orderLines: rows("gestion_purchaseline").map((l) => ({ id: l.id, order_id: l.order_id, product_id: l.product_id, quantity: l.quantity,
      unit_cost: num(l.unit_cost) || 0 })),
    expenses: rows("gestion_expense").map((e) => ({ id: e.id, date: date(e.date), category: e.category, label: e.label, amount: num(e.amount) || 0,
      supplier_id: e.supplier_id ?? null, purchase_order_id: e.purchase_order_id ?? null })),
    movements: rows("gestion_stockmovement").map((m) => ({ id: m.id, product_id: m.product_id, date: stamp(m.date), kind: m.kind, quantity: m.quantity,
      reason: m.reason || "", quote_id: m.quote_id ?? null, purchase_order_id: m.purchase_order_id ?? null })),
  };
}

async function dataPage(ctx) {
  const db = ctx.db;
  let error = "";
  if (ctx.method === "POST") {
    const file = (await ctx.form()).get("file");
    try {
      if (!file || typeof file === "string" || !file.size) throw new Error("Choisissez un fichier.");
      const src = JSON.parse(await file.text());
      const data = src.shop_product ? fromDjango(src) : src;
      if (!Array.isArray(data.products) || !Array.isArray(data.categories)) throw new Error("Ce fichier n'est pas une sauvegarde Tech-Ward.");
      for (const tbl of TABLES) if (tbl !== "users") db[tbl] = Array.isArray(data[tbl]) ? data[tbl] : [];
      db.products = db.products.map((p) => ({ ...PRODUCT_PRIVATE, ...p }));
      // Keep the photos already uploaded online when the backup has none.
      db.site = { ...(data.site || {}), hero_image: data.site?.hero_image || db.site?.hero_image || "", updated_at: nowLocal() };
      db.seq = {};
      fixSeq(db);
      syncOffers(db);
      await ctx.commit();
      ctx.flash("success", `Import terminé : ${db.products.length} articles, ${db.customers.length} clients, ${db.suppliers.length} fournisseurs, ${db.quotes.length} devis, ${db.orders.length} bons de commande.`);
      return ctx.redirect("/gestion/");
    } catch (e) {
      if (e instanceof Conflict) throw e;
      error = e instanceof SyntaxError ? "Fichier illisible (ce n'est pas un fichier JSON)." : e.message;
    }
  }
  const content = html`
${top("Pilotage", "Sauvegarde et import")}
${kpis([
    kpi("Articles", db.products.length, `${db.categories.length} catégories`),
    kpi("Clients", db.customers.length, `${db.suppliers.length} fournisseurs`),
    kpi("Devis", db.quotes.length, `${db.orders.length} bons de commande`),
  ])}
<div class="grid g2">
  <div class="card"><h2>Télécharger une sauvegarde</h2>
    <p class="small muted">Un fichier avec tout le catalogue, les clients, fournisseurs, devis, commandes, stock et dépenses. Gardez-en une copie de temps en temps.</p>
    <div class="form-actions" style="justify-content:flex-start"><a class="btn primary" href="/gestion/donnees/sauvegarde.json">Télécharger</a></div>
  </div>
  <form class="card" method="post" enctype="multipart/form-data"><h2>Importer</h2>
    <p class="small muted">Remplace toutes les données par celles du fichier : une sauvegarde téléchargée ici, ou le fichier <b>export-gestion.json</b> de l'ancienne version sur le PC. Votre identifiant et votre mot de passe restent les mêmes.</p>
    ${error ? html`<p class="note">${error}</p>` : ""}
    <div class="field"><input type="file" name="file" accept=".json,application/json" required></div>
    <div class="form-actions"><button class="btn danger" data-confirm="Remplacer toutes les données actuelles par celles du fichier ?">Importer</button></div>
  </form>
</div>`;
  return page(ctx, { title: "Sauvegarde et import", section: "data", content });
}

export const siteRoutes = [
  { path: /^\/gestion\/site-web\/$/, handler: siteSettings },
  { path: /^\/gestion\/donnees\/$/, handler: dataPage },
  { method: "GET", path: /^\/gestion\/donnees\/sauvegarde\.json$/, handler: backup },
];

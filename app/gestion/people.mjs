// Customers and suppliers.
import { html } from "../html.mjs";
import { gicon } from "../svg.mjs";
import { CUSTOMER_KINDS, ORDER_STATUSES, QUOTE_STATUSES, byId, doneQuotes, insert, label, monthStart, nowLocal, orderTotal,
  pct, quoteTotals, sum } from "../model.mjs";
import { dmy, field, kpi, kpis, mad, page, readForm, statusClass, top } from "./ui.mjs";

const search = (list, q, keys) => {
  if (!q) return list;
  const s = q.toLowerCase();
  return list.filter((r) => keys.some((k) => String(r[k] || "").toLowerCase().includes(s)));
};
const byName = (a, b) => a.name.localeCompare(b.name, "fr");

// ====================================================================== customers
const CUSTOMER_DEFS = [
  { name: "name", label: "Nom / raison sociale", required: true, maxlength: 120 },
  { name: "kind", label: "Type", type: "select", blank: false, choices: CUSTOMER_KINDS },
  { name: "phone", label: "Téléphone / WhatsApp", maxlength: 30 },
  { name: "email", label: "Email", type: "email" },
  { name: "city", label: "Ville", maxlength: 60 },
  { name: "address", label: "Adresse", maxlength: 200, wide: true },
  { name: "ice", label: "ICE", maxlength: 30 },
  { name: "notes", label: "Notes", type: "textarea", rows: 3, wide: true },
];

function customers(ctx) {
  const db = ctx.db, q = (ctx.query.get("q") || "").trim();
  const list = search([...db.customers].sort(byName), q, ["name", "phone", "email", "city"]);
  const spent = new Map();
  for (const quote of doneQuotes(db)) spent.set(quote.customer_id, (spent.get(quote.customer_id) || 0) + quoteTotals(db, quote).total_ttc);
  const top1 = [...spent.entries()].sort((a, b) => b[1] - a[1])[0];
  const buyers = spent.size, total = db.customers.length;
  const totalSpent = [...spent.values()].reduce((a, b) => a + b, 0);
  const content = html`
${top("Ventes", "Clients", html`<a class="btn primary" href="/gestion/clients/nouveau/">${gicon("plus")}Nouveau client</a>`)}
${kpis([
    kpi("Clients", total, `${db.customers.filter((c) => (c.created_at || "") >= monthStart()).length} nouveaux ce mois`),
    kpi("Clients ayant acheté", buyers, `${pct(buyers, total)} % des clients`),
    kpi("Panier moyen", mad(buyers ? totalSpent / buyers : 0), "Par client acheteur"),
    kpi("Meilleur client", top1 ? byId(db, "customers", top1[0])?.name : "—", top1 ? mad(top1[1]) : ""),
  ])}
<div class="card">
  <form class="filters" method="get"><input type="search" name="q" value="${q}" placeholder="Nom, téléphone, email, ville…"><button class="btn">Rechercher</button></form>
  <div class="table-wrap"><table class="t">
    <thead><tr><th>Client</th><th>Téléphone</th><th>Ville</th><th class="num">Devis</th><th>Dernier devis</th><th class="num">Total acheté</th><th></th></tr></thead>
    <tbody>${list.length ? list.map((c) => {
      const qs = db.quotes.filter((x) => x.customer_id === c.id);
      const last = qs.map((x) => x.date).sort().pop();
      return html`<tr>
      <td><a href="/gestion/clients/${c.id}/"><b>${c.name}</b></a><br><span class="small muted">${label(CUSTOMER_KINDS, c.kind)}${c.email ? ` · ${c.email}` : ""}</span></td>
      <td>${c.phone || "—"}</td><td>${c.city || "—"}</td>
      <td class="num">${qs.length}</td><td>${last ? dmy(last) : "—"}</td>
      <td class="num">${mad(spent.get(c.id) || 0)}</td>
      <td class="num"><a class="btn sm" href="/gestion/devis/nouveau/?client=${c.id}">Devis</a></td>
    </tr>`;
    }) : html`<tr><td colspan="7" class="empty">Aucun client. <a href="/gestion/clients/nouveau/">Ajouter un client</a></td></tr>`}</tbody>
  </table></div>
</div>`;
  return page(ctx, { title: "Clients", section: "customers", content });
}

async function customerEdit(ctx, id) {
  const db = ctx.db;
  const customer = id ? byId(db, "customers", id) : null;
  if (id && !customer) return null;
  let values = customer ? { ...customer } : { kind: "particulier" }, errors = {};
  if (ctx.method === "POST") {
    const read = readForm(CUSTOMER_DEFS, await ctx.form());
    values = read.values; errors = read.errors;
    if (read.ok) {
      const target = customer || insert(db, "customers", { created_at: nowLocal() });
      Object.assign(target, values);
      await ctx.commit();
      ctx.flash("success", `Client « ${target.name} » enregistré.`);
      if (ctx.query.get("next") === "devis") return ctx.redirect(`/gestion/devis/nouveau/?client=${target.id}`);
      return ctx.redirect(`/gestion/clients/${target.id}/`);
    }
  }
  const quotes = customer ? db.quotes.filter((q) => q.customer_id === customer.id).sort((a, b) => b.date.localeCompare(a.date) || b.number.localeCompare(a.number)) : [];
  const done = quotes.filter((q) => q.status === "realise");
  const ttc = (q) => quoteTotals(db, q).total_ttc;
  const title = customer ? customer.name : "Nouveau client";
  const content = html`
${top(html`<a href="/gestion/clients/">Clients</a>`, title,
    customer ? html`<a class="btn primary" href="/gestion/devis/nouveau/?client=${customer.id}">${gicon("plus")}Nouveau devis</a>` : "")}
${customer ? kpis([
    kpi("Devis", quotes.length, `${done.length} réalisés`),
    kpi("Total acheté", mad(sum(done, ttc)), ""),
    kpi("En attente", mad(sum(quotes.filter((q) => ["envoye", "accepte"].includes(q.status)), ttc)), ""),
  ]) : ""}
<div class="grid ${customer ? "g-main" : ""}">
  <form class="card" method="post">
    <h2>Coordonnées</h2>
    <div class="form-grid">${CUSTOMER_DEFS.map((d) => field(d, values, errors, { wide: d.wide }))}</div>
    <div class="form-actions"><a class="btn" href="/gestion/clients/">Annuler</a><button class="btn primary">Enregistrer</button></div>
  </form>
  ${customer ? html`<div class="card"><h2>Devis</h2>
    <table class="t"><tbody>${quotes.length ? quotes.map((q) => html`<tr><td><a href="/gestion/devis/${q.id}/">${q.number}</a><br><span class="small muted">${dmy(q.date)}</span></td><td><span class="badge ${statusClass(q.status)}">${label(QUOTE_STATUSES, q.status)}</span></td><td class="num">${mad(ttc(q))}</td></tr>`)
      : html`<tr><td class="empty">Aucun devis.</td></tr>`}</tbody></table>
  </div>` : ""}
</div>`;
  return page(ctx, { title, section: "customers", content });
}

// ====================================================================== suppliers
const SUPPLIER_DEFS = [
  { name: "name", label: "Nom / raison sociale", required: true, maxlength: 120 },
  { name: "contact_name", label: "Contact", maxlength: 80 },
  { name: "phone", label: "Téléphone / WhatsApp", maxlength: 30 },
  { name: "email", label: "Email", type: "email" },
  { name: "city", label: "Ville", maxlength: 60 },
  { name: "address", label: "Adresse", maxlength: 200, wide: true },
  { name: "ice", label: "ICE", maxlength: 30 },
  { name: "brands", label: "Marques", maxlength: 120, help: "Ex. Hikvision, Dahua" },
  { name: "notes", label: "Notes", type: "textarea", rows: 3, wide: true },
];

function suppliers(ctx) {
  const db = ctx.db, q = (ctx.query.get("q") || "").trim();
  const list = search([...db.suppliers].sort(byName), q, ["name", "contact_name", "phone", "city", "brands"]);
  const bought = new Map();
  for (const e of db.expenses) if (e.supplier_id) bought.set(e.supplier_id, (bought.get(e.supplier_id) || 0) + e.amount);
  const monthBuys = sum(db.expenses.filter((e) => e.category === "achats" && e.date >= monthStart()), (e) => e.amount);
  const open = db.orders.filter((o) => o.status === "envoye");
  const top1 = [...bought.entries()].sort((a, b) => b[1] - a[1])[0];
  const content = html`
${top("Achats et stock", "Fournisseurs", html`<a class="btn primary" href="/gestion/fournisseurs/nouveau/">${gicon("plus")}Nouveau fournisseur</a>`)}
${kpis([
    kpi("Fournisseurs", db.suppliers.length, ""),
    kpi("Achats du mois", mad(monthBuys), "Bons de commande reçus"),
    kpi("Commandes en cours", open.length, mad(sum(open, (o) => orderTotal(db, o)))),
    kpi("Fournisseur principal", top1 ? byId(db, "suppliers", top1[0])?.name : "—", top1 ? mad(top1[1]) : ""),
  ])}
<div class="card">
  <form class="filters" method="get"><input type="search" name="q" value="${q}" placeholder="Nom, contact, marque, ville…"><button class="btn">Rechercher</button></form>
  <div class="table-wrap"><table class="t">
    <thead><tr><th>Fournisseur</th><th>Contact</th><th>Marques</th><th class="num">Articles</th><th class="num">Commandes</th><th class="num">Total acheté</th><th></th></tr></thead>
    <tbody>${list.length ? list.map((s) => html`<tr>
      <td><a href="/gestion/fournisseurs/${s.id}/"><b>${s.name}</b></a><br><span class="small muted">${s.city}</span></td>
      <td>${s.contact_name || "—"}<br><span class="small muted">${s.phone}</span></td>
      <td>${s.brands || "—"}</td>
      <td class="num">${db.products.filter((p) => p.supplier_id === s.id).length}</td>
      <td class="num">${db.orders.filter((o) => o.supplier_id === s.id).length}</td>
      <td class="num">${mad(bought.get(s.id) || 0)}</td>
      <td class="num"><a class="btn sm" href="/gestion/achats/nouveau/?fournisseur=${s.id}">Commander</a></td>
    </tr>`) : html`<tr><td colspan="7" class="empty">Aucun fournisseur. <a href="/gestion/fournisseurs/nouveau/">Ajouter un fournisseur</a></td></tr>`}</tbody>
  </table></div>
</div>`;
  return page(ctx, { title: "Fournisseurs", section: "suppliers", content });
}

async function supplierEdit(ctx, id) {
  const db = ctx.db;
  const supplier = id ? byId(db, "suppliers", id) : null;
  if (id && !supplier) return null;
  let values = supplier ? { ...supplier } : {}, errors = {};
  if (ctx.method === "POST") {
    const read = readForm(SUPPLIER_DEFS, await ctx.form());
    values = read.values; errors = read.errors;
    if (read.ok) {
      const target = supplier || insert(db, "suppliers", { created_at: nowLocal() });
      Object.assign(target, values);
      await ctx.commit();
      ctx.flash("success", `Fournisseur « ${target.name} » enregistré.`);
      return ctx.redirect(`/gestion/fournisseurs/${target.id}/`);
    }
  }
  const orders = supplier ? db.orders.filter((o) => o.supplier_id === supplier.id).sort((a, b) => b.date.localeCompare(a.date) || b.number.localeCompare(a.number)) : [];
  const articles = supplier ? db.products.filter((p) => p.supplier_id === supplier.id) : [];
  const title = supplier ? supplier.name : "Nouveau fournisseur";
  const content = html`
${top(html`<a href="/gestion/fournisseurs/">Fournisseurs</a>`, title, supplier ? html`
  <a class="btn primary" href="/gestion/achats/nouveau/?fournisseur=${supplier.id}">${gicon("plus")}Bon de commande</a>
  <a class="btn" href="/gestion/achats/nouveau/?fournisseur=${supplier.id}&reappro=1">Réapprovisionner ses articles</a>` : "")}
<div class="grid ${supplier ? "g-main" : ""}">
  <form class="card" method="post">
    <h2>Coordonnées</h2>
    <div class="form-grid">${SUPPLIER_DEFS.map((d) => field(d, values, errors, { wide: d.wide }))}</div>
    <div class="form-actions"><a class="btn" href="/gestion/fournisseurs/">Annuler</a><button class="btn primary">Enregistrer</button></div>
  </form>
  ${supplier ? html`<div class="stack">
    <div class="card"><h2>Bons de commande</h2><table class="t"><tbody>${orders.length ? orders.map((o) => html`<tr><td><a href="/gestion/achats/${o.id}/">${o.number}</a><br><span class="small muted">${dmy(o.date)}</span></td><td><span class="badge ${statusClass(o.status)}">${label(ORDER_STATUSES, o.status)}</span></td><td class="num">${mad(orderTotal(db, o))}</td></tr>`)
      : html`<tr><td class="empty">Aucune commande.</td></tr>`}</tbody></table></div>
    <div class="card"><h2>Articles fournis</h2><table class="t"><tbody>${articles.length ? articles.map((p) => html`<tr><td><a href="/gestion/catalogue/${p.id}/">${p.name_fr}</a></td><td class="num">${mad(p.cost_price)}</td><td class="num">stock ${p.stock}</td></tr>`)
      : html`<tr><td class="empty">Choisissez ce fournisseur sur la fiche d'un produit.</td></tr>`}</tbody></table></div>
  </div>` : ""}
</div>`;
  return page(ctx, { title, section: "suppliers", content });
}

export const peopleRoutes = [
  { method: "GET", path: /^\/gestion\/clients\/$/, handler: customers },
  { path: /^\/gestion\/clients\/nouveau\/$/, handler: (ctx) => customerEdit(ctx, null) },
  { path: /^\/gestion\/clients\/(\d+)\/$/, handler: (ctx, id) => customerEdit(ctx, Number(id)) },
  { method: "GET", path: /^\/gestion\/fournisseurs\/$/, handler: suppliers },
  { path: /^\/gestion\/fournisseurs\/nouveau\/$/, handler: (ctx) => supplierEdit(ctx, null) },
  { path: /^\/gestion\/fournisseurs\/(\d+)\/$/, handler: (ctx, id) => supplierEdit(ctx, Number(id)) },
];

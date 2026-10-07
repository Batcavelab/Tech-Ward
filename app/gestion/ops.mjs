// Dashboard, stock, costs and revenue.
import { html } from "../html.mjs";
import { gicon } from "../svg.mjs";
import {
  EXPENSE_CATEGORIES, bestSellers, byId, costs, doneQuotes, insert, label, lowStock, monthStart, monthly,
  moveStock, offerRunning, pct, quoteTotals, remove, revenue, stockValue, sum, today, trend,
} from "../model.mjs";
import { dmy, field, chart, kpi, kpis, mad, page, plural, readForm, statusClass, top } from "./ui.mjs";
import { QUOTE_STATUSES } from "../model.mjs";

const DAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const longDate = (d) => {
  const x = new Date(d + "T12:00:00Z");
  return `${DAYS[x.getUTCDay()]} ${x.getUTCDate()} ${MONTHS[x.getUTCMonth()]} ${x.getUTCFullYear()}`;
};

function rank(rows) {
  const topQty = rows[0]?.qty || 1;
  return html`<ul class="rank">${rows.map((r) => html`<li><span>${r.name}</span><span class="num">${r.qty}</span><span class="bar"><span style="width:${Math.round((r.qty * 100) / topQty)}%"></span></span></li>`)}</ul>`;
}

function dashboard(ctx) {
  const db = ctx.db;
  const thisM = monthStart(), last = monthStart(-1), next = monthStart(1);
  const rev = revenue(db, thisM, next), revLast = revenue(db, last, thisM), cost = costs(db, thisM, next);
  const pending = db.quotes.filter((q) => ["envoye", "accepte"].includes(q.status));
  const lows = lowStock(db);
  const topPacks = bestSellers(db, "pack"), topProducts = bestSellers(db, "product");
  const recent = [...db.quotes].sort((a, b) => b.date.localeCompare(a.date) || b.number.localeCompare(a.number)).slice(0, 6);
  const offers = db.offers.filter((o) => offerRunning(o));
  const openOrders = db.orders.filter((o) => o.status === "envoye").slice(0, 5);
  const best = (r, what, empty) => (r ? html`
      <div class="star"><div class="medal">${gicon("trophy")}</div>
        <div><div class="name">${r.name}</div><div class="muted">${r.qty} vendu${plural(r.qty)} · ${mad(r.amount)}</div></div></div>
      ${rank(what)}` : html`<p class="muted">${empty}</p>`);
  const content = html`
${top(longDate(today()), "Tableau de bord", html`
  <a class="btn primary" href="/gestion/devis/nouveau/">${gicon("plus")}Nouveau devis</a>
  <a class="btn" href="/gestion/achats/nouveau/">${gicon("cart")}Bon de commande</a>
  <a class="btn" href="/gestion/catalogue/nouveau/">${gicon("box")}Produit</a>
  <a class="btn" href="/fr/" target="_blank">${gicon("home")}Voir le site</a>`)}
${kpis([
    kpi("Chiffre d'affaires du mois", mad(rev), trend(rev, revLast) || "Devis réalisés ce mois"),
    kpi("Bénéfice du mois", mad(rev - cost), `Dépenses : ${mad(cost)}`, rev - cost >= 0 ? "good" : "bad"),
    kpi("Devis en attente", pending.length, `${mad(sum(pending, (q) => quoteTotals(db, q).total_ttc))} à confirmer`),
    kpi("Valeur du stock", mad(stockValue(db)), "Au prix d'achat"),
    kpi("À réapprovisionner", lows.length, "Produits sous le seuil d'alerte", lows.length ? "warn" : ""),
  ])}
<div class="grid g2" style="margin-bottom:16px">
  <div class="card">
    <div class="card-head"><h2>Pack le plus vendu</h2><a class="small" href="/gestion/packs/">Tous les packs</a></div>
    ${best(topPacks[0], topPacks, "Aucun pack vendu pour l'instant. Les ventes comptent quand un devis passe en « Réalisé et payé ».")}
  </div>
  <div class="card">
    <div class="card-head"><h2>Produit le plus vendu</h2><a class="small" href="/gestion/catalogue/">Catalogue</a></div>
    ${best(topProducts[0], topProducts, "Aucun produit vendu pour l'instant. Les produits vendus seuls (hors packs) apparaissent ici.")}
  </div>
</div>
<div class="grid g-main">
  <div class="stack">
    <div class="card">
      <div class="card-head"><h2>Chiffre d'affaires et dépenses, 6 derniers mois</h2><a class="small" href="/gestion/finances/">Détail</a></div>
      ${chart(monthly(db, 6))}
    </div>
    <div class="card">
      <div class="card-head"><h2>Derniers devis</h2><a class="small" href="/gestion/devis/">Tous les devis</a></div>
      <div class="table-wrap"><table class="t">
        <thead><tr><th>N°</th><th>Client</th><th>Date</th><th>Statut</th><th class="num">Montant</th></tr></thead>
        <tbody>${recent.length ? recent.map((q) => html`<tr><td><a href="/gestion/devis/${q.id}/">${q.number}</a></td><td>${byId(db, "customers", q.customer_id)?.name}</td><td>${dmy(q.date)}</td><td><span class="badge ${statusClass(q.status)}">${label(QUOTE_STATUSES, q.status)}</span></td><td class="num">${mad(quoteTotals(db, q).total_ttc)}</td></tr>`)
          : html`<tr><td colspan="5" class="empty">Pas encore de devis. <a href="/gestion/devis/nouveau/">Créer le premier</a></td></tr>`}</tbody>
      </table></div>
    </div>
  </div>
  <div class="stack">
    <div class="card">
      <div class="card-head"><h2>Stock à réapprovisionner</h2><a class="small" href="/gestion/stock/?filtre=alerte">Voir</a></div>
      ${lows.length ? html`<table class="t"><tbody>${lows.slice(0, 6).map((p) => html`<tr><td>${p.name_fr}</td><td class="num"><span class="badge ${p.stock <= 0 ? "red" : "warn"}">${p.stock} / seuil ${p.min_stock}</span></td></tr>`)}</tbody></table>
      <div class="form-actions"><a class="btn sm" href="/gestion/achats/nouveau/?reappro=1">Commander ces articles</a></div>`
        : html`<p class="muted">Tout est au-dessus du seuil d'alerte.</p>`}
    </div>
    <div class="card">
      <div class="card-head"><h2>Offres en cours</h2><a class="small" href="/gestion/offres/">Gérer</a></div>
      ${offers.length ? offers.map((o) => {
        const n = db.offerItems.filter((i) => i.offer_id === o.id).length;
        return html`<p style="margin:0 0 8px"><b>${o.name}</b><br><span class="small muted">${n} article${plural(n)}${o.end_date ? ` · jusqu'au ${dmy(o.end_date, { short: true })}` : ""}</span></p>`;
      }) : html`<p class="muted">Aucune offre active.</p>`}
    </div>
    <div class="card">
      <div class="card-head"><h2>Commandes fournisseurs en cours</h2><a class="small" href="/gestion/achats/">Voir</a></div>
      ${openOrders.length ? openOrders.map((o) => html`<p style="margin:0 0 8px"><a href="/gestion/achats/${o.id}/">${o.number}</a> · ${byId(db, "suppliers", o.supplier_id)?.name}${o.expected_date ? html`<br><span class="small muted">Livraison prévue le ${dmy(o.expected_date)}</span>` : ""}</p>`)
        : html`<p class="muted">Aucune commande en attente de livraison.</p>`}
    </div>
  </div>
</div>`;
  return page(ctx, { title: "Tableau de bord", section: "dashboard", content });
}

// ====================================================================== stock
async function stock(ctx) {
  const db = ctx.db;
  const tracked = db.products.filter((p) => p.kind === "product");
  const defs = [
    { name: "product_id", label: "Produit", type: "select", numeric: true, required: true,
      choices: [...tracked].sort((a, b) => a.name_fr.localeCompare(b.name_fr, "fr")).map((p) => [p.id, p.name_fr]) },
    { name: "mode", label: "Type", type: "select", blank: false, choices: [["entree", "Entrée (+)"], ["sortie", "Sortie (−)"], ["ajustement", "Inventaire : stock réel compté"]] },
    { name: "quantity", label: "Quantité", type: "int", min: 0, required: true },
    { name: "reason", label: "Motif", maxlength: 160 },
  ];
  let values = { product_id: Number(ctx.query.get("produit")) || "", mode: "entree" }, errors = {};
  if (ctx.method === "POST") {
    const read = readForm(defs, await ctx.form());
    values = read.values; errors = read.errors;
    if (read.ok) {
      const p = byId(db, "products", values.product_id);
      let qty = values.quantity;
      if (values.mode === "ajustement") qty -= p.stock;
      else if (values.mode === "sortie") qty = -qty;
      if (qty) {
        moveStock(db, p, values.mode, qty, values.reason || defs[1].choices.find((c) => c[0] === values.mode)[1]);
        await ctx.commit();
      }
      ctx.flash("success", `${p.name_fr} : ${qty > 0 ? "+" : ""}${qty} → stock ${p.stock}.`);
      return ctx.redirect("/gestion/stock/");
    }
  }
  const flt = ctx.query.get("filtre") || "", q = (ctx.query.get("q") || "").trim().toLowerCase();
  const catOrder = (p) => byId(db, "categories", p.category_id)?.order ?? -1;
  let list = [...tracked].sort((a, b) => catOrder(a) - catOrder(b) || a.name_fr.localeCompare(b.name_fr, "fr"));
  if (flt === "alerte") list = list.filter((p) => p.stock <= p.min_stock);
  if (q) list = list.filter((p) => [p.name_fr, p.sku, p.location].some((v) => (v || "").toLowerCase().includes(q)));
  const monthMoves = db.movements.filter((m) => m.date >= monthStart());
  const outQty = -monthMoves.filter((m) => m.quantity < 0).reduce((s, m) => s + m.quantity, 0);
  const inQty = monthMoves.filter((m) => m.quantity > 0).reduce((s, m) => s + m.quantity, 0);
  const inStock = tracked.filter((p) => p.stock > 0);
  const out = tracked.filter((p) => p.stock <= 0 && p.active).length;
  const lows = lowStock(db).length;
  const moves = [...db.movements].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id).slice(0, 15);
  const content = html`
${top("Achats et stock", "Stock et entrepôt", html`<a class="btn primary" href="/gestion/achats/nouveau/?reappro=1">Réapprovisionner le stock bas</a>`)}
${kpis([
    kpi("Valeur du stock", mad(stockValue(db)), "Au prix d'achat"),
    kpi("Unités en entrepôt", inStock.reduce((s, p) => s + p.stock, 0), `${inStock.length} références`),
    kpi("En rupture", out, "Stock à zéro", out ? "bad" : ""),
    kpi("Sous le seuil", lows, "À réapprovisionner", lows ? "warn" : ""),
    kpi("Mouvements du mois", `+${inQty} / −${outQty}`, "Entrées / sorties"),
  ])}
<div class="grid g-main">
  <div class="card">
    <form class="filters" method="get">
      <input type="search" name="q" value="${ctx.query.get("q") || ""}" placeholder="Produit, référence, emplacement…">
      <div class="chips"><a href="?" class="${!flt ? "on" : ""}">Tous</a><a href="?filtre=alerte" class="${flt === "alerte" ? "on" : ""}">Sous le seuil</a></div>
    </form>
    <div class="table-wrap"><table class="t">
      <thead><tr><th>Produit</th><th>Emplacement</th><th class="num">Stock</th><th class="num">Seuil</th><th class="num">Prix d'achat</th><th class="num">Valeur</th><th></th></tr></thead>
      <tbody>${list.length ? list.map((p) => html`<tr>
        <td><a href="/gestion/catalogue/${p.id}/">${p.name_fr}</a><br><span class="small muted">${p.sku || p.brand}</span></td>
        <td>${p.location || "—"}</td>
        <td class="num"><span class="badge ${p.stock <= 0 ? "red" : p.stock <= p.min_stock ? "warn" : "green"}">${p.stock}</span></td>
        <td class="num">${p.min_stock}</td><td class="num">${mad(p.cost_price)}</td><td class="num">${mad(p.stock * p.cost_price)}</td>
        <td class="num"><a class="btn sm" href="?produit=${p.id}#ajuster">Ajuster</a></td>
      </tr>`) : html`<tr><td colspan="7" class="empty">Aucun produit.</td></tr>`}</tbody>
    </table></div>
  </div>
  <div class="stack">
    <form class="card" method="post" id="ajuster"><h2>Entrée, sortie ou inventaire</h2>
      <div class="form-grid" style="grid-template-columns:1fr">${defs.map((d) => field(d, values, errors))}</div>
      <p class="small muted">Les réceptions de bons de commande et les devis réalisés mettent le stock à jour tout seuls. Utilisez ce formulaire pour le stock de départ, une casse ou un inventaire.</p>
      <div class="form-actions"><button class="btn primary">Enregistrer</button></div>
    </form>
    <div class="card"><h2>Derniers mouvements</h2><table class="t"><tbody>${moves.length ? moves.map((m) => html`<tr><td><b>${byId(db, "products", m.product_id)?.name_fr}</b><br><span class="small muted">${dmy(m.date, { time: true, short: true })} · ${m.reason}</span></td><td class="num"><span class="badge ${m.quantity > 0 ? "green" : "red"}">${m.quantity > 0 ? "+" : ""}${m.quantity}</span></td></tr>`)
      : html`<tr><td class="empty">Aucun mouvement.</td></tr>`}</tbody></table></div>
  </div>
</div>`;
  return page(ctx, { title: "Stock", section: "stock", content });
}

// ====================================================================== finances
function expenseDefs(db) {
  return [
    { name: "date", label: "Date", type: "date", required: true },
    { name: "category", label: "Catégorie", type: "select", blank: false, choices: EXPENSE_CATEGORIES },
    { name: "label", label: "Libellé", required: true, maxlength: 160 },
    { name: "amount", label: "Montant (MAD)", type: "money", required: true },
    { name: "supplier_id", label: "Fournisseur", type: "select", numeric: true,
      choices: [...db.suppliers].sort((a, b) => a.name.localeCompare(b.name, "fr")).map((s) => [s.id, s.name]) },
  ];
}

async function finances(ctx) {
  const db = ctx.db, defs = expenseDefs(db);
  let values = { date: today(), category: "autre" }, errors = {};
  if (ctx.method === "POST") {
    const read = readForm(defs, await ctx.form());
    values = read.values; errors = read.errors;
    if (read.ok) {
      insert(db, "expenses", { ...values, purchase_order_id: null });
      await ctx.commit();
      ctx.flash("success", "Dépense ajoutée.");
      return ctx.redirect("/gestion/finances/");
    }
  }
  const thisM = monthStart(), next = monthStart(1), year = today().slice(0, 4) + "-01-01";
  const rev = revenue(db, thisM, next), cost = costs(db, thisM, next);
  const revY = revenue(db, year), costY = costs(db, year);
  const cogs = sum(doneQuotes(db, thisM, next), (q) => quoteTotals(db, q).cost);
  const months = monthly(db, 12).map((m) => ({ ...m, profit: m.revenue - m.costs }));
  const byCat = new Map();
  for (const e of db.expenses.filter((x) => x.date >= year)) byCat.set(e.category, (byCat.get(e.category) || 0) + e.amount);
  const cats = [...byCat.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: label(EXPENSE_CATEGORIES, k), total: v, pct: pct(v, costY) }));
  const expenses = [...db.expenses].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id).slice(0, 30);
  const content = html`
${top("Pilotage", "Coûts et revenus")}
${kpis([
    kpi("CA du mois", mad(rev), "Devis réalisés (HT)"),
    kpi("Dépenses du mois", mad(cost), "Achats et frais"),
    kpi("Bénéfice du mois", mad(rev - cost), rev ? `Marge ${pct(rev - cost, rev)} %` : "", rev - cost >= 0 ? "good" : "bad"),
    kpi("Marge brute du mois", mad(rev - cogs), "CA moins coût du matériel vendu"),
    kpi(`Bénéfice ${year.slice(0, 4)}`, mad(revY - costY), `CA ${mad(revY)} · dépenses ${mad(costY)}`, revY - costY >= 0 ? "good" : "bad"),
  ])}
<div class="grid g-main">
  <div class="stack">
    <div class="card"><div class="card-head"><h2>6 derniers mois</h2></div>${chart(months.slice(-6))}</div>
    <div class="card"><h2>12 derniers mois</h2><div class="table-wrap"><table class="t">
      <thead><tr><th>Mois</th><th class="num">Chiffre d'affaires</th><th class="num">Dépenses</th><th class="num">Bénéfice</th></tr></thead>
      <tbody>${[...months].reverse().map((m) => html`<tr><td>${m.label}</td><td class="num">${mad(m.revenue)}</td><td class="num">${mad(m.costs)}</td><td class="num" style="color:${m.profit < 0 ? "var(--bad)" : "var(--good)"}"><b>${mad(m.profit)}</b></td></tr>`)}</tbody>
    </table></div></div>
    <div class="card"><h2>Dernières dépenses</h2><div class="table-wrap"><table class="t">
      <thead><tr><th>Date</th><th>Libellé</th><th>Catégorie</th><th class="num">Montant</th></tr></thead>
      <tbody>${expenses.length ? expenses.map((e) => {
        const s = byId(db, "suppliers", e.supplier_id);
        return html`<tr><td>${dmy(e.date)}</td><td><a href="/gestion/finances/depense/${e.id}/">${e.label}</a>${s ? html`<br><span class="small muted">${s.name}</span>` : ""}</td><td>${label(EXPENSE_CATEGORIES, e.category)}</td><td class="num">${mad(e.amount)}</td></tr>`;
      }) : html`<tr><td colspan="4" class="empty">Aucune dépense enregistrée.</td></tr>`}</tbody>
    </table></div></div>
  </div>
  <div class="stack">
    <form class="card" method="post"><h2>Ajouter une dépense</h2>
      <div class="form-grid" style="grid-template-columns:1fr">${defs.map((d) => field(d, values, errors))}</div>
      <p class="small muted">Les achats fournisseurs sont ajoutés tout seuls à la réception d'un bon de commande.</p>
      <div class="form-actions"><button class="btn primary">Ajouter</button></div>
    </form>
    <div class="card"><h2>Dépenses de l'année par catégorie</h2>
      ${cats.length ? html`<ul class="rank">${cats.map((c) => html`<li><span>${c.label}</span><span class="num">${mad(c.total)}</span><span class="bar"><span style="width:${c.pct}%;background:var(--cost)"></span></span></li>`)}</ul>`
        : html`<p class="muted">Aucune dépense cette année.</p>`}
    </div>
  </div>
</div>`;
  return page(ctx, { title: "Coûts et revenus", section: "finances", content });
}

async function expenseEdit(ctx, id) {
  const db = ctx.db, expense = byId(db, "expenses", id);
  if (!expense) return null;
  const defs = expenseDefs(db);
  let values = { ...expense }, errors = {};
  if (ctx.method === "POST") {
    const form = await ctx.form();
    if (form.get("delete")) {
      remove(db, "expenses", (e) => e.id === expense.id);
      await ctx.commit();
      ctx.flash("success", "Dépense supprimée.");
      return ctx.redirect("/gestion/finances/");
    }
    const read = readForm(defs, form);
    values = read.values; errors = read.errors;
    if (read.ok) {
      Object.assign(expense, values);
      await ctx.commit();
      ctx.flash("success", "Dépense modifiée.");
      return ctx.redirect("/gestion/finances/");
    }
  }
  const order = expense.purchase_order_id ? byId(db, "orders", expense.purchase_order_id) : null;
  const content = html`
${top(html`<a href="/gestion/finances/">Coûts et revenus</a>`, expense.label)}
<form class="card" method="post" style="max-width:640px">
  ${order ? html`<p class="note info">Dépense créée par le bon de commande <a href="/gestion/achats/${order.id}/">${order.number}</a>.</p>` : ""}
  <div class="form-grid">${defs.map((d) => field(d, values, errors))}</div>
  <div class="form-actions"><button class="btn danger" name="delete" value="1" formnovalidate data-confirm="Supprimer cette dépense ?">Supprimer</button><a class="btn" href="/gestion/finances/">Annuler</a><button class="btn primary">Enregistrer</button></div>
</form>`;
  return page(ctx, { title: "Dépense", section: "finances", content });
}

export const opsRoutes = [
  { method: "GET", path: /^\/gestion\/$/, handler: dashboard },
  { path: /^\/gestion\/stock\/$/, handler: stock },
  { path: /^\/gestion\/finances\/$/, handler: finances },
  { path: /^\/gestion\/finances\/depense\/(\d+)\/$/, handler: (ctx, id) => expenseEdit(ctx, Number(id)) },
];


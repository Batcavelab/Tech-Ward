// Bons de commande: list, edit, detail, PDF, status ("Reçu" puts goods in stock and records the expense).
import { html, jsonScript, raw } from "../html.mjs";
import { gicon } from "../svg.mjs";
import {
  ORDER_STATUSES, byId, insert, label, lowStock, monthStart, nextNumber, nowLocal, orderLinesOf, orderTotal, receiveOrder,
  remove, siteInfo, sum, today, waNumber,
} from "../model.mjs";
import { buildPdf } from "../pdf.mjs";
import { companyBlock, pdfResponse } from "./quotes.mjs";
import { dmy, field, input, kpi, kpis, mad, page, readForm, readRows, statusClass, toNum, top } from "./ui.mjs";

function orders(ctx) {
  const db = ctx.db;
  const status = ctx.query.get("statut") || "", q = (ctx.query.get("q") || "").trim().toLowerCase();
  const sup = (o) => byId(db, "suppliers", o.supplier_id) || {};
  let list = [...db.orders].sort((a, b) => b.date.localeCompare(a.date) || b.number.localeCompare(a.number));
  if (status) list = list.filter((o) => o.status === status);
  if (q) list = list.filter((o) => [o.number, sup(o).name].some((v) => (v || "").toLowerCase().includes(q)));
  const open = db.orders.filter((o) => o.status === "envoye");
  const received = db.orders.filter((o) => o.status === "recu" && o.received_date >= monthStart());
  const late = open.filter((o) => o.expected_date && o.expected_date < today());
  const total = (o) => orderTotal(db, o);
  const content = html`
${top("Achats et stock", "Bons de commande", html`<a class="btn primary" href="/gestion/achats/nouveau/">${gicon("plus")}Nouveau bon de commande</a>
  <a class="btn" href="/gestion/achats/nouveau/?reappro=1">Réapprovisionner le stock bas</a>`)}
${kpis([
    kpi("Commandes en cours", open.length, mad(sum(open, total))),
    kpi("En retard", late.length, "Date de livraison dépassée", late.length ? "warn" : ""),
    kpi("Reçues ce mois", received.length, mad(sum(received, total))),
    kpi("Brouillons", db.orders.filter((o) => o.status === "brouillon").length, "À envoyer"),
  ])}
<div class="card">
  <form class="filters" method="get">
    <input type="search" name="q" value="${ctx.query.get("q") || ""}" placeholder="N°, fournisseur…">
    <div class="chips"><a href="?" class="${!status ? "on" : ""}">Tous</a>${ORDER_STATUSES.map(([k, v]) => html`<a href="?statut=${k}" class="${status === k ? "on" : ""}">${v}</a>`)}</div>
  </form>
  <div class="table-wrap"><table class="t">
    <thead><tr><th>N°</th><th>Fournisseur</th><th>Date</th><th>Livraison</th><th>Statut</th><th class="num">Total</th><th></th></tr></thead>
    <tbody>${list.length ? list.map((o) => html`<tr>
      <td><a href="/gestion/achats/${o.id}/"><b>${o.number}</b></a></td><td>${sup(o).name}</td>
      <td>${dmy(o.date)}</td><td>${o.received_date ? `Reçu le ${dmy(o.received_date)}` : dmy(o.expected_date) || "—"}</td>
      <td><span class="badge ${statusClass(o.status)}">${label(ORDER_STATUSES, o.status)}</span></td>
      <td class="num"><b>${mad(total(o))}</b></td><td class="num"><a class="btn sm" href="/gestion/achats/${o.id}/pdf/" target="_blank">PDF</a></td>
    </tr>`) : html`<tr><td colspan="7" class="empty">Aucun bon de commande.</td></tr>`}</tbody>
  </table></div>
</div>`;
  return page(ctx, { title: "Bons de commande", section: "orders", content });
}

async function orderEdit(ctx, id) {
  const db = ctx.db;
  const order = id ? byId(db, "orders", id) : null;
  if (id && !order) return null;
  if (order?.status === "recu") {
    ctx.flash("info", "Ce bon de commande est déjà reçu : il ne peut plus être modifié.");
    return ctx.redirect(`/gestion/achats/${order.id}/`);
  }
  const defs = [
    { name: "supplier_id", label: "Fournisseur", type: "select", numeric: true, required: true,
      choices: [...db.suppliers].sort((a, b) => a.name.localeCompare(b.name, "fr")).map((s) => [s.id, s.name]) },
    { name: "date", label: "Date", type: "date", required: true },
    { name: "expected_date", label: "Livraison souhaitée", type: "date" },
    { name: "notes", label: "Notes pour le fournisseur", type: "textarea", rows: 3 },
  ];
  const fournisseur = Number(ctx.query.get("fournisseur")) || "";
  let values = order ? { ...order } : { supplier_id: fournisseur, date: today(), notes: "" };
  let errors = {};
  let lines = order ? orderLinesOf(db, order) : [];
  if (!order && ctx.query.get("reappro")) {
    // Pre-fill with every product under its alert level.
    lines = lowStock(db).filter((p) => !fournisseur || p.supplier_id === fournisseur)
      .map((p) => ({ product_id: p.id, quantity: Math.max(p.min_stock * 2 - p.stock, 1), unit_cost: p.cost_price }));
  }
  if (ctx.method === "POST") {
    const form = await ctx.form();
    const read = readForm(defs, form);
    values = read.values; errors = read.errors;
    const newLines = [];
    for (const r of readRows(form, "lines")) {
      if (r.DELETE || !r.product_id) continue;
      const p = byId(db, "products", r.product_id);
      if (!p) continue;
      const cost = toNum(r.unit_cost);
      newLines.push({ product_id: p.id, quantity: Math.max(1, parseInt(r.quantity, 10) || 1),
        unit_cost: cost !== null ? Math.round(cost * 100) / 100 : p.cost_price || 0 });
    }
    lines = newLines;
    if (read.ok) {
      const target = order || insert(db, "orders", { number: nextNumber(db.orders, "BC"), status: "brouillon", received_date: null, created_at: nowLocal() });
      Object.assign(target, values);
      remove(db, "orderLines", (l) => l.order_id === target.id);
      for (const l of newLines) insert(db, "orderLines", { order_id: target.id, ...l });
      await ctx.commit();
      ctx.flash("success", `Bon de commande ${target.number} enregistré.`);
      return ctx.redirect(`/gestion/achats/${target.id}/`);
    }
  }
  const choices = db.products.filter((p) => p.kind === "product").sort((a, b) => a.name_fr.localeCompare(b.name_fr, "fr")).map((p) => [p.id, p.name_fr]);
  const costs = Object.fromEntries(db.products.map((p) => [p.id, p.cost_price || 0]));
  const rows = [...lines, ...Array(lines.length ? 1 : 4).fill({ quantity: "" })];
  const f = (name, opts) => field(defs.find((d) => d.name === name), values, errors, opts);
  const title = order ? `Modifier ${order.number}` : "Nouveau bon de commande";
  const content = html`
${top(html`<a href="/gestion/achats/">Bons de commande</a>`, title, html`<a class="btn" href="/gestion/fournisseurs/nouveau/">${gicon("plus")}Nouveau fournisseur</a>`)}
<form method="post">
  ${Object.keys(errors).length ? html`<div class="note">Corrigez les champs en rouge.</div>` : ""}
  <div class="card"><div class="form-grid">${f("supplier_id")}${f("date")}${f("expected_date")}</div></div>
  <div class="card"><h2>Articles à commander</h2>
    <div class="table-wrap"><table class="t lines" id="lines"><thead><tr><th style="min-width:260px">Produit</th><th style="width:90px">Qté</th><th style="width:170px">Prix d'achat unitaire</th><th class="num" style="width:130px">Total</th><th class="del">Retirer</th></tr></thead><tbody>
    ${rows.map((l, n) => {
      const p = `lines-${n}-`;
      return html`<tr><td>${input({ name: "product_id", type: "select", choices }, l.product_id, { prefix: p })}</td>
      <td>${input({ name: "quantity", type: "int", min: 1 }, l.quantity, { prefix: p })}</td>
      <td>${input({ name: "unit_cost", type: "money" }, l.unit_cost, { prefix: p })}</td>
      <td class="num line-total">—</td><td class="del">${l.product_id ? html`<input type="checkbox" name="${p}DELETE">` : ""}</td></tr>`;
    })}
    </tbody></table></div>
    <div class="form-actions" style="justify-content:space-between;margin-top:8px"><button type="button" class="btn sm" id="add-line">Ajouter une ligne</button><b>Total : <span id="t-total">—</span></b></div>
    <div class="form-grid" style="margin-top:12px">${f("notes", { wide: true })}</div>
  </div>
  <div class="form-actions"><a class="btn" href="${order ? `/gestion/achats/${order.id}/` : "/gestion/achats/"}">Annuler</a><button class="btn primary">Enregistrer</button></div>
</form>
${jsonScript(costs, "costs")}`;
  const scripts = raw(`<script>
(function () {
  var costs = JSON.parse(document.getElementById("costs").textContent);
  var table = document.getElementById("lines");
  function fmt(n) { return n.toLocaleString("fr-FR", {maximumFractionDigits: 2}) + " MAD"; }
  function num(el) { return parseFloat((el && el.value || "0").replace(",", ".")) || 0; }
  function recalc() {
    var total = 0;
    table.querySelectorAll("tbody tr").forEach(function (tr) {
      var del = tr.querySelector("[name$=DELETE]");
      var t = (del && del.checked) ? 0 : num(tr.querySelector("[name$=quantity]")) * num(tr.querySelector("[name$=unit_cost]"));
      tr.querySelector(".line-total").textContent = t ? fmt(t) : "—"; total += t;
    });
    document.getElementById("t-total").textContent = fmt(total);
  }
  document.addEventListener("change", function (e) {
    if (e.target.name && /-product_id$/.test(e.target.name)) {
      var tr = e.target.closest("tr"), c = costs[e.target.value];
      if (c !== undefined) tr.querySelector("[name$=unit_cost]").value = c;
      var qty = tr.querySelector("[name$=quantity]"); if (!qty.value) qty.value = 1;
    }
    recalc();
  });
  document.addEventListener("input", recalc);
  document.getElementById("add-line").addEventListener("click", function () {
    var rows = table.querySelectorAll("tbody tr"), clone = rows[rows.length - 1].cloneNode(true), n = rows.length;
    clone.querySelectorAll("input, select").forEach(function (el) {
      if (el.type === "checkbox") { el.remove(); return; }
      el.name = el.name.replace(/-\\d+-/, "-" + n + "-"); el.id = el.id.replace(/-\\d+-/, "-" + n + "-");
      el.value = el.name.endsWith("quantity") ? 1 : "";
    });
    table.querySelector("tbody").appendChild(clone); recalc();
  });
  recalc();
})();
</script>`);
  return page(ctx, { title, section: "orders", content, scripts });
}

function orderDetail(ctx, id) {
  const db = ctx.db, order = byId(db, "orders", id);
  if (!order) return null;
  const s = byId(db, "suppliers", order.supplier_id) || {};
  const lines = orderLinesOf(db, order).map((l) => ({ ...l, product: byId(db, "products", l.product_id) || { name_fr: "?" } }));
  const total = orderTotal(db, order);
  const items = lines.map((l) => `- ${l.quantity} × ${l.product.name_fr}`).join("\n");
  const text = `Bonjour ${s.contact_name || s.name},\n\nVoici notre bon de commande N° ${order.number} :\n${items}\n\n`
    + `Total : ${mad(total)}. Le bon de commande (PDF) est joint.\nMerci de confirmer la disponibilité et le délai de livraison.\n\n`
    + `Tech-Ward · ${siteInfo(db).phone_display}`;
  const waUrl = `https://wa.me/${waNumber(s.phone)}?text=${encodeURIComponent(text)}`;
  const mailUrl = `mailto:${s.email || ""}?subject=${encodeURIComponent(`Bon de commande Tech-Ward ${order.number}`)}&body=${encodeURIComponent(text)}`;
  const received = order.status === "recu";
  const content = html`
${top(html`<a href="/gestion/achats/">Bons de commande</a>`, html`${order.number} <span class="badge ${statusClass(order.status)}" style="vertical-align:middle">${label(ORDER_STATUSES, order.status)}</span>`, html`
  <a class="btn" href="/gestion/achats/${order.id}/pdf/" target="_blank">${gicon("pdf")}Voir le PDF</a>
  <form class="inline" method="post" action="/gestion/achats/${order.id}/statut/" id="wa-form"><input type="hidden" name="status" value="${order.status === "brouillon" ? "envoye" : order.status}"><input type="hidden" name="url" value="${waUrl}">
    <button class="btn wa"${!s.phone ? raw(' disabled title="Ajoutez un téléphone sur la fiche fournisseur"') : ""}>${gicon("wa")}Envoyer par WhatsApp</button></form>
  <a class="btn" href="${mailUrl}" id="mail-link">${gicon("mail")}Email</a>
  ${!received ? html`<a class="btn" href="/gestion/achats/${order.id}/modifier/">${gicon("edit")}Modifier</a>` : ""}`)}
<div class="grid g-main">
  <div class="card">
    <div class="doc-head">
      <div><div class="k">Fournisseur</div><div class="v"><a href="/gestion/fournisseurs/${s.id}/">${s.name}</a></div><div class="small muted">${s.phone} ${s.email}</div></div>
      <div><div class="k">Date</div><div class="v">${dmy(order.date)}</div></div>
      <div><div class="k">${order.received_date ? "Reçu le" : "Livraison souhaitée"}</div><div class="v">${order.received_date ? dmy(order.received_date) : dmy(order.expected_date) || "—"}</div></div>
    </div>
    <div class="table-wrap"><table class="t">
      <thead><tr><th>Article</th><th class="num">Qté</th><th class="num">Prix unitaire</th><th class="num">Total</th></tr></thead>
      <tbody>${lines.length ? lines.map((l) => html`<tr><td>${l.product.name_fr}</td><td class="num">${l.quantity}</td><td class="num">${mad(l.unit_cost)}</td><td class="num">${mad(l.quantity * l.unit_cost)}</td></tr>`)
        : html`<tr><td colspan="4" class="empty">Aucune ligne.</td></tr>`}</tbody>
      <tfoot><tr><td colspan="3">Total</td><td class="num">${mad(total)}</td></tr></tfoot>
    </table></div>
    ${order.notes ? html`<p class="small" style="white-space:pre-line"><b>Notes :</b> ${order.notes}</p>` : ""}
  </div>
  <div class="card"><h2>Suivi</h2>
    ${received ? html`<p class="note info">Marchandise reçue : le stock, les prix d'achat et les dépenses ont été mis à jour.</p>` : html`
    <form method="post" action="/gestion/achats/${order.id}/statut/" class="steps">
      ${[["brouillon", "Brouillon"], ["envoye", "Envoyé"], ["annule", "Annulé"]].map(([k, v]) => html`<button name="status" value="${k}" class="${order.status === k ? "on" : ""}">${v}</button>`)}
    </form>
    <form method="post" action="/gestion/achats/${order.id}/statut/" style="margin-top:14px">
      <button class="btn primary" name="status" value="recu" data-confirm="Confirmer la réception ? Les quantités seront ajoutées au stock et le montant compté en dépense.">Marchandise reçue</button>
    </form>
    <p class="small muted">« Marchandise reçue » ajoute les quantités au stock, met à jour les prix d'achat et enregistre la dépense.</p>`}
  </div>
</div>`;
  const scripts = raw(`<script>
function downloadPdf() { var a = document.createElement("a"); a.href = "/gestion/achats/${order.id}/pdf/?dl=1"; a.download = ""; document.body.appendChild(a); a.click(); a.remove(); }
document.getElementById("wa-form").addEventListener("submit", function () { downloadPdf(); this.target = "_blank"; setTimeout(function () { location.reload(); }, 1500); });
var mail = document.getElementById("mail-link"); if (mail) mail.addEventListener("click", downloadPdf);
</script>`);
  return page(ctx, { title: order.number, section: "orders", content, scripts });
}

function orderPdf(ctx, id) {
  const db = ctx.db, order = byId(db, "orders", id);
  if (!order) return null;
  const s = byId(db, "suppliers", order.supplier_id) || {};
  const lines = orderLinesOf(db, order).map((l) => {
    const p = byId(db, "products", l.product_id) || { name_fr: "?" };
    return [p.name_fr + (p.sku ? ` (${p.sku})` : ""), String(l.quantity), mad(l.unit_cost), mad(l.quantity * l.unit_cost)];
  });
  const meta = [`Date : ${dmy(order.date)}`];
  if (order.expected_date) meta.push(`Livraison souhaitée : ${dmy(order.expected_date)}`);
  const bytes = buildPdf({
    title: "Bon de commande", number: order.number, company: companyBlock(db),
    partyTitle: "FOURNISSEUR", party: [s.name || "", s.contact_name, s.address, s.city, s.phone, s.email],
    meta, head: ["Article", "Qté", "Prix unitaire", "Total"], lines,
    totals: [["Total", mad(orderTotal(db, order)), true]], notes: order.notes || "",
    conditions: ["Merci de confirmer la disponibilité, les prix et le délai de livraison.",
      `Livraison et facture au nom de ${siteInfo(db).name}.`],
  });
  return pdfResponse(ctx, bytes, `BC-${order.number}.pdf`);
}

async function orderStatus(ctx, id) {
  const db = ctx.db, order = byId(db, "orders", id);
  if (!order) return null;
  const form = await ctx.form();
  const status = form.get("status");
  if (status === "recu") {
    receiveOrder(db, order);
    await ctx.commit();
    ctx.flash("success", `${order.number} reçu : stock, prix d'achat et dépenses mis à jour.`);
  } else if (["envoye", "annule", "brouillon"].includes(status) && order.status !== "recu" && status !== order.status) {
    order.status = status;
    await ctx.commit();
    ctx.flash("success", `${order.number} : ${label(ORDER_STATUSES, status)}.`);
  }
  const url = String(form.get("url") || "");
  return ctx.redirect(url.startsWith("https://wa.me/") ? url : `/gestion/achats/${order.id}/`);
}

export const orderRoutes = [
  { method: "GET", path: /^\/gestion\/achats\/$/, handler: orders },
  { path: /^\/gestion\/achats\/nouveau\/$/, handler: (ctx) => orderEdit(ctx, null) },
  { method: "GET", path: /^\/gestion\/achats\/(\d+)\/$/, handler: (ctx, id) => orderDetail(ctx, Number(id)) },
  { path: /^\/gestion\/achats\/(\d+)\/modifier\/$/, handler: (ctx, id) => orderEdit(ctx, Number(id)) },
  { method: "GET", path: /^\/gestion\/achats\/(\d+)\/pdf\/$/, handler: (ctx, id) => orderPdf(ctx, Number(id)) },
  { method: "POST", path: /^\/gestion\/achats\/(\d+)\/statut\/$/, handler: (ctx, id) => orderStatus(ctx, Number(id)) },
];

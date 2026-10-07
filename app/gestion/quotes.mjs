// Devis: list, edit with lines, detail, PDF, status (stock out when "Réalisé et payé"), WhatsApp, duplicate.
import { html, jsonScript, raw } from "../html.mjs";
import { gicon } from "../svg.mjs";
import {
  DEFAULTS, QUOTE_STATUSES, addDays, byId, doneQuotes, insert, label, monthStart, nextNumber, nowLocal, pct, quoteLinesOf,
  quoteTotals, remove, revenue, setQuoteStatus, siteInfo, sum, today, unitCost, waNumber,
} from "../model.mjs";
import { buildPdf } from "../pdf.mjs";
import { dmy, field, input, kpi, kpis, mad, page, readForm, readRows, statusClass, toNum, top } from "./ui.mjs";

const newest = (a, b) => b.date.localeCompare(a.date) || b.number.localeCompare(a.number);

function quotes(ctx) {
  const db = ctx.db;
  const status = ctx.query.get("statut") || "", q = (ctx.query.get("q") || "").trim().toLowerCase();
  const cust = (x) => byId(db, "customers", x.customer_id) || {};
  let list = [...db.quotes].sort(newest);
  if (status) list = list.filter((x) => x.status === status);
  if (q) list = list.filter((x) => [x.number, cust(x).name, cust(x).phone].some((v) => (v || "").toLowerCase().includes(q)));
  const ttc = (x) => quoteTotals(db, x).total_ttc;
  const month = db.quotes.filter((x) => x.date >= monthStart());
  const decided = db.quotes.filter((x) => ["accepte", "realise", "refuse"].includes(x.status)).length;
  const won = db.quotes.filter((x) => ["accepte", "realise"].includes(x.status)).length;
  const pending = db.quotes.filter((x) => ["envoye", "accepte"].includes(x.status));
  const content = html`
${top("Ventes", "Devis", html`<a class="btn primary" href="/gestion/devis/nouveau/">${gicon("plus")}Nouveau devis</a>`)}
${kpis([
    kpi("Devis ce mois", month.length, mad(sum(month, ttc))),
    kpi("En attente de réponse", pending.length, mad(sum(pending, ttc))),
    kpi("Taux d'acceptation", `${pct(won, decided)} %`, `${won} acceptés sur ${decided} décidés`),
    kpi("Réalisés ce mois", doneQuotes(db, monthStart()).length, mad(revenue(db, monthStart()))),
    kpi("Brouillons", db.quotes.filter((x) => x.status === "brouillon").length, "À envoyer"),
  ])}
<div class="card">
  <form class="filters" method="get">
    <input type="search" name="q" value="${ctx.query.get("q") || ""}" placeholder="N°, client, téléphone…">
    <div class="chips"><a href="?" class="${!status ? "on" : ""}">Tous</a>${QUOTE_STATUSES.map(([k, v]) => html`<a href="?statut=${k}" class="${status === k ? "on" : ""}">${v}</a>`)}</div>
  </form>
  <div class="table-wrap"><table class="t">
    <thead><tr><th>N°</th><th>Client</th><th>Date</th><th>Validité</th><th>Statut</th><th class="num">Marge</th><th class="num">Total</th><th></th></tr></thead>
    <tbody>${list.length ? list.map((x) => {
      const tot = quoteTotals(db, x);
      return html`<tr>
      <td><a href="/gestion/devis/${x.id}/"><b>${x.number}</b></a></td>
      <td>${cust(x).name}<br><span class="small muted">${cust(x).phone}</span></td>
      <td>${dmy(x.date)}</td><td>${dmy(x.valid_until)}</td>
      <td><span class="badge ${statusClass(x.status)}">${label(QUOTE_STATUSES, x.status)}</span></td>
      <td class="num">${mad(tot.margin)}</td><td class="num"><b>${mad(tot.total_ttc)}</b></td>
      <td class="num"><a class="btn sm" href="/gestion/devis/${x.id}/pdf/" target="_blank">PDF</a></td>
    </tr>`;
    }) : html`<tr><td colspan="8" class="empty">Aucun devis.</td></tr>`}</tbody>
  </table></div>
</div>`;
  return page(ctx, { title: "Devis", section: "quotes", content });
}

function quoteDefs(db) {
  return [
    { name: "customer_id", label: "Client", type: "select", numeric: true, required: true,
      choices: [...db.customers].sort((a, b) => a.name.localeCompare(b.name, "fr")).map((c) => [c.id, c.name]) },
    { name: "date", label: "Date", type: "date", required: true },
    { name: "valid_until", label: "Valable jusqu'au", type: "date" },
    { name: "discount", label: "Remise (MAD)", type: "money", min: 0, default: 0 },
    { name: "tva_rate", label: "TVA (%)", type: "number", step: "0.1", min: 0, default: 0 },
    { name: "notes", label: "Notes pour le client", type: "textarea", rows: 3 },
  ];
}

async function quoteEdit(ctx, id) {
  const db = ctx.db;
  const quote = id ? byId(db, "quotes", id) : null;
  if (id && !quote) return null;
  const defs = quoteDefs(db);
  let values = quote ? { ...quote } : { customer_id: Number(ctx.query.get("client")) || "", date: today(), discount: 0, tva_rate: DEFAULTS.tva, notes: "" };
  let errors = {};
  let lines = quote ? quoteLinesOf(db, quote) : [];
  if (ctx.method === "POST") {
    const form = await ctx.form();
    const read = readForm(defs, form);
    values = read.values; errors = read.errors;
    const old = new Map(lines.map((l) => [l.id, l]));
    const newLines = [];
    for (const r of readRows(form, "lines")) {
      if (r.DELETE) continue;
      const product = r.product_id ? byId(db, "products", r.product_id) : null;
      if (!product && !r.description) continue;
      const prev = old.get(Number(r.id));
      const qty = Math.max(1, parseInt(r.quantity, 10) || 1);
      const price = toNum(r.unit_price);
      newLines.push({
        id: prev ? prev.id : undefined,
        product_id: product ? product.id : null,
        description: (r.description || product?.name_fr || "").slice(0, 200),
        quantity: qty,
        unit_price: price !== null ? Math.round(price * 100) / 100 : product?.price ?? 0,
        unit_cost: prev && prev.product_id === (product?.id ?? null) && prev.unit_cost ? prev.unit_cost : product ? unitCost(db, product) : 0,
      });
    }
    lines = newLines;
    if (read.ok) {
      const target = quote || insert(db, "quotes", { number: nextNumber(db.quotes, "DV"), status: "brouillon", stock_done: false,
        done_date: null, created_at: nowLocal() });
      // A finished devis: put its goods back, then take the new ones.
      const redo = target.stock_done;
      if (redo) setQuoteStatus(db, target, "accepte");
      Object.assign(target, values);
      if (!target.valid_until) target.valid_until = addDays(target.date, 15);
      remove(db, "quoteLines", (l) => l.quote_id === target.id);
      for (const l of newLines) {
        const { id: lineId, ...rest } = l;
        if (lineId) { db.quoteLines.push({ id: lineId, quote_id: target.id, ...rest }); } else insert(db, "quoteLines", { quote_id: target.id, ...rest });
      }
      if (redo) setQuoteStatus(db, target, "realise");
      await ctx.commit();
      ctx.flash("success", `Devis ${target.number} enregistré.`);
      return ctx.redirect(`/gestion/devis/${target.id}/`);
    }
  }
  const productChoices = [...db.products].sort((a, b) => a.kind.localeCompare(b.kind) || a.name_fr.localeCompare(b.name_fr, "fr"))
    .map((p) => [p.id, p.name_fr]);
  const prices = Object.fromEntries(db.products.map((p) => [p.id, { price: p.price ?? "", name: p.name_fr }]));
  const rows = [...lines, ...Array(lines.length ? 1 : 4).fill({ quantity: "" })];
  const f = (name, opts) => field(defs.find((d) => d.name === name), values, errors, opts);
  const title = quote ? `Modifier le devis ${quote.number}` : "Nouveau devis";
  const content = html`
${top(html`<a href="/gestion/devis/">Devis</a>`, title, html`<a class="btn" href="/gestion/clients/nouveau/?next=devis">${gicon("plus")}Nouveau client</a>`)}
<form method="post">
  ${Object.keys(errors).length ? html`<div class="note">Corrigez les champs en rouge.</div>` : ""}
  <div class="card"><div class="form-grid">${f("customer_id")}${f("date")}${f("valid_until")}</div></div>
  <div class="card"><h2>Lignes du devis</h2>
    <div class="table-wrap"><table class="t lines" id="lines"><thead><tr><th style="min-width:220px">Produit / pack / service</th><th style="min-width:220px">Désignation sur le devis</th><th style="width:80px">Qté</th><th style="width:140px">Prix unitaire</th><th class="num" style="width:120px">Total</th><th class="del">Retirer</th></tr></thead><tbody>
    ${rows.map((l, n) => {
      const p = `lines-${n}-`;
      return html`<tr>${l.id ? html`<input type="hidden" name="${p}id" value="${l.id}">` : ""}
      <td>${input({ name: "product_id", type: "select", choices: productChoices }, l.product_id, { prefix: p })}</td>
      <td>${input({ name: "description", maxlength: 200 }, l.description, { prefix: p })}</td>
      <td>${input({ name: "quantity", type: "int", min: 1 }, l.quantity, { prefix: p })}</td>
      <td>${input({ name: "unit_price", type: "money" }, l.unit_price, { prefix: p })}</td>
      <td class="num line-total">—</td><td class="del">${l.id ? html`<input type="checkbox" name="${p}DELETE">` : ""}</td></tr>`;
    })}
    </tbody></table></div>
    <div class="form-actions" style="justify-content:flex-start;margin-top:8px"><button type="button" class="btn sm" id="add-line">${gicon("plus")}Ajouter une ligne</button></div>
    <div class="grid g2" style="margin-top:12px">
      <div class="form-grid" style="grid-template-columns:1fr 1fr;align-content:start">${f("discount")}${f("tva_rate")}${f("notes", { wide: true })}</div>
      <div class="totals"><div><span>Sous-total</span><span id="t-sub">—</span></div><div><span>Remise</span><span id="t-disc">—</span></div><div><span>TVA</span><span id="t-tva">—</span></div><div class="grand"><span>Total</span><span id="t-total">—</span></div></div>
    </div>
  </div>
  <div class="form-actions"><a class="btn" href="${quote ? `/gestion/devis/${quote.id}/` : "/gestion/devis/"}">Annuler</a><button class="btn primary">Enregistrer le devis</button></div>
</form>
${jsonScript(prices, "prices")}`;
  return page(ctx, { title, section: "quotes", content, scripts: LINES_SCRIPT });
}

const LINES_SCRIPT = raw(`<script>
(function () {
  var prices = JSON.parse(document.getElementById("prices").textContent);
  var table = document.getElementById("lines");
  function fmt(n) { return n.toLocaleString("fr-FR", {minimumFractionDigits: 0, maximumFractionDigits: 2}) + " MAD"; }
  function num(el) { return parseFloat((el && el.value || "0").replace(",", ".")) || 0; }
  function recalc() {
    var sub = 0;
    table.querySelectorAll("tbody tr").forEach(function (tr) {
      var q = num(tr.querySelector("[name$=quantity]")), p = num(tr.querySelector("[name$=unit_price]"));
      var del = tr.querySelector("[name$=DELETE]");
      var t = (del && del.checked) ? 0 : q * p;
      tr.querySelector(".line-total").textContent = t ? fmt(t) : "—";
      sub += t;
    });
    var disc = num(document.getElementById("id_discount")), rate = num(document.getElementById("id_tva_rate"));
    var ht = sub - disc, tva = Math.round(ht * rate) / 100;
    document.getElementById("t-sub").textContent = fmt(sub);
    document.getElementById("t-disc").textContent = disc ? "-" + fmt(disc) : "—";
    document.getElementById("t-tva").textContent = rate ? fmt(tva) + " (" + rate + " %)" : "—";
    document.getElementById("t-total").textContent = fmt(ht + tva);
  }
  // Choosing a product fills its name and current price.
  document.addEventListener("change", function (e) {
    if (e.target.name && /-product_id$/.test(e.target.name)) {
      var tr = e.target.closest("tr"), info = prices[e.target.value];
      if (info) {
        tr.querySelector("[name$=description]").value = info.name;
        tr.querySelector("[name$=unit_price]").value = info.price;
        var qty = tr.querySelector("[name$=quantity]");
        if (!qty.value) qty.value = 1;
      }
    }
    recalc();
  });
  document.addEventListener("input", recalc);
  document.getElementById("add-line").addEventListener("click", function () {
    var rows = table.querySelectorAll("tbody tr"), last = rows[rows.length - 1];
    var n = rows.length, clone = last.cloneNode(true);
    clone.querySelectorAll("input, select").forEach(function (el) {
      if (el.type === "hidden" || el.type === "checkbox") { el.remove(); return; }
      el.name = el.name.replace(/-\\d+-/, "-" + n + "-");
      el.id = el.id.replace(/-\\d+-/, "-" + n + "-");
      el.value = el.name.endsWith("quantity") ? 1 : "";
    });
    table.querySelector("tbody").appendChild(clone);
    recalc();
  });
  recalc();
})();
</script>`);

function messageText(db, quote, customer, tot) {
  const TW = siteInfo(db);
  return `Bonjour ${customer.name},\n\nVoici votre devis Tech-Ward N° ${quote.number} d'un montant de ${mad(tot.total_ttc)}, `
    + `valable jusqu'au ${dmy(quote.valid_until)}.\nLe devis détaillé (PDF) est joint à ce message.\n\n`
    + `Paiement en espèces à la confirmation. N'hésitez pas à nous écrire pour toute question.\nTech-Ward · ${TW.phone_display}`;
}

function quoteDetail(ctx, id) {
  const db = ctx.db, quote = byId(db, "quotes", id);
  if (!quote) return null;
  const c = byId(db, "customers", quote.customer_id) || {};
  const tot = quoteTotals(db, quote);
  const text = messageText(db, quote, c, tot);
  const waUrl = `https://wa.me/${waNumber(c.phone)}?text=${encodeURIComponent(text)}`;
  const mailUrl = `mailto:${c.email || ""}?subject=${encodeURIComponent(`Devis Tech-Ward ${quote.number}`)}&body=${encodeURIComponent(text)}`;
  const movements = db.movements.filter((m) => m.quote_id === quote.id);
  const content = html`
${top(html`<a href="/gestion/devis/">Devis</a>`, html`Devis ${quote.number} <span class="badge ${statusClass(quote.status)}" style="vertical-align:middle">${label(QUOTE_STATUSES, quote.status)}</span>`, html`
  <a class="btn" href="/gestion/devis/${quote.id}/pdf/" target="_blank">${gicon("pdf")}Voir le PDF</a>
  <form class="inline" method="post" action="/gestion/devis/${quote.id}/whatsapp/" id="wa-form"><input type="hidden" name="url" value="${waUrl}">
    <button class="btn wa"${!c.phone ? raw(' disabled title="Ajoutez un téléphone sur la fiche client"') : ""}>${gicon("wa")}Envoyer par WhatsApp</button></form>
  <a class="btn" href="${mailUrl}" id="mail-link">${gicon("mail")}Email</a>
  <a class="btn" href="/gestion/devis/${quote.id}/modifier/">${gicon("edit")}Modifier</a>
  <form class="inline" method="post" action="/gestion/devis/${quote.id}/dupliquer/"><button class="btn">${gicon("copy")}Dupliquer</button></form>`)}
<p class="note info small" style="margin:0 0 16px">WhatsApp et Email : le PDF se télécharge et le message au client s'ouvre, prêt. Il reste à joindre le PDF (trombone) avant d'envoyer.</p>
<section class="kpis">
  <div class="kpi"><div class="label">Total</div><div class="value">${mad(tot.total_ttc)}</div>${quote.tva_rate ? html`<div class="sub">dont TVA ${mad(tot.tva)}</div>` : ""}</div>
  <div class="kpi"><div class="label">Coût estimé</div><div class="value">${mad(tot.cost)}</div><div class="sub">Matériel et pose</div></div>
  <div class="kpi ${tot.margin < 0 ? "bad" : "good"}"><div class="label">Marge</div><div class="value">${mad(tot.margin)}</div></div>
  <div class="kpi"><div class="label">Validité</div><div class="value">${dmy(quote.valid_until)}</div></div>
</section>
<div class="grid g-main">
  <div class="card">
    <div class="doc-head">
      <div><div class="k">Client</div><div class="v"><a href="/gestion/clients/${c.id}/">${c.name}</a></div><div class="small muted">${c.phone} ${c.email}</div></div>
      <div><div class="k">Date</div><div class="v">${dmy(quote.date)}</div></div>
      ${quote.done_date ? html`<div><div class="k">Réalisé le</div><div class="v">${dmy(quote.done_date)}</div></div>` : ""}
    </div>
    <div class="table-wrap"><table class="t">
      <thead><tr><th>Désignation</th><th class="num">Qté</th><th class="num">Prix unitaire</th><th class="num">Total</th></tr></thead>
      <tbody>${tot.lines.length ? tot.lines.map((l) => html`<tr><td>${l.description}</td><td class="num">${l.quantity}</td><td class="num">${mad(l.unit_price)}</td><td class="num">${mad(l.quantity * l.unit_price)}</td></tr>`)
        : html`<tr><td colspan="4" class="empty">Aucune ligne. <a href="/gestion/devis/${quote.id}/modifier/">Ajouter des articles</a></td></tr>`}</tbody>
    </table></div>
    <div class="totals" style="margin-top:10px">
      <div><span>Sous-total</span><span>${mad(tot.subtotal)}</span></div>
      ${quote.discount ? html`<div><span>Remise</span><span>-${mad(quote.discount)}</span></div>` : ""}
      ${quote.tva_rate ? html`<div><span>Total HT</span><span>${mad(tot.total_ht)}</span></div><div><span>TVA ${quote.tva_rate} %</span><span>${mad(tot.tva)}</span></div>` : ""}
      <div class="grand"><span>Total</span><span>${mad(tot.total_ttc)}</span></div>
    </div>
    ${quote.notes ? html`<p class="small" style="white-space:pre-line"><b>Notes :</b> ${quote.notes}</p>` : ""}
  </div>
  <div class="stack">
    <div class="card"><h2>Statut</h2>
      <form method="post" action="/gestion/devis/${quote.id}/statut/" class="steps">
        ${QUOTE_STATUSES.map(([k, v]) => html`<button name="status" value="${k}" class="${quote.status === k ? "on" : ""}"${k === "realise" && quote.status !== "realise" ? raw(' data-confirm="Marquer comme réalisé et payé ? Le matériel sera sorti du stock et le montant compté dans le chiffre d&#39;affaires."') : ""}>${v}</button>`)}
      </form>
      <p class="small muted">« Réalisé et payé » sort le matériel du stock (y compris le contenu des packs) et compte la vente dans le chiffre d'affaires.</p>
    </div>
    ${movements.length ? html`<div class="card"><h2>Sorties de stock</h2><table class="t"><tbody>${movements.map((m) => html`<tr><td>${byId(db, "products", m.product_id)?.name_fr}</td><td class="num">${m.quantity > 0 ? "+" : ""}${m.quantity}</td></tr>`)}</tbody></table></div>` : ""}
  </div>
</div>`;
  const scripts = raw(`<script>
// WhatsApp and email: download the PDF first so it is ready to attach.
function downloadPdf() { var a = document.createElement("a"); a.href = "/gestion/devis/${quote.id}/pdf/?dl=1"; a.download = ""; document.body.appendChild(a); a.click(); a.remove(); }
document.getElementById("wa-form").addEventListener("submit", function () { downloadPdf(); this.target = "_blank"; setTimeout(function () { location.reload(); }, 1500); });
var mail = document.getElementById("mail-link"); if (mail) mail.addEventListener("click", downloadPdf);
</script>`);
  return page(ctx, { title: `Devis ${quote.number}`, section: "quotes", content, scripts });
}

export function companyBlock(db) {
  const TW = siteInfo(db);
  return {
    name: TW.name, phone_display: TW.phone_display, email: TW.email,
    lines: [TW.address, `Tél. / WhatsApp : ${TW.phone_display}`, TW.email,
      ...["ice", "rc", "if"].filter((k) => TW[k]).map((k) => `${k.toUpperCase()} : ${TW[k]}`)].filter(Boolean),
  };
}

export function pdfResponse(ctx, bytes, filename) {
  const disposition = ctx.query.get("dl") ? "attachment" : "inline";
  return ctx.file(bytes, "application/pdf", { "Content-Disposition": `${disposition}; filename="${filename}"`, "Cache-Control": "no-store" });
}

function quotePdf(ctx, id) {
  const db = ctx.db, quote = byId(db, "quotes", id);
  if (!quote) return null;
  const c = byId(db, "customers", quote.customer_id) || {};
  const tot = quoteTotals(db, quote);
  const totals = [["Sous-total", mad(tot.subtotal), false]];
  if (quote.discount) totals.push(["Remise", "-" + mad(quote.discount), false]);
  if (quote.tva_rate) totals.push(["Total HT", mad(tot.total_ht), false], [`TVA ${quote.tva_rate} %`, mad(tot.tva), false], ["Total TTC", mad(tot.total_ttc), true]);
  else totals.push(["Total", mad(tot.total_ttc), true]);
  const bytes = buildPdf({
    title: "Devis", number: quote.number, company: companyBlock(db),
    partyTitle: "CLIENT", party: [c.name || "", c.address, c.city, c.phone, c.email, c.ice ? `ICE : ${c.ice}` : ""],
    meta: [`Date : ${dmy(quote.date)}`, `Valable jusqu'au : ${dmy(quote.valid_until)}`],
    head: ["Désignation", "Qté", "Prix unitaire", "Total"],
    lines: tot.lines.map((l) => [l.description, String(l.quantity), mad(l.unit_price), mad(l.quantity * l.unit_price)]),
    totals, notes: quote.notes || "",
    conditions: [
      `Devis valable jusqu'au ${dmy(quote.valid_until)}.`,
      "Paiement en espèces à la confirmation du devis.",
      "Installation, câblage et configuration de l'application inclus lorsque mentionnés.",
      "Matériel garanti selon les conditions du fabricant.",
    ],
  });
  return pdfResponse(ctx, bytes, `Devis-${quote.number}.pdf`);
}

async function quoteStatus(ctx, id) {
  const db = ctx.db, quote = byId(db, "quotes", id);
  if (!quote) return null;
  const status = (await ctx.form()).get("status");
  if (QUOTE_STATUSES.some(([k]) => k === status)) {
    setQuoteStatus(db, quote, status);
    await ctx.commit();
    ctx.flash("success", `Devis ${quote.number} : ${label(QUOTE_STATUSES, status)}.${status === "realise" ? " Le matériel est sorti du stock." : ""}`);
  }
  return ctx.redirect(`/gestion/devis/${quote.id}/`);
}

// WhatsApp button: mark the devis as sent, then open WhatsApp.
async function quoteSent(ctx, id) {
  const db = ctx.db, quote = byId(db, "quotes", id);
  if (!quote) return null;
  const url = String((await ctx.form()).get("url") || "");
  if (quote.status === "brouillon") {
    setQuoteStatus(db, quote, "envoye");
    await ctx.commit();
  }
  return ctx.redirect(url.startsWith("https://wa.me/") ? url : `/gestion/devis/${quote.id}/`);
}

async function quoteDuplicate(ctx, id) {
  const db = ctx.db, source = byId(db, "quotes", id);
  if (!source) return null;
  const d = today();
  const copy = insert(db, "quotes", { number: nextNumber(db.quotes, "DV"), customer_id: source.customer_id, date: d,
    valid_until: addDays(d, 15), status: "brouillon", discount: source.discount, tva_rate: source.tva_rate, notes: source.notes,
    done_date: null, stock_done: false, created_at: nowLocal() });
  for (const l of quoteLinesOf(db, source)) {
    const product = l.product_id ? byId(db, "products", l.product_id) : null;
    insert(db, "quoteLines", { quote_id: copy.id, product_id: l.product_id, description: l.description, quantity: l.quantity,
      unit_price: l.unit_price, unit_cost: product ? unitCost(db, product) : 0 });
  }
  await ctx.commit();
  ctx.flash("success", `Copie créée : ${copy.number}.`);
  return ctx.redirect(`/gestion/devis/${copy.id}/modifier/`);
}

export const quoteRoutes = [
  { method: "GET", path: /^\/gestion\/devis\/$/, handler: quotes },
  { path: /^\/gestion\/devis\/nouveau\/$/, handler: (ctx) => quoteEdit(ctx, null) },
  { method: "GET", path: /^\/gestion\/devis\/(\d+)\/$/, handler: (ctx, id) => quoteDetail(ctx, Number(id)) },
  { path: /^\/gestion\/devis\/(\d+)\/modifier\/$/, handler: (ctx, id) => quoteEdit(ctx, Number(id)) },
  { method: "GET", path: /^\/gestion\/devis\/(\d+)\/pdf\/$/, handler: (ctx, id) => quotePdf(ctx, Number(id)) },
  { method: "POST", path: /^\/gestion\/devis\/(\d+)\/statut\/$/, handler: (ctx, id) => quoteStatus(ctx, Number(id)) },
  { method: "POST", path: /^\/gestion\/devis\/(\d+)\/whatsapp\/$/, handler: (ctx, id) => quoteSent(ctx, Number(id)) },
  { method: "POST", path: /^\/gestion\/devis\/(\d+)\/dupliquer\/$/, handler: (ctx, id) => quoteDuplicate(ctx, Number(id)) },
];

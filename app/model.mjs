// The data (one JSON document) and the business rules: offers, stock, devis, purchase orders, figures.
// Money is MAD as plain numbers, rounded to 2 decimals. Dates are "YYYY-MM-DD" in Moroccan time.
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

export const TABLES = ["categories", "products", "packItems", "offers", "offerItems", "customers", "suppliers",
  "quotes", "quoteLines", "orders", "orderLines", "expenses", "movements", "users"];

export const DEFAULTS = {
  name: "Tech-Ward",
  email: "Tech-Ward@gmail.com",
  phone_display: "06 75 47 42 94",
  whatsapp: "212675474294",
  address: "",
  ice: "", rc: "", if: "",
  tva: 0,
};

export const GROUPS = [
  ["cameras", "Caméras"], ["recording", "Enregistrement"], ["alarm", "Alarme"],
  ["access", "Contrôle d'accès"], ["accessories", "Accessoires"],
];
export const KINDS = [["product", "Produit"], ["pack", "Pack d'installation"], ["service", "Service (alarme, accès...)"]];
export const ART = [
  ["indoor", "Caméra intérieure"], ["bullet", "Caméra extérieure"], ["ptz", "Caméra PTZ / dôme"],
  ["doorbell", "Sonnette vidéo"], ["nvr", "Enregistreur"], ["hdd", "Disque dur"], ["alarm", "Centrale d'alarme"],
  ["sensor", "Détecteur"], ["siren", "Sirène"], ["keypad", "Lecteur badge / clavier"], ["finger", "Empreinte digitale"],
  ["intercom", "Interphone vidéo"], ["lock", "Serrure connectée"], ["cable", "Câble / accessoire"],
  ["pack", "Pack caméras"], ["service", "Service / technicien"],
];
export const QUOTE_STATUSES = [["brouillon", "Brouillon"], ["envoye", "Envoyé"], ["accepte", "Accepté"],
  ["realise", "Réalisé et payé"], ["refuse", "Refusé"]];
export const ORDER_STATUSES = [["brouillon", "Brouillon"], ["envoye", "Envoyé"], ["recu", "Reçu"], ["annule", "Annulé"]];
export const EXPENSE_CATEGORIES = [
  ["achats", "Achats de marchandises"], ["transport", "Transport et carburant"],
  ["main_oeuvre", "Main d'œuvre / sous-traitance"], ["outillage", "Outillage et consommables"],
  ["marketing", "Marketing et publicité"], ["loyer", "Loyer et charges"],
  ["telecom", "Téléphone et internet"], ["impots", "Impôts et taxes"], ["autre", "Autre"],
];
export const CUSTOMER_KINDS = [["particulier", "Particulier"], ["entreprise", "Entreprise"]];
export const MOVE_KINDS = [["entree", "Entrée"], ["sortie", "Sortie"], ["ajustement", "Ajustement / inventaire"]];
export const label = (choices, key) => (choices.find((c) => c[0] === key) || [key, key])[1];

// Stock and buying details kept on each catalog item (never shown on the public site).
export const PRODUCT_PRIVATE = { cost_price: 0, sku: "", supplier_id: null, stock: 0, min_stock: 2, location: "" };

// ---------------------------------------------------------------- the document
export function emptyDb() {
  const db = { version: 1, seq: {}, site: {}, secret: randomBytes(32).toString("hex") };
  for (const t of TABLES) db[t] = [];
  return db;
}

export function seededDb() {
  const db = emptyDb();
  const seed = JSON.parse(readFileSync(new URL("./seed.json", import.meta.url), "utf8"));
  db.categories = seed.categories;
  db.products = seed.products.map((p) => ({ ...PRODUCT_PRIVATE, ...p }));
  fixSeq(db);
  return db;
}

export function fixSeq(db) {
  for (const t of TABLES) db.seq[t] = Math.max(db.seq[t] || 0, ...db[t].map((r) => r.id || 0));
}

export function insert(db, table, row) {
  db.seq[table] = (db.seq[table] || 0) + 1;
  const rec = { ...row, id: db.seq[table] };
  db[table].push(rec);
  return rec;
}

export const byId = (db, table, id) => db[table].find((r) => r.id === Number(id)) || null;
export const remove = (db, table, pred) => { db[table] = db[table].filter((r) => !pred(r)); };

// ---------------------------------------------------------------- dates and money
export function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Casablanca" }).format(new Date());
}
export function nowLocal() {
  // "YYYY-MM-DDTHH:MM" in Moroccan time.
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Casablanca", year: "numeric", month: "2-digit",
    day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
  const v = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${v.year}-${v.month}-${v.day}T${v.hour}:${v.minute}`;
}
export function addDays(d, n) {
  const x = new Date(d + "T12:00:00Z");
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
}
export function monthStart(shift = 0, d = today()) {
  const [y, m] = d.split("-").map(Number);
  const k = m - 1 + shift;
  const year = y + Math.floor(k / 12), month = ((k % 12) + 12) % 12 + 1;
  return `${year}-${String(month).padStart(2, "0")}-01`;
}
export const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
export const sum = (rows, fn) => r2(rows.reduce((s, r) => s + (Number(fn(r)) || 0), 0));

const MONTHS_FR = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
export const monthLabel = (d) => `${MONTHS_FR[Number(d.slice(5, 7)) - 1]} ${d.slice(2, 4)}`;

export function nextNumber(rows, prefix) {
  const start = `${prefix}-${today().slice(0, 4)}-`;
  const last = rows.map((r) => r.number).filter((n) => n?.startsWith(start)).sort().pop();
  const n = last ? Number(last.split("-").pop()) + 1 : 1;
  return start + String(n).padStart(4, "0");
}

// ---------------------------------------------------------------- site settings
export function siteInfo(db) {
  const s = db.site || {};
  const out = { ...DEFAULTS };
  for (const k of ["phone_display", "whatsapp", "email", "address"]) if (s[k]) out[k] = s[k];
  return out;
}

// ---------------------------------------------------------------- catalog
export function packItems(db, pack) {
  return db.packItems.filter((i) => i.pack_id === pack.id)
    .map((i) => ({ ...i, component: byId(db, "products", i.component_id) })).filter((i) => i.component);
}

// Cost of one unit: buying price, or for a pack its parts plus labour.
export function unitCost(db, product) {
  let own = Number(product.cost_price) || 0;
  if (product.kind === "pack") for (const i of packItems(db, product)) own += i.quantity * (Number(i.component.cost_price) || 0);
  return r2(own);
}

export const isLow = (p) => p.kind === "product" && p.stock <= p.min_stock;

export function lowStock(db) {
  return db.products.filter((p) => p.kind === "product" && p.active && p.stock <= p.min_stock)
    .sort((a, b) => a.stock - b.stock);
}

export const stockValue = (db) => sum(db.products.filter((p) => p.kind === "product" && p.stock > 0), (p) => p.stock * p.cost_price);

export function slugify(text) {
  return String(text || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50);
}

export function uniqueSlug(db, wanted, name, exceptId) {
  const base = slugify(wanted) || slugify(name) || "article";
  let slug = base, n = 2;
  while (db.products.some((p) => p.slug === slug && p.id !== exceptId)) slug = `${base}-${n++}`;
  return slug;
}

// ---------------------------------------------------------------- offers
export function offerRunning(o, d = today()) {
  return o.active && o.start_date <= d && (!o.end_date || d <= o.end_date);
}

// While an offer runs, price = offer price and old_price = the usual one (struck through on the site).
export function syncOffers(db, d = today()) {
  let changed = 0;
  for (const item of db.offerItems) {
    const offer = byId(db, "offers", item.offer_id), product = byId(db, "products", item.product_id);
    if (!offer || !product) continue;
    const running = offerRunning(offer, d);
    if (running && !item.applied) {
      item.original_price = product.price;
      item.applied = true;
      product.old_price = product.price;
      product.price = item.offer_price;
    } else if (!running && item.applied) {
      product.price = item.original_price;
      product.old_price = null;
      item.applied = false;
    } else continue;
    changed++;
  }
  return changed;
}

export function restoreOffer(db, offer) {
  for (const item of db.offerItems.filter((i) => i.offer_id === offer.id && i.applied)) {
    const product = byId(db, "products", item.product_id);
    if (product) { product.price = item.original_price; product.old_price = null; }
    item.applied = false;
  }
}

// ---------------------------------------------------------------- stock
export function moveStock(db, product, kind, quantity, reason, extra = {}) {
  insert(db, "movements", { product_id: product.id, date: nowLocal(), kind, quantity, reason,
    quote_id: null, purchase_order_id: null, ...extra });
  product.stock = (Number(product.stock) || 0) + quantity;
}

// ---------------------------------------------------------------- devis
export const quoteLinesOf = (db, q) => db.quoteLines.filter((l) => l.quote_id === q.id).sort((a, b) => a.id - b.id);

export function quoteTotals(db, q) {
  const lines = quoteLinesOf(db, q);
  const subtotal = sum(lines, (l) => l.quantity * (l.unit_price || 0));
  const total_ht = r2(subtotal - (Number(q.discount) || 0));
  const tva = r2(total_ht * (Number(q.tva_rate) || 0) / 100);
  const cost = sum(lines, (l) => l.quantity * (l.unit_cost || 0));
  return { lines, subtotal, total_ht, tva, total_ttc: r2(total_ht + tva), cost, margin: r2(total_ht - cost) };
}

// (product, quantity) taken from the warehouse by a devis; packs give their parts.
function stockLines(db, quote) {
  const out = [];
  for (const line of quoteLinesOf(db, quote)) {
    const product = byId(db, "products", line.product_id);
    if (!product) continue;
    if (product.kind === "product") out.push([product, line.quantity]);
    else if (product.kind === "pack") for (const i of packItems(db, product)) out.push([i.component, i.quantity * line.quantity]);
  }
  return out;
}

// "Réalisé" takes the goods out of stock; leaving it puts them back.
export function setQuoteStatus(db, quote, status) {
  const customer = byId(db, "customers", quote.customer_id);
  if (status === "realise" && !quote.stock_done) {
    for (const [p, qty] of stockLines(db, quote))
      moveStock(db, p, "sortie", -qty, `Devis ${quote.number} · ${customer?.name || ""}`, { quote_id: quote.id });
    quote.stock_done = true;
    quote.done_date = quote.done_date || today();
  } else if (status !== "realise" && quote.stock_done) {
    for (const [p, qty] of stockLines(db, quote))
      moveStock(db, p, "entree", qty, `Annulation réalisation devis ${quote.number}`, { quote_id: quote.id });
    quote.stock_done = false;
    quote.done_date = null;
  }
  quote.status = status;
}

// ---------------------------------------------------------------- purchase orders
export const orderLinesOf = (db, o) => db.orderLines.filter((l) => l.order_id === o.id).sort((a, b) => a.id - b.id);
export const orderTotal = (db, o) => sum(orderLinesOf(db, o), (l) => l.quantity * (l.unit_cost || 0));

// Goods arrive: stock goes up, buying prices are updated and the purchase is recorded as an expense.
export function receiveOrder(db, order) {
  if (order.status === "recu") return;
  const supplier = byId(db, "suppliers", order.supplier_id);
  for (const line of orderLinesOf(db, order)) {
    const p = byId(db, "products", line.product_id);
    if (!p) continue;
    moveStock(db, p, "entree", line.quantity, `Réception ${order.number} · ${supplier?.name || ""}`, { purchase_order_id: order.id });
    p.cost_price = line.unit_cost;
    if (!p.supplier_id) p.supplier_id = order.supplier_id;
  }
  order.status = "recu";
  order.received_date = today();
  const fields = { date: order.received_date, category: "achats", supplier_id: order.supplier_id,
    label: `Bon de commande ${order.number}`, amount: orderTotal(db, order) };
  const existing = db.expenses.find((e) => e.purchase_order_id === order.id);
  if (existing) Object.assign(existing, fields);
  else insert(db, "expenses", { ...fields, purchase_order_id: order.id });
}

// ---------------------------------------------------------------- figures
export function doneQuotes(db, start, end) {
  return db.quotes.filter((q) => q.status === "realise" && (!start || q.done_date >= start) && (!end || q.done_date < end));
}
export const revenue = (db, start, end) => sum(doneQuotes(db, start, end), (q) => quoteTotals(db, q).total_ht);
export const costs = (db, start, end) =>
  sum(db.expenses.filter((e) => (!start || e.date >= start) && (!end || e.date < end)), (e) => e.amount);

export function monthly(db, n = 6) {
  const rows = [];
  for (let s = -(n - 1); s <= 0; s++) {
    const start = monthStart(s), end = monthStart(s + 1);
    rows.push({ label: monthLabel(start), revenue: revenue(db, start, end), costs: costs(db, start, end) });
  }
  return rows;
}

// Products (or packs) sold in devis marked "Réalisé", by quantity.
export function bestSellers(db, kind, start, limit = 5) {
  const done = new Map(doneQuotes(db, start).map((q) => [q.id, q]));
  const rows = new Map();
  for (const l of db.quoteLines) {
    if (!done.has(l.quote_id)) continue;
    const p = byId(db, "products", l.product_id);
    if (!p || p.kind !== kind) continue;
    const r = rows.get(p.id) || { id: p.id, name: p.name_fr, qty: 0, amount: 0 };
    r.qty += l.quantity;
    r.amount = r2(r.amount + l.quantity * (l.unit_price || 0));
    rows.set(p.id, r);
  }
  return [...rows.values()].sort((a, b) => b.qty - a.qty || b.amount - a.amount).slice(0, limit);
}

export const pct = (part, whole) => (whole ? Math.round((part * 100) / whole) : 0);

export function trend(now, before) {
  if (!before) return "";
  const change = Math.round(((now - before) * 100) / Math.abs(before));
  return `${change >= 0 ? "+" : ""}${change} % vs mois dernier`;
}

export function waNumber(phone) {
  let digits = String(phone || "").replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = "212" + digits.slice(1);
  return digits;
}

// Gestion page frame and shared pieces: menu, KPI strip, chart, form fields.
import { html, raw } from "../html.mjs";
import { gicon } from "../svg.mjs";

// 3499.5 -> "3 499,50 MAD". Empty -> "Sur devis".
export function mad(value) {
  if (value === null || value === undefined || value === "") return "Sur devis";
  const v = Math.round(Number(value) * 100) / 100;
  const cents = Math.round(Math.abs(v) * 100);
  const whole = Math.floor(cents / 100), c = cents % 100;
  let text = whole.toLocaleString("en-US").replace(/,/g, " ");
  if (c) text += "," + String(c).padStart(2, "0");
  return `${v < 0 ? "-" : ""}${text} MAD`;
}
export const num = (v) => Math.trunc(Number(v) || 0).toLocaleString("en-US").replace(/,/g, " ");

// "2026-10-07" -> "07/10/2026"; "2026-10-07T14:05" -> "07/10/2026 14:05".
export function dmy(d, { time = false, short = false } = {}) {
  if (!d) return "";
  const [y, m, day] = d.slice(0, 10).split("-");
  let out = short ? `${day}/${m}` : `${day}/${m}/${y}`;
  if (time && d.length > 10) out += " " + d.slice(11, 16);
  return out;
}

export function statusClass(s) {
  return { brouillon: "grey", envoye: "blue", accepte: "teal", realise: "green", recu: "green", refuse: "red", annule: "red" }[s] || "grey";
}

export const kpi = (label, value, sub = "", tone = "") => ({ label, value, sub, tone });

export const plural = (n) => (Math.abs(n) > 1 ? "s" : "");

export function kpis(list) {
  if (!list?.length) return "";
  return html`<section class="kpis">${list.map((k) => html`
  <div class="kpi ${k.tone}"><div class="label">${k.label}</div><div class="value">${k.value}</div>${k.sub ? html`<div class="sub">${k.sub}</div>` : ""}</div>`)}
</section>`;
}

// Grouped bars (revenue vs costs) as SVG.
export function chart(rows, height = 200, width = 600) {
  let top = Math.max(...rows.map((r) => Math.max(r.revenue, r.costs)), 1);
  const step = 10 ** (String(Math.trunc(top)).length - 1);
  top = (Math.trunc(top / step) + 1) * step;
  const slot = width / rows.length;
  const bars = [];
  rows.forEach((r, i) => {
    ["revenue", "costs"].forEach((key, j) => {
      const h = (r[key] / top) * height;
      bars.push(html`<rect class="${key}" x="${(i * slot + slot * (0.2 + 0.31 * j)).toFixed(2)}" y="${(height - h).toFixed(1)}" width="${(slot * 0.29).toFixed(2)}" height="${h.toFixed(1)}" rx="4" data-tip="${r.label} · ${key === "revenue" ? "CA" : "Dépenses"} : ${mad(r[key])}"/>`);
    });
  });
  const ticks = [0, 1, 2, 3, 4].map((k) => {
    const y = (height - (height * k) / 4).toFixed(1);
    return html`<line class="grid-line" x1="0" x2="${width}" y1="${y}" y2="${y}"/><text class="tick" x="-8" y="${y}" dy="4" text-anchor="end">${num((top * k) / 4)}</text>`;
  });
  const labels = rows.map((r, i) => html`<text class="xlab" x="${(i * slot + slot / 2).toFixed(2)}" y="${height + 22}">${r.label}</text>`);
  return html`<div class="legend"><span><i style="background:var(--rev)"></i>Chiffre d'affaires</span><span><i style="background:var(--cost)"></i>Dépenses</span></div>
<div class="chart">
  <svg viewBox="-56 -10 ${width + 62} ${height + 36}" role="img" aria-label="Chiffre d'affaires et dépenses par mois">
    ${ticks}${bars}${labels}
  </svg>
</div>`;
}

// ---------------------------------------------------------------- form fields
// def: {name, label, type: text|textarea|number|money|int|select|checkbox|date|email|file|password,
//       help, choices: [[value, label]], blank, rows, dir, placeholder, required, accept}
export function input(def, value, { prefix = "", attrs = "" } = {}) {
  const name = prefix + def.name, id = `id_${name}`;
  const req = def.required ? raw(" required") : "";
  const extra = raw((def.dir ? ` dir="${def.dir}"` : "") + (attrs ? " " + attrs : ""));
  const ph = def.placeholder ? html` placeholder="${def.placeholder}"` : "";
  const v = value === null || value === undefined ? "" : value;
  switch (def.type) {
    case "textarea":
      return html`<textarea name="${name}" id="${id}" rows="${def.rows || 4}"${req}${extra}${ph}>${v}</textarea>`;
    case "select": {
      const opts = def.choices.map(([k, l]) => html`<option value="${k}"${String(k) === String(v) ? raw(" selected") : ""}>${l}</option>`);
      return html`<select name="${name}" id="${id}"${req}${extra}>${def.blank === false ? "" : html`<option value="">${def.blank || "---------"}</option>`}${opts}</select>`;
    }
    case "checkbox":
      return html`<input type="checkbox" name="${name}" id="${id}"${v ? raw(" checked") : ""}${extra}>`;
    case "money": case "number":
      return html`<input type="number" name="${name}" id="${id}" value="${v}" step="${def.step || "0.01"}"${def.min !== undefined ? html` min="${def.min}"` : ""}${req}${extra}${ph}>`;
    case "int":
      return html`<input type="number" name="${name}" id="${id}" value="${v}" step="1"${def.min !== undefined ? html` min="${def.min}"` : ""}${req}${extra}${ph}>`;
    case "file":
      return html`<input type="file" name="${name}" id="${id}"${def.accept ? html` accept="${def.accept}"` : ""}${extra}>`;
    default:
      return html`<input type="${def.type || "text"}" name="${name}" id="${id}" value="${v}"${def.maxlength ? html` maxlength="${def.maxlength}"` : ""}${req}${extra}${ph}>`;
  }
}

export const errorList = (err) => (err ? html`<ul class="errorlist"><li>${err}</li></ul>` : "");

export function field(def, values = {}, errors = {}, { wide = false } = {}) {
  const v = values[def.name], id = `id_${def.name}`;
  if (def.type === "checkbox")
    return html`<div class="field check${wide ? " wide" : ""}">${input(def, v)}<label for="${id}">${def.label}</label>${def.help ? html`<span class="help">${def.help}</span>` : ""}${errorList(errors[def.name])}</div>`;
  return html`<div class="field${wide ? " wide" : ""}"><label for="${id}">${def.label}</label>${input(def, v)}${def.help ? html`<span class="help">${def.help}</span>` : ""}${errorList(errors[def.name])}</div>`;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Reads one value from the submitted form. Returns [value, error].
export function readValue(def, form, prefix = "") {
  const name = prefix + def.name;
  if (def.type === "checkbox") return [form.has(name), null];
  if (def.type === "file") return [null, null];
  const text = String(form.get(name) ?? "").trim();
  if (!text) {
    if (def.required) return [null, "Ce champ est obligatoire."];
    if (["money", "number", "int"].includes(def.type)) return [def.default ?? null, null];
    if (def.type === "select" || def.type === "date") return [null, null];
    return ["", null];
  }
  switch (def.type) {
    case "money": case "number": {
      const n = Number(text.replace(/\s/g, "").replace(",", "."));
      if (!Number.isFinite(n)) return [null, "Saisissez un nombre."];
      if (def.min !== undefined && n < def.min) return [null, `Minimum ${def.min}.`];
      return [def.round === 0 ? Math.round(n) : Math.round(n * 100) / 100, null];
    }
    case "int": {
      const n = Number(text);
      if (!Number.isInteger(n)) return [null, "Saisissez un nombre entier."];
      if (def.min !== undefined && n < def.min) return [null, `Minimum ${def.min}.`];
      return [n, null];
    }
    case "date":
      return /^\d{4}-\d{2}-\d{2}$/.test(text) ? [text, null] : [null, "Date invalide."];
    case "email":
      return EMAIL.test(text) ? [text, null] : [null, "Adresse email invalide."];
    case "select": {
      if (!def.choices.some(([k]) => String(k) === text)) return [null, "Choix invalide."];
      return [def.numeric ? Number(text) : text, null];
    }
    default:
      return [def.maxlength ? text.slice(0, def.maxlength) : text, null];
  }
}

export function readForm(defs, form, prefix = "") {
  const values = {}, errors = {};
  for (const def of defs) {
    const [v, err] = readValue(def, form, prefix);
    values[def.name] = v;
    if (err) errors[def.name] = err;
  }
  return { values, errors, ok: !Object.keys(errors).length };
}

// Line tables (devis lines, pack contents...): rows named prefix-N-field. Returns the submitted rows in order.
export function readRows(form, prefix) {
  const rows = new Map();
  for (const key of form.keys()) {
    const m = key.match(new RegExp(`^${prefix}-(\\d+)-(\\w+)$`));
    if (m) {
      if (!rows.has(+m[1])) rows.set(+m[1], {});
      rows.get(+m[1])[m[2]] = String(form.get(key)).trim();
    }
  }
  return [...rows.entries()].sort((a, b) => a[0] - b[0]).map(([, r]) => r);
}

export const toNum = (text) => {
  if (text === undefined || text === null || String(text).trim() === "") return null;
  const n = Number(String(text).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

// ---------------------------------------------------------------- page frame
const NAV = [
  ["dashboard", "/gestion/", "home", "Tableau de bord"],
  "Ventes",
  ["quotes", "/gestion/devis/", "doc", "Devis"],
  ["customers", "/gestion/clients/", "users", "Clients"],
  "Catalogue",
  ["products", "/gestion/catalogue/", "box", "Produits et prix"],
  ["packs", "/gestion/packs/", "layers", "Packs"],
  ["offers", "/gestion/offres/", "tag", "Offres et promos"],
  "Achats et stock",
  ["orders", "/gestion/achats/", "cart", "Bons de commande"],
  ["suppliers", "/gestion/fournisseurs/", "truck", "Fournisseurs"],
  ["stock", "/gestion/stock/", "warehouse", "Stock"],
  "Pilotage",
  ["finances", "/gestion/finances/", "chart", "Coûts et revenus"],
  ["site", "/gestion/site-web/", "edit", "Site web"],
  ["data", "/gestion/donnees/", "upload", "Sauvegarde et import"],
];

export function page(ctx, { title, section, content, scripts = "" }) {
  return ctx.html(html`<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title || "Gestion"} · Tech-Ward</title>
  <link rel="icon" href="/static/img/favicon.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/static/gestion/gestion.css">
</head>
<body>
<div class="app">
  <aside class="side">
    <a class="brand" href="/gestion/"><img src="/static/img/logo-mark.png" alt=""><span>Tech-Ward<small>Gestion</small></span></a>
    <nav>
      ${NAV.map((n) => (typeof n === "string" ? html`<div class="group">${n}</div>`
        : html`<a href="${n[1]}" class="${section === n[0] ? "on" : ""}">${gicon(n[2])}${n[3]}</a>`))}
      <a href="/fr/" target="_blank">${gicon("home")}Voir le site</a>
    </nav>
    <div class="foot">
      Connecté : ${ctx.user?.username}<br>
      <a href="/gestion/compte/" style="color:inherit">Mot de passe</a>
      <form method="post" action="/gestion/deconnexion/"><button>Se déconnecter</button></form>
    </div>
  </aside>
  <main class="main">
    ${ctx.messages.length ? html`<ul class="msgs">${ctx.messages.map((m) => html`<li class="${m.level}">${m.text}</li>`)}</ul>` : ""}
    ${content}
  </main>
</div>
<div class="tip" id="tip"></div>
<script>
// Chart tooltips: any element with data-tip.
(function () {
  var tip = document.getElementById("tip");
  document.addEventListener("mousemove", function (e) {
    var el = e.target.closest && e.target.closest("[data-tip]");
    if (!el) { tip.style.display = "none"; return; }
    tip.textContent = el.getAttribute("data-tip");
    tip.style.display = "block";
    tip.style.left = Math.min(e.clientX + 12, window.innerWidth - tip.offsetWidth - 8) + "px";
    tip.style.top = (e.clientY - 34) + "px";
  });
  // Confirmation on buttons with data-confirm.
  document.addEventListener("click", function (e) {
    var el = e.target.closest && e.target.closest("[data-confirm]");
    if (el && !confirm(el.getAttribute("data-confirm"))) e.preventDefault();
  });
  // Big photos from a phone are shrunk before upload (the server accepts up to 4 MB).
  document.addEventListener("change", function (e) {
    var input = e.target;
    if (!input.matches || !input.matches("input[type=file][accept^=image]") || !input.files[0]) return;
    var file = input.files[0];
    if (file.size < 1500000 || !window.DataTransfer) return;
    var img = new Image(), url = URL.createObjectURL(file);
    img.onload = function () {
      var scale = Math.min(1, 1920 / Math.max(img.width, img.height));
      var c = document.createElement("canvas");
      c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      c.toBlob(function (blob) {
        var dt = new DataTransfer();
        dt.items.add(new File([blob], file.name.replace(/\\.\\w+$/, "") + ".jpg", { type: "image/jpeg" }));
        input.files = dt.files;
        URL.revokeObjectURL(url);
      }, "image/jpeg", 0.85);
    };
    img.src = url;
  });
})();
</script>
${scripts}
</body>
</html>
`);
}

export const top = (crumb, title, actions = "") => html`<div class="top">
  <div><div class="crumb">${crumb}</div><h1>${title}</h1></div>
  ${actions ? html`<div class="actions">${actions}</div>` : ""}
</div>`;

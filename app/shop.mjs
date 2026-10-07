// The public website, in French (/fr/...) and Arabic (/ar/...). Built from the live data on every visit.
import { html, raw, jsonScript, linebreaks, linebreaksbr } from "./html.mjs";
import { STRINGS, t } from "./i18n.mjs";
import { artSvg, icon } from "./svg.mjs";
import { GROUPS, byId, siteInfo } from "./model.mjs";

// Text the browser cart needs to write the WhatsApp message (see public/static/js/app.js).
const CART_KEYS = ["on_quote", "free", "currency", "wa_hello", "wa_total", "wa_quote_note",
  "wa_name", "wa_city", "wa_phone", "wa_notes", "wa_ref"];

const MOCKUP_PHOTOS = { indoor: "indoor", bullet: "outdoor", ptz: "ptz", doorbell: "doorbell" };
const SERVICE_PHOTOS = new Set(["installation-alarme", "installation-controle-acces", "contrat-maintenance", "visite-technique"]);

// 3499 -> "3 499 MAD" (درهم in Arabic). Same rule as formatMad() in app.js.
export function formatMad(value, lang) {
  if (value === null || value === undefined || value === "") return t("on_quote", lang);
  if (Number(value) === 0) return t("free", lang);
  return `${Math.trunc(Number(value)).toLocaleString("en-US").replace(/,/g, " ")} ${t("currency", lang)}`;
}

export function mockupPhoto(p) {
  const name = SERVICE_PHOTOS.has(p.slug) ? p.slug : MOCKUP_PHOTOS[p.art];
  return name ? `/static/img/photos/${name}.jpg` : "";
}

// Picture of an item: uploaded photo, else a mockup photo, else "".
export const photoOf = (p) => p.image || mockupPhoto(p);

function tr(obj, field, lang) {
  return obj[`${field}_${lang}`] || obj[`${field}_fr`] || "";
}

// A catalog item with the texts of the page language.
function view(db, p, lang) {
  return {
    ...p,
    url: `/${lang}/produit/${p.slug}/`,
    name: tr(p, "name", lang),
    short: tr(p, "short", lang),
    description: tr(p, "description", lang),
    specs: tr(p, "specs", lang).split(/\r?\n/).map((s) => s.trim()).filter(Boolean),
    on_quote: p.price === null || p.price === undefined,
    photo: photoOf(p),
    category: byId(db, "categories", p.category_id),
  };
}

const visible = (db) => db.products.filter((p) => p.active).sort((a, b) => (a.order - b.order) || (a.id - b.id));

function waUrl(db, text) {
  return `https://wa.me/${siteInfo(db).whatsapp}?text=${encodeURIComponent(text)}`;
}

// ---------------------------------------------------------------- page frame
function layout(ctx, lang, { title, content }) {
  const T = (k) => t(k, lang);
  const isRtl = lang === "ar";
  const TW = siteInfo(ctx.db);
  const other = isRtl ? "fr" : "ar";
  const parts = ctx.url.pathname.split("/");
  const langUrl = parts[1] === lang ? ["", other, ...parts.slice(2)].join("/") : `/${other}/`;
  const waContact = waUrl(ctx.db, T("wa_question"));
  const u = (path) => `/${lang}/${path}`;
  return html`<!doctype html>
<html lang="${lang}" dir="${isRtl ? "rtl" : "ltr"}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title || `Tech-Ward · ${T("tagline")}`}</title>
  <meta name="description" content="${T("footer_about")}">
  <link rel="icon" type="image/png" href="/static/img/favicon.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/static/css/style.css">
</head>
<body>
  <header class="site-header">
    <div class="container header-row">
      <a class="brand" href="${u("")}">
        <img src="/static/img/logo-mark.png" alt="" width="44" height="44">
        <span class="brand-text">
          <strong>TECH-<em>WARD</em></strong>
          <small dir="ltr">Smart Security. Safer Spaces.</small>
        </span>
      </a>

      <nav class="main-nav" id="main-nav" aria-label="${T("menu")}">
        <a href="${u("boutique/cameras/")}">${T("nav_cameras")}</a>
        <a href="${u("boutique/cameras-interieur/")}">${T("nav_indoor")}</a>
        <a href="${u("boutique/cameras-exterieur/")}">${T("nav_outdoor")}</a>
        <a href="${u("boutique/cameras-ptz/")}">${T("nav_ptz")}</a>
        <a href="${u("packs/")}">${T("nav_packs_short")}</a>
        <a href="${u("alarme-acces/")}">${T("nav_security")}</a>
        <a href="${u("contact/")}" class="nav-contact-mobile">${T("nav_contact")}</a>
      </nav>

      <div class="header-actions">
        <form class="search" action="${u("boutique/")}" role="search">
          <input type="search" name="q" placeholder="${T("search_placeholder")}" aria-label="${T("search_placeholder")}">
          <button type="submit" aria-label="${T("search_placeholder")}">${icon("search")}</button>
        </form>
        <a class="lang" href="${langUrl}">${isRtl ? "FR" : "عربي"}</a>
        <a class="cart-link" href="${u("panier/")}" aria-label="${T("cart")}">
          ${icon("cart")}
          <span class="cart-count" data-cart-count hidden>0</span>
        </a>
        <a class="btn btn-navy btn-sm hide-sm" href="${u("contact/")}">${T("nav_contact")}</a>
        <!-- Owner only: shown when logged in to Gestion, or in a browser that opened the site once with ?gestion=1 (?gestion=0 hides it). -->
        <a class="btn btn-outline btn-sm" id="manage-link" href="/gestion/"${ctx.user ? "" : raw(" hidden")}>${isRtl ? "الإدارة" : "Gestion"}</a>
        <script>
          (function () {
            var link = document.getElementById("manage-link"), flag = new URLSearchParams(location.search).get("gestion");
            try { if (flag === "1") localStorage.setItem("tw-manage", "1"); if (flag === "0") localStorage.removeItem("tw-manage"); } catch (e) {}
            try { if (localStorage.getItem("tw-manage") === "1") link.hidden = false; } catch (e) {}
          })();
        </script>
        <button class="menu-toggle" type="button" aria-controls="main-nav" aria-expanded="false" aria-label="${T("menu")}">
          ${icon("menu")}
        </button>
      </div>
    </div>
  </header>

  <main>${content}</main>

  <footer class="site-footer">
    <div class="container footer-grid">
      <div>
        <img class="footer-logo" src="/static/img/logo-full.png" alt="Tech-Ward" width="170">
        <p>${T("footer_about")}</p>
      </div>
      <div>
        <h4>${T("footer_shop")}</h4>
        <a href="${u("boutique/cameras/")}">${T("nav_cameras")}</a>
        <a href="${u("packs/")}">${T("nav_packs")}</a>
        <a href="${u("alarme-acces/")}">${T("nav_security")}</a>
        <a href="${u("boutique/accessories/")}">${T("grp_accessories")}</a>
      </div>
      <div>
        <h4>${T("footer_help")}</h4>
        <a href="${u("contact/")}">${T("nav_contact")}</a>
        <a href="${u("panier/")}">${T("cart")}</a>
        <span>${T("footer_payment")}</span>
        <span>${T("zone_value")}</span>
      </div>
      <div>
        <h4>${T("nav_contact")}</h4>
        <a href="${waContact}" target="_blank" rel="noopener" dir="ltr">WhatsApp · ${TW.phone_display}</a>
        <a href="mailto:${TW.email}">${TW.email}</a>
        ${TW.address ? html`<span>${TW.address}</span>` : ""}
        <span>${T("hours_value")}</span>
      </div>
    </div>
    <div class="container footer-bottom">© ${new Date().getFullYear()} Tech-Ward. ${T("rights")}</div>
  </footer>

  <a class="wa-float" href="${waContact}" target="_blank" rel="noopener" aria-label="WhatsApp">
    ${icon("whatsapp")}
  </a>
  <div class="toast" id="toast" role="status" aria-live="polite" data-added="${T("added")}" hidden>
    <span data-toast-text></span>
    <a href="${u("panier/")}">${T("view_cart")}</a>
  </div>
  <script src="/static/js/app.js" defer></script>
</body>
</html>
`;
}

// ---------------------------------------------------------------- pieces
function media(p, label) {
  if (p.photo) return html`<img src="${p.photo}" alt="${label}" loading="lazy">`;
  return artSvg(p.art, p.id, label);
}

function card(p, lang) {
  const T = (k) => t(k, lang);
  return html`
<article class="card" data-search="${p.name_fr} ${p.name_ar} ${p.brand} ${p.short_fr} ${p.short_ar}">
  <a class="card-media" href="${p.url}" tabindex="-1">
    ${media(p, p.name)}
    ${p.brand ? html`<span class="badge">${p.brand}</span>` : ""}
  </a>
  <div class="card-body">
    <h3><a href="${p.url}">${p.name}</a></h3>
    ${p.short ? html`<p class="muted">${p.short}</p>` : ""}
    <ul class="specs">
      ${p.specs.slice(0, 4).map((s) => html`<li>${icon("spec")}${s}</li>`)}
    </ul>
    <div class="card-foot">
      <span class="price">${p.old_price ? html`<s>${formatMad(p.old_price, lang)}</s>` : ""}${formatMad(p.price, lang)}</span>
      <button class="btn btn-outline btn-sm" type="button" data-add="${p.id}" data-name="${p.name}">${icon("cart")}${p.on_quote ? T("request_quote") : T("add_to_cart")}</button>
    </div>
  </div>
</article>`;
}

function packCard(p, lang) {
  const T = (k) => t(k, lang);
  return html`
<article class="pack${p.featured ? " pack-featured" : ""}">
  ${p.featured ? html`<span class="pack-flag">${T("most_popular")}</span>` : ""}
  <h3><a href="${p.url}">${p.name}</a></h3>
  <p class="muted">${p.short}</p>
  <div class="pack-price">${formatMad(p.price, lang)}</div>
  <ul class="checks">
    ${p.specs.map((s) => html`<li>${icon("check")}${s}</li>`)}
  </ul>
  <button class="btn ${p.featured ? "btn-blue" : "btn-navy"} btn-block" type="button" data-add="${p.id}" data-name="${p.name}">${icon("cart")}${T("add_to_cart")}</button>
</article>`;
}

function benefits(lang) {
  const T = (k) => t(k, lang);
  const b = (ic, n) => html`<div class="benefit"><span class="benefit-icon">${icon(ic)}</span><div><h4>${T(`b${n}_t`)}</h4><p>${T(`b${n}`)}</p></div></div>`;
  return html`
<section class="benefits">
  <div class="container benefits-grid">
    ${b("clock", 1)}
    ${b("phone", 2)}
    ${b("moon", 3)}
    ${b("wrench", 4)}
  </div>
</section>`;
}

const crumbs = (lang, ...rest) => html`<nav class="crumbs"><a href="/${lang}/">${t("breadcrumb_home", lang)}</a> / ${rest}</nav>`;

// ---------------------------------------------------------------- pages
function home(ctx, lang) {
  const T = (k) => t(k, lang);
  const db = ctx.db;
  const items = visible(db).map((p) => view(db, p, lang));
  const featured = items.filter((p) => p.kind === "product" && p.featured).slice(0, 4);
  const packs = items.filter((p) => p.kind === "pack").slice(0, 4);
  const services = items.filter((p) => p.kind === "service").slice(0, 4);
  const site = db.site || {};
  const hero = {
    image: site.hero_image || (lang === "ar" ? "/static/img/photos/hero-rtl.jpg" : "/static/img/photos/hero.jpg"),
    title: (site[`hero_title_${lang}`] || "").trim(),
    text: (site[`hero_text_${lang}`] || "").trim(),
  };
  const place = (n, hd, img, w, h) => html`<figure class="placement-item"><a class="placement-zoom" href="/static/img/photos/${hd}" data-zoom aria-label="${T("place_zoom")}"><img src="/static/img/photos/${img}" alt="${T(`place_${n}_t`)}" width="${w}" height="${h}" loading="lazy" decoding="async"></a><figcaption><h4>${T(`place_${n}_t`)}</h4><p>${T(`place_${n}`)}</p></figcaption></figure>`;
  const content = html`
<section class="hero" style="--hero: url('${hero.image}')">
  <div class="container hero-inner">
    <h1>${hero.title ? linebreaksbr(hero.title) : html`${T("hero_title_1")}<br>${T("hero_title_2")}`}</h1>
    <p>${hero.text || T("hero_text")}</p>
    <div class="hero-ctas">
      <a class="btn btn-navy" href="/${lang}/boutique/cameras/">${T("hero_cta")} ${icon("arrow")}</a>
      <a class="btn btn-light" href="/${lang}/packs/">${T("hero_cta_2")}</a>
    </div>
  </div>
</section>

<section class="section">
  <div class="container">
    <div class="section-head">
      <div>
        <p class="kicker">${T("our_products")}</p>
        <h2>${T("cameras_title")}</h2>
      </div>
      <a class="link-arrow" href="/${lang}/boutique/">${T("view_all")} ${icon("arrow")}</a>
    </div>
    <div class="grid grid-4">
      ${featured.map((p) => card(p, lang))}
    </div>
  </div>
</section>

<section class="section section-tint placement">
  <div class="container">
    <div class="section-head">
      <div>
        <p class="kicker">${T("place_kicker")}</p>
        <h2>${T("place_title")}</h2>
        <p class="lead">${T("place_text")}</p>
      </div>
    </div>
    <div class="placement-grid" data-close-label="${T("close")}">
      ${place(1, "placement-plan-hd.jpg", "placement-plan.jpg", 1200, 670)}
      ${place(2, "placement-perimetre-hd.jpg", "placement-perimetre.jpg", 727, 727)}
      ${place(3, "placement-nuit-hd.jpg", "placement-nuit.jpg", 1200, 717)}
      ${place(4, "placement-interieur-hd.jpg", "placement-interieur.jpg", 1200, 896)}
    </div>
    <div class="placement-ctas">
      <a class="btn btn-navy" href="/${lang}/packs/">${T("place_cta")} ${icon("arrow")}</a>
      <a class="btn btn-wa" href="${waUrl(db, T("wa_visit"))}" target="_blank" rel="noopener">${icon("whatsapp")}${T("place_visit")}</a>
    </div>
  </div>
</section>

${benefits(lang)}

${packs.length ? html`
<section class="section">
  <div class="container">
    <div class="section-head">
      <div>
        <p class="kicker">${T("packs_kicker")}</p>
        <h2>${T("packs_title")}</h2>
        <p class="lead">${T("packs_text")}</p>
      </div>
      <a class="link-arrow" href="/${lang}/packs/">${T("nav_packs")} ${icon("arrow")}</a>
    </div>
    <div class="grid grid-4">
      ${packs.map((p) => packCard(p, lang))}
    </div>
  </div>
</section>` : ""}

${services.length ? html`
<section class="section section-tint">
  <div class="container">
    <div class="section-head">
      <div>
        <p class="kicker">${T("security_kicker")}</p>
        <h2>${T("security_title")}</h2>
        <p class="lead">${T("security_text")}</p>
      </div>
      <a class="link-arrow" href="/${lang}/alarme-acces/">${T("nav_security")} ${icon("arrow")}</a>
    </div>
    <div class="grid grid-4">
      ${services.map((p) => card(p, lang))}
    </div>
  </div>
</section>` : ""}

<section class="section">
  <div class="container">
    <h2 class="center">${T("how_title")}</h2>
    <ol class="steps">
      ${[1, 2, 3, 4].map((n) => html`<li><span>${n}</span><h4>${T(`how_${n}_t`)}</h4><p>${T(`how_${n}`)}</p></li>`)}
    </ol>
  </div>
</section>

<section class="cta-band">
  <div class="container cta-inner">
    <div>
      <h2>${T("contact_title")}</h2>
      <p>${T("contact_text")}</p>
    </div>
    <a class="btn btn-wa" href="${waUrl(db, T("wa_question"))}" target="_blank" rel="noopener">${icon("whatsapp")}${T("write_whatsapp")}</a>
  </div>
</section>`;
  return ctx.html(layout(ctx, lang, { content }));
}

// All products, a group (cameras, alarm...) or one category. Search runs in the browser.
function productList(ctx, lang, cat = "") {
  const T = (k) => t(k, lang);
  const db = ctx.db;
  let products = visible(db).filter((p) => p.kind === "product");
  let currentName = "";
  if (cat) {
    if (GROUPS.some(([g]) => g === cat)) {
      products = products.filter((p) => byId(db, "categories", p.category_id)?.group === cat);
      currentName = T(`grp_${cat}`);
    } else {
      const category = db.categories.find((c) => c.slug === cat);
      if (!category) return null;
      products = products.filter((p) => p.category_id === category.id);
      currentName = tr(category, "name", lang);
    }
  }
  products = products.map((p) => view(db, p, lang));
  const categories = [...db.categories].sort((a, b) => (a.order - b.order) || a.name_fr.localeCompare(b.name_fr));
  const content = html`
<section class="page-head">
  <div class="container">
    ${crumbs(lang, T("nav_shop"))}
    <h1 data-results-title="${T("results_for")}">${currentName || T("all_products")}</h1>
  </div>
</section>
<section class="section section-tight">
  <div class="container">
    <div class="chips">
      <a class="chip${!cat ? " active" : ""}" href="/${lang}/boutique/">${T("all_products")}</a>
      <a class="chip${cat === "cameras" ? " active" : ""}" href="/${lang}/boutique/cameras/">${T("grp_cameras")}</a>
      ${categories.map((c) => html`<a class="chip${cat === c.slug ? " active" : ""}" href="/${lang}/boutique/${c.slug}/">${tr(c, "name", lang)}</a>`)}
    </div>
    <div class="grid grid-4" data-searchable>${products.map((p) => card(p, lang))}</div>
    <p class="empty" data-no-results${products.length ? raw(" hidden") : ""}>${T("no_results")}</p>
  </div>
</section>
${benefits(lang)}`;
  return ctx.html(layout(ctx, lang, { title: `${currentName || T("nav_shop")} · Tech-Ward`, content }));
}

function productDetail(ctx, lang, slug) {
  const T = (k) => t(k, lang);
  const db = ctx.db;
  const raw_ = visible(db).find((p) => p.slug === slug);
  if (!raw_) return null;
  const product = view(db, raw_, lang);
  let related = visible(db).filter((p) => p.kind === product.kind && p.id !== product.id);
  if (product.category) related = related.filter((p) => byId(db, "categories", p.category_id)?.group === product.category.group);
  related = related.slice(0, 4).map((p) => view(db, p, lang));
  const questionUrl = waUrl(db, `${T("wa_about")} ${product.name}`);
  const crumb = product.kind === "pack" ? html`<a href="/${lang}/packs/">${T("nav_packs")}</a>`
    : product.kind === "service" ? html`<a href="/${lang}/alarme-acces/">${T("nav_security")}</a>`
    : product.category ? html`<a href="/${lang}/boutique/${product.category.slug}/">${tr(product.category, "name", lang)}</a>` : "";
  const content = html`
<section class="section">
  <div class="container">
    <nav class="crumbs">
      <a href="/${lang}/">${T("breadcrumb_home")}</a> /
      ${crumb}
    </nav>
    <div class="detail">
      <div class="detail-media">
        ${product.photo ? html`<img src="${product.photo}" alt="${product.name}">`
          : html`${artSvg(product.art, "d", product.name)}<span class="photo-note">${T("placeholder_note")}</span>`}
      </div>
      <div class="detail-info">
        ${product.brand ? html`<p class="kicker">${product.brand}</p>` : ""}
        <h1>${product.name}</h1>
        <p class="lead">${product.short}</p>
        <div class="detail-price">${product.old_price ? html`<s>${formatMad(product.old_price, lang)}</s>` : ""}${formatMad(product.price, lang)}</div>
        <div class="buy">
          <label class="qty"><span>${T("quantity")}</span><input type="number" id="qty" value="1" min="1" max="99"></label>
          <button class="btn btn-navy" type="button" data-add="${product.id}" data-name="${product.name}" data-qty-from="#qty">${icon("cart")}${product.on_quote ? T("request_quote") : T("add_to_cart")}</button>
        </div>
        <a class="btn btn-wa-outline" href="${questionUrl}" target="_blank" rel="noopener">${icon("whatsapp")}${T("ask_question")}</a>
        ${product.specs.length ? html`
        <h3>${T("features")}</h3>
        <ul class="checks">${product.specs.map((s) => html`<li>${icon("check")}${s}</li>`)}</ul>` : ""}
        ${product.description ? html`<div class="prose">${linebreaks(product.description)}</div>` : ""}
        <p class="note">${T("footer_payment")} · ${T("zone_value")}</p>
      </div>
    </div>
  </div>
</section>
${related.length ? html`
<section class="section section-tint">
  <div class="container">
    <h2>${T("related")}</h2>
    <div class="grid grid-4">${related.map((p) => card(p, lang))}</div>
  </div>
</section>` : ""}`;
  return ctx.html(layout(ctx, lang, { title: `${product.name} · Tech-Ward`, content }));
}

function packs(ctx, lang) {
  const T = (k) => t(k, lang);
  const list = visible(ctx.db).filter((p) => p.kind === "pack").map((p) => view(ctx.db, p, lang));
  const content = html`
<section class="page-head">
  <div class="container">
    ${crumbs(lang, T("nav_packs"))}
    <p class="kicker">${T("packs_kicker")}</p>
    <h1>${T("packs_title")}</h1>
    <p class="lead">${T("packs_text")}</p>
  </div>
</section>
<section class="section section-tight">
  <div class="container">
    <div class="grid grid-4">${list.map((p) => packCard(p, lang))}</div>
    <div class="includes">
      <h3>${T("pack_includes")}</h3>
      <ul class="checks checks-inline">
        ${[1, 2, 3, 4].map((n) => html`<li>${icon("check")}${T(`pack_inc_${n}`)}</li>`)}
      </ul>
      <p class="muted">${T("packs_addons")}</p>
    </div>
  </div>
</section>
${benefits(lang)}`;
  return ctx.html(layout(ctx, lang, { title: `${T("nav_packs")} · Tech-Ward`, content }));
}

function security(ctx, lang) {
  const T = (k) => t(k, lang);
  const db = ctx.db;
  const services = visible(db).filter((p) => p.kind === "service").map((p) => view(db, p, lang));
  const products = visible(db).filter((p) => p.kind === "product"
    && ["alarm", "access"].includes(byId(db, "categories", p.category_id)?.group)).map((p) => view(db, p, lang));
  const content = html`
<section class="page-head">
  <div class="container">
    ${crumbs(lang, T("nav_security"))}
    <p class="kicker">${T("security_kicker")}</p>
    <h1>${T("security_title")}</h1>
    <p class="lead">${T("security_text")}</p>
  </div>
</section>
<section class="section section-tight">
  <div class="container">
    <div class="grid grid-4">${services.map((p) => card(p, lang))}</div>
  </div>
</section>
${products.length ? html`
<section class="section section-tint">
  <div class="container">
    <div class="section-head">
      <h2>${T("grp_alarm")} · ${T("grp_access")}</h2>
      <a class="link-arrow" href="/${lang}/boutique/access/">${T("view_all")} ${icon("arrow")}</a>
    </div>
    <div class="grid grid-4">${products.map((p) => card(p, lang))}</div>
  </div>
</section>` : ""}`;
  return ctx.html(layout(ctx, lang, { title: `${T("nav_security")} · Tech-Ward`, content }));
}

function contact(ctx, lang) {
  const T = (k) => t(k, lang);
  const TW = siteInfo(ctx.db);
  const questionUrl = waUrl(ctx.db, T("wa_question"));
  const content = html`
<section class="page-head">
  <div class="container">
    ${crumbs(lang, T("nav_contact"))}
    <h1>${T("contact_title")}</h1>
    <p class="lead">${T("contact_text")}</p>
  </div>
</section>
<section class="section section-tight">
  <div class="container contact-grid">
    <a class="contact-card contact-wa" href="${questionUrl}" target="_blank" rel="noopener">
      <span class="benefit-icon">${icon("whatsapp")}</span>
      <div><h4>${T("whatsapp")}</h4><p dir="ltr">${TW.phone_display}</p></div>
    </a>
    <a class="contact-card" href="mailto:${TW.email}">
      <span class="benefit-icon">${icon("mail")}</span>
      <div><h4>${T("email")}</h4><p>${TW.email}</p></div>
    </a>
    <div class="contact-card">
      <span class="benefit-icon">${icon("pin")}</span>
      <div>${TW.address ? html`<h4>${lang === "ar" ? "العنوان" : "Adresse"}</h4><p>${TW.address}<br>${T("zone_value")}</p>`
        : html`<h4>${T("zone")}</h4><p>${T("zone_value")}</p>`}</div>
    </div>
    <div class="contact-card">
      <span class="benefit-icon">${icon("clock")}</span>
      <div><h4>${T("hours")}</h4><p>${T("hours_value")}</p></div>
    </div>
  </div>
  <div class="container center" style="margin-top:32px">
    <a class="btn btn-wa" href="${questionUrl}" target="_blank" rel="noopener">${icon("whatsapp")}${T("write_whatsapp")}</a>
  </div>
</section>`;
  return ctx.html(layout(ctx, lang, { title: `${T("nav_contact")} · Tech-Ward`, content }));
}

// The cart lives in the visitor's browser; this page ships every item it may show.
function cart(ctx, lang) {
  const T = (k) => t(k, lang);
  const db = ctx.db;
  const items = visible(db).map((p) => view(db, p, lang));
  const cartData = {
    whatsapp: siteInfo(db).whatsapp,
    lang,
    t: Object.fromEntries(CART_KEYS.map((k) => [k, STRINGS[k][lang === "fr" ? 0 : 1]])),
  };
  const content = html`
<section class="page-head">
  <div class="container">
    ${crumbs(lang, T("cart"))}
    <h1>${T("cart_title")}</h1>
  </div>
</section>
<section class="section section-tight">
  <div class="container" data-cart-page>
    <div class="empty" data-cart-empty>
      <p>${T("cart_empty")}</p>
      <a class="btn btn-navy" href="/${lang}/boutique/">${T("continue_shopping")}</a>
    </div>

    <div class="cart-layout" data-cart-full hidden>
      <div class="cart-lines">
        <div data-cart-lines></div>
        <a class="link-arrow" href="/${lang}/boutique/">${T("continue_shopping")} ${icon("arrow")}</a>
      </div>

      <form class="checkout" data-checkout>
        <div class="sum">
          <span>${T("subtotal")}</span>
          <strong data-cart-total></strong>
        </div>
        <p class="muted small" data-quote-note hidden>${T("quote_items_note")}</p>
        <h3>${T("your_details")}</h3>
        <label>${T("your_name")} *<input name="name" required maxlength="100" autocomplete="name"></label>
        <label>${T("your_city")} *<input name="city" required maxlength="60" autocomplete="address-level2"></label>
        <label>${T("your_phone")}<input name="phone" type="tel" maxlength="30" autocomplete="tel" dir="ltr"></label>
        <label>${T("your_notes")}<textarea name="notes" rows="3" maxlength="500"></textarea></label>
        <button class="btn btn-wa btn-block" type="submit">${icon("whatsapp")}${T("order_button")}</button>
        <p class="muted small">${T("order_note")}</p>
      </form>
    </div>
  </div>
</section>

${items.map((p) => html`
<template data-cart-item="${p.id}" data-name="${p.name}" data-price="${p.on_quote ? "" : p.price}">
  <div class="cart-line">
    <a class="cart-thumb" href="${p.url}">
      ${p.photo ? html`<img src="${p.photo}" alt="">` : artSvg(p.art, p.id, "")}
    </a>
    <div class="cart-info">
      <a href="${p.url}"><strong>${p.name}</strong></a>
      <span class="muted">${formatMad(p.price, lang)}</span>
    </div>
    <div class="stepper">
      <button type="button" data-step="-1" aria-label="-">−</button>
      <span data-qty></span>
      <button type="button" data-step="1" aria-label="+">+</button>
    </div>
    <strong class="cart-total" data-line-total></strong>
    <button type="button" class="icon-btn" data-remove aria-label="${T("remove")}" title="${T("remove")}">${icon("trash")}</button>
  </div>
</template>`)}
${jsonScript(cartData, "cart-data")}`;
  return ctx.html(layout(ctx, lang, { title: `${T("cart_title")} · Tech-Ward`, content }));
}

export function notFound(ctx) {
  const lang = ctx.url.pathname.startsWith("/ar/") ? "ar" : "fr";
  const content = html`
<section class="page-head"><div class="container">
  ${crumbs(lang, "404")}
  <h1>${lang === "ar" ? "الصفحة غير موجودة" : "Page introuvable"}</h1>
  <p class="lead"><a class="link-arrow" href="/${lang}/">${t("breadcrumb_home", lang)} ${icon("arrow")}</a></p>
</div></section>`;
  return ctx.html(layout(ctx, lang, { title: "404 · Tech-Ward", content }), 404);
}

// Visitors arriving on "/" go to Arabic or French from their browser language.
function root(ctx) {
  const accept = ctx.req.headers.get("accept-language") || "";
  return ctx.redirect(accept.toLowerCase().startsWith("ar") ? "/ar/" : "/fr/", 302);
}

const L = "(fr|ar)";
export const shopRoutes = [
  { method: "GET", path: /^\/$/, handler: root },
  { method: "GET", path: new RegExp(`^/${L}/$`), handler: home },
  { method: "GET", path: new RegExp(`^/${L}/boutique/$`), handler: (ctx, lang) => productList(ctx, lang) },
  { method: "GET", path: new RegExp(`^/${L}/boutique/([\\w-]+)/$`), handler: productList },
  { method: "GET", path: new RegExp(`^/${L}/produit/([\\w-]+)/$`), handler: productDetail },
  { method: "GET", path: new RegExp(`^/${L}/packs/$`), handler: packs },
  { method: "GET", path: new RegExp(`^/${L}/alarme-acces/$`), handler: security },
  { method: "GET", path: new RegExp(`^/${L}/contact/$`), handler: contact },
  { method: "GET", path: new RegExp(`^/${L}/panier/$`), handler: cart },
];

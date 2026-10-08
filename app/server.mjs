// One handler for the whole site: the public pages (/fr/..., /ar/...) and Gestion (/gestion/...).
// Both read the same data, so what you change in Gestion is on the website right away.
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { storage } from "./storage.mjs";
import { fixSeq, seededDb, syncOffers } from "./model.mjs";
import { notFound, shopRoutes } from "./shop.mjs";
import { gestionRoutes } from "./gestion/index.mjs";

const SESSION_DAYS = 30;

export class Conflict extends Error {}

// ---------------------------------------------------------------- cookies and login
function parseCookies(header) {
  const out = {};
  for (const part of (header || "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function cookie(name, value, { maxAge, secure } = {}) {
  let c = `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax`;
  if (maxAge !== undefined) c += `; Max-Age=${maxAge}`;
  if (secure) c += "; Secure";
  return c;
}

const sign = (secret, text) => createHmac("sha256", secret).update(text).digest("base64url");

export function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  return `scrypt$${salt}$${scryptSync(password, salt, 64).toString("hex")}`;
}

export function checkPassword(password, stored) {
  const [algo, salt, hash] = String(stored || "").split("$");
  if (algo !== "scrypt" || !salt || !hash) return false;
  const a = scryptSync(password, salt, 64), b = Buffer.from(hash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

// ---------------------------------------------------------------- request context
class Ctx {
  constructor(req, store, db, etag) {
    this.req = req;
    this.url = new URL(req.url);
    this.method = req.method.toUpperCase();
    this.query = this.url.searchParams;
    this.store = store;
    this.db = db;
    this.etag = etag;
    this.cookies = parseCookies(req.headers.get("cookie"));
    this.secure = this.url.protocol === "https:";
    this.setCookies = [];
    this.messages = [];
    this.outMessages = [];
    if (this.cookies.tw_flash) {
      try { this.messages = JSON.parse(Buffer.from(this.cookies.tw_flash, "base64url").toString()); } catch { /* ignore */ }
      this.setCookies.push(cookie("tw_flash", "", { maxAge: 0 }));
    }
    this.user = this.readSession();
  }

  readSession() {
    const [name, exp, sig] = (this.cookies.tw_session || "").split(".");
    if (!name || !exp || !sig || Number(exp) < Date.now() / 1000) return null;
    if (sig !== sign(this.db.secret, `${name}.${exp}`)) return null;
    const username = Buffer.from(name, "base64url").toString();
    return this.db.users.find((u) => u.username === username) || null;
  }

  login(user) {
    const exp = Math.floor(Date.now() / 1000) + SESSION_DAYS * 86400;
    const name = Buffer.from(user.username).toString("base64url");
    this.setCookies.push(cookie("tw_session", `${name}.${exp}.${sign(this.db.secret, `${name}.${exp}`)}`,
      { maxAge: SESSION_DAYS * 86400, secure: this.secure }));
  }

  logout() {
    this.setCookies.push(cookie("tw_session", "", { maxAge: 0 }));
  }

  flash(level, text) {
    this.outMessages.push({ level, text });
  }

  async form() {
    if (!this._form) this._form = await this.req.formData();
    return this._form;
  }

  // Saves the data. Fails if someone else saved since this page was loaded.
  async commit() {
    const ok = await this.store.writeJSON("db", this.db, this.etag);
    if (!ok) throw new Conflict();
    const fresh = await this.store.readJSON("db");
    this.etag = fresh?.etag;
  }

  headers(extra = {}) {
    const h = new Headers(extra);
    const cookies = [...this.setCookies];
    if (this.outMessages.length)
      cookies.push(cookie("tw_flash", Buffer.from(JSON.stringify(this.outMessages)).toString("base64url")));
    for (const c of cookies) h.append("Set-Cookie", c);
    return h;
  }

  html(body, status = 200) {
    return new Response(String(body), { status, headers: this.headers({
      "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" }) });
  }

  redirect(location, status = 303) {
    return new Response(null, { status, headers: this.headers({ Location: location, "Cache-Control": "no-store" }) });
  }

  file(body, contentType, extra = {}) {
    return new Response(body, { status: 200, headers: this.headers({ "Content-Type": contentType, ...extra }) });
  }
}

// ---------------------------------------------------------------- routing
const ROUTES = [...gestionRoutes, ...shopRoutes];

async function loadDb(store) {
  let found = await store.readJSON("db");
  if (!found) {
    // Very first visit: start from the catalog in seed.mjs.
    await store.writeJSON("db", seededDb(), null);
    found = await store.readJSON("db");
  }
  const db = found.value;
  fixSeq(db);
  return { db, etag: found.etag };
}

function sameOrigin(req, url) {
  const origin = req.headers.get("origin");
  if (!origin || origin === "null") return !req.headers.get("sec-fetch-site") || req.headers.get("sec-fetch-site") === "same-origin";
  try { return new URL(origin).host === url.host; } catch { return false; }
}

const PLAIN = { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" };

export async function handle(req) {
  const url = new URL(req.url);
  // Pictures uploaded from Gestion.
  if (url.pathname.startsWith("/media/")) {
    const store = await storage();
    const file = await store.getFile(decodeURIComponent(url.pathname.slice(1)));
    if (!file) return new Response("Introuvable", { status: 404, headers: PLAIN });
    return new Response(file.body, { headers: { "Content-Type": file.contentType,
      "Cache-Control": "public, max-age=31536000, immutable" } });
  }
  if (!url.pathname.endsWith("/") && !/\.[a-z0-9]+$/i.test(url.pathname))
    return Response.redirect(new URL(url.pathname + "/" + url.search, url), 301);

  if (req.method === "POST" && !sameOrigin(req, url))
    return new Response("Requête refusée.", { status: 403, headers: PLAIN });

  const store = await storage();
  attempts: for (let attempt = 0; attempt < 3; attempt++) {
    const { db, etag } = await loadDb(store);
    const ctx = new Ctx(req, store, db, etag);
    // Offers start and end on their dates without anyone pressing a button.
    if (syncOffers(db)) {
      try { await ctx.commit(); } catch (e) { if (e instanceof Conflict) continue; throw e; }
    }
    for (const route of ROUTES) {
      if (route.method && route.method !== ctx.method) continue;
      const m = url.pathname.match(route.path);
      if (!m) continue;
      try {
        const res = await route.handler(ctx, ...m.slice(1).map((v) => decodeURIComponent(v ?? "")));
        if (res) return res;
      } catch (e) {
        if (e instanceof Conflict) {
          if (ctx.method === "GET") continue attempts;  // reload and try again
          return new Response("Les données ont été modifiées entre-temps (autre onglet ?). Revenez en arrière et réessayez.",
            { status: 409, headers: PLAIN });
        }
        console.error(e);
        return new Response("Erreur interne. Réessayez dans un instant.", { status: 500, headers: PLAIN });
      }
    }
    return notFound(ctx);
  }
  return new Response("Erreur temporaire, rechargez la page.", { status: 503, headers: PLAIN });
}

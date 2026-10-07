// Login, first account, logout, password change.
import { html } from "../html.mjs";
import { insert } from "../model.mjs";
import { checkPassword, hashPassword } from "../server.mjs";
import { page, top } from "./ui.mjs";

// The very first account needs this code, so nobody else can claim Gestion before you do.
// Only its scrypt hash is here; the code itself was given to Youness. TECHWARD_SETUP_CODE on Netlify replaces it.
const SETUP_CODE_HASH = "scrypt$51a2ccac8fc68ccb67716e4b1f06b70a$06944d1a75b11c0a91cdb307ed5d0a6fdeddc1f6def21e29fb150544a3b59750aefc12f61079e0bc71d760878ed98986227a7fa66ea4d1f797b5b53435725daf";

function setupCodeOk(code) {
  const own = process.env.TECHWARD_SETUP_CODE;
  if (own) return code.trim().toUpperCase() === own.trim().toUpperCase();
  return checkPassword(code.trim().toUpperCase(), SETUP_CODE_HASH);
}

function loginPage(ctx, { setup = false, error = "", username = "" } = {}) {
  return ctx.html(html`<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Connexion · Tech-Ward Gestion</title><link rel="icon" href="/static/img/favicon.png">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/static/gestion/gestion.css"></head>
<body><div class="login"><form class="card" method="post">
  <img src="/static/img/logo-full.png" alt="Tech-Ward">
  <h2 style="text-align:center">${setup ? "Créer votre compte de gestion" : "Espace de gestion"}</h2>
  ${setup ? html`<p class="small muted" style="text-align:center">Première visite : choisissez l'identifiant et le mot de passe qui protégeront la gestion.</p>` : ""}
  ${error ? html`<p class="note">${error}</p>` : ""}
  <div class="stack">
    <div class="field"><label for="id_username">Identifiant</label><input name="username" id="id_username" value="${username}" required autocomplete="username" autocapitalize="none"></div>
    <div class="field"><label for="id_password">Mot de passe</label><input type="password" name="password" id="id_password" required autocomplete="${setup ? "new-password" : "current-password"}"${setup ? html` minlength="8"` : ""}></div>
    ${setup ? html`<div class="field"><label for="id_code">Code d'installation</label><input name="code" id="id_code" required autocomplete="off" autocapitalize="characters"></div>` : ""}
    ${setup ? html`<div class="field"><label for="id_password2">Confirmer le mot de passe</label><input type="password" name="password2" id="id_password2" required minlength="8" autocomplete="new-password"></div>` : ""}
  </div>
  <input type="hidden" name="next" value="${ctx.query.get("next") || ""}">
  <div class="form-actions"><button class="btn primary" style="width:100%;justify-content:center">${setup ? "Créer le compte" : "Se connecter"}</button></div>
</form></div></body></html>`, error ? 400 : 200);
}

const safeNext = (next) => (next && next.startsWith("/gestion/") && !next.startsWith("//") ? next : "/gestion/");

async function login(ctx) {
  const setup = ctx.db.users.length === 0;
  if (ctx.method !== "POST") return loginPage(ctx, { setup });
  const form = await ctx.form();
  const username = String(form.get("username") || "").trim();
  const password = String(form.get("password") || "");
  if (setup) {
    if (!setupCodeOk(String(form.get("code") || ""))) return loginPage(ctx, { setup, username, error: "Code d'installation incorrect." });
    if (password.length < 8) return loginPage(ctx, { setup, username, error: "Le mot de passe doit faire au moins 8 caractères." });
    if (password !== form.get("password2")) return loginPage(ctx, { setup, username, error: "Les deux mots de passe ne sont pas identiques." });
    if (!username) return loginPage(ctx, { setup, error: "Choisissez un identifiant." });
    const user = insert(ctx.db, "users", { username, password: hashPassword(password) });
    await ctx.commit();
    ctx.login(user);
    ctx.flash("success", "Compte créé. Bienvenue dans la gestion de Tech-Ward.");
    return ctx.redirect("/gestion/");
  }
  const user = ctx.db.users.find((u) => u.username.toLowerCase() === username.toLowerCase());
  if (!user || !checkPassword(password, user.password))
    return loginPage(ctx, { username, error: "Identifiant ou mot de passe incorrect." });
  ctx.login(user);
  return ctx.redirect(safeNext(form.get("next")));
}

async function logout(ctx) {
  ctx.logout();
  return ctx.redirect("/gestion/connexion/");
}

async function account(ctx) {
  let error = "";
  if (ctx.method === "POST") {
    const form = await ctx.form();
    const user = ctx.db.users.find((u) => u.id === ctx.user.id);
    const p1 = String(form.get("new") || "");
    if (!checkPassword(String(form.get("old") || ""), user.password)) error = "Mot de passe actuel incorrect.";
    else if (p1.length < 8) error = "Le nouveau mot de passe doit faire au moins 8 caractères.";
    else if (p1 !== form.get("new2")) error = "Les deux nouveaux mots de passe ne sont pas identiques.";
    else {
      user.password = hashPassword(p1);
      await ctx.commit();
      ctx.flash("success", "Mot de passe changé.");
      return ctx.redirect("/gestion/");
    }
  }
  const content = html`${top("Compte", "Changer le mot de passe")}
<form class="card" method="post" style="max-width:480px">
  ${error ? html`<p class="note">${error}</p>` : ""}
  <div class="form-grid" style="grid-template-columns:1fr">
    <div class="field"><label for="id_old">Mot de passe actuel</label><input type="password" name="old" id="id_old" required autocomplete="current-password"></div>
    <div class="field"><label for="id_new">Nouveau mot de passe</label><input type="password" name="new" id="id_new" required minlength="8" autocomplete="new-password"></div>
    <div class="field"><label for="id_new2">Confirmer</label><input type="password" name="new2" id="id_new2" required minlength="8" autocomplete="new-password"></div>
  </div>
  <div class="form-actions"><a class="btn" href="/gestion/">Annuler</a><button class="btn primary">Enregistrer</button></div>
</form>`;
  return page(ctx, { title: "Mot de passe", section: "", content });
}

export const authRoutes = [
  { path: /^\/gestion\/connexion\/$/, handler: login, public: true },
  { method: "POST", path: /^\/gestion\/deconnexion\/$/, handler: logout, public: true },
  { path: /^\/gestion\/compte\/$/, handler: account },
];

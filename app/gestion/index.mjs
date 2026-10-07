// Gestion (/gestion/...): every page needs a login, except the login page itself.
import { authRoutes } from "./auth.mjs";
import { catalogRoutes } from "./catalog.mjs";
import { opsRoutes } from "./ops.mjs";
import { orderRoutes } from "./orders.mjs";
import { peopleRoutes } from "./people.mjs";
import { quoteRoutes } from "./quotes.mjs";
import { siteRoutes } from "./site.mjs";

function guard(route) {
  if (route.public) return route;
  return {
    ...route,
    handler(ctx, ...args) {
      if (!ctx.user) {
        if (ctx.method !== "GET") return ctx.redirect("/gestion/connexion/");
        return ctx.redirect(`/gestion/connexion/?next=${encodeURIComponent(ctx.url.pathname + ctx.url.search)}`);
      }
      return route.handler(ctx, ...args);
    },
  };
}

export const gestionRoutes = [...authRoutes, ...opsRoutes, ...catalogRoutes, ...peopleRoutes, ...quoteRoutes, ...orderRoutes, ...siteRoutes]
  .map(guard);

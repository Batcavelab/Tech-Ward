// Run the whole site on your computer: node dev.mjs, then open http://localhost:8888/
// Data is kept in the .data folder (Netlify keeps it in Netlify Blobs).
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";

process.env.TECHWARD_DATA_DIR ||= path.resolve(".data");
const { handle } = await import("./app/server.mjs");
const PORT = Number(process.env.PORT) || 8888;
const TYPES = { ".css": "text/css", ".js": "text/javascript", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".ttf": "font/ttf" };

createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname.startsWith("/static/")) {
    try {
      const file = path.join("public", path.normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, ""));
      res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
      return res.end(await readFile(file));
    } catch {
      res.writeHead(404);
      return res.end("Not found");
    }
  }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const request = new Request(url, { method: req.method, headers: req.headers,
    body: ["GET", "HEAD"].includes(req.method) ? undefined : Buffer.concat(chunks) });
  const response = await handle(request);
  const headers = {};
  response.headers.forEach((v, k) => { if (k !== "set-cookie") headers[k] = v; });
  const cookies = response.headers.getSetCookie();
  if (cookies.length) headers["set-cookie"] = cookies;
  res.writeHead(response.status, headers);
  res.end(Buffer.from(await response.arrayBuffer()));
}).listen(PORT, () => console.log(`Tech-Ward: http://localhost:${PORT}/  (gestion: /gestion/)`));

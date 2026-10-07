// Pictures uploaded from Gestion, stored next to the data and served at /media/...
import { randomBytes } from "node:crypto";

const TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };
export const MAX_UPLOAD = 4 * 1024 * 1024;

// Returns [url, error]. url is null when no file was chosen.
export async function saveUpload(ctx, file, folder) {
  if (!file || typeof file === "string" || !file.size) return [null, null];
  const ext = TYPES[file.type];
  if (!ext) return [null, "Format non reconnu : envoyez une photo JPG, PNG ou WebP."];
  if (file.size > MAX_UPLOAD) return [null, "Image trop lourde (4 Mo maximum)."];
  const key = `media/${folder}/${Date.now().toString(36)}-${randomBytes(4).toString("hex")}.${ext}`;
  await ctx.store.setFile(key, new Uint8Array(await file.arrayBuffer()), file.type);
  return ["/" + key, null];
}

export async function deleteUpload(ctx, url) {
  if (url && url.startsWith("/media/")) {
    try { await ctx.store.deleteFile(url.slice(1)); } catch { /* already gone */ }
  }
}

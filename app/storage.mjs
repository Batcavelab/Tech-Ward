// Where the data lives.
// On Netlify: Netlify Blobs (one JSON document "db" plus uploaded pictures), shared by the
// website and Gestion, so a change in Gestion is on the site at the next page load.
// On a PC (node dev.mjs): plain files in the .data folder.
import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const STORE = "techward";

async function blobsStorage() {
  const { getStore } = await import("@netlify/blobs");
  const store = getStore({ name: STORE, consistency: "strong" });
  return {
    async readJSON(key) {
      const r = await store.getWithMetadata(key, { type: "json" });
      return r ? { value: r.data, etag: r.etag } : null;
    },
    // Writes only if nobody saved in between (etag), so two tabs never overwrite each other.
    async writeJSON(key, value, etag) {
      const res = await store.setJSON(key, value, etag ? { onlyIfMatch: etag } : { onlyIfNew: true });
      return res?.modified !== false;
    },
    async getFile(key) {
      const r = await store.getWithMetadata(key, { type: "arrayBuffer" });
      return r ? { body: new Uint8Array(r.data), contentType: r.metadata?.contentType || "application/octet-stream" } : null;
    },
    async setFile(key, bytes, contentType) {
      await store.set(key, bytes, { metadata: { contentType } });
    },
    async deleteFile(key) {
      await store.delete(key);
    },
  };
}

function fileStorage(dir) {
  const file = (key) => path.join(dir, key.replace(/[^\w.-]+/g, "_"));
  const tag = (text) => createHash("md5").update(text).digest("hex");
  return {
    async readJSON(key) {
      try {
        const text = await readFile(file(key) + ".json", "utf8");
        return { value: JSON.parse(text), etag: tag(text) };
      } catch (e) {
        if (e.code === "ENOENT") return null;
        throw e;
      }
    },
    async writeJSON(key, value, etag) {
      await mkdir(dir, { recursive: true });
      const current = await this.readJSON(key);
      if ((current?.etag || null) !== (etag || null)) return false;
      await writeFile(file(key) + ".json", JSON.stringify(value));
      return true;
    },
    async getFile(key) {
      try {
        const meta = JSON.parse(await readFile(file(key) + ".meta", "utf8"));
        return { body: new Uint8Array(await readFile(file(key))), contentType: meta.contentType };
      } catch (e) {
        if (e.code === "ENOENT") return null;
        throw e;
      }
    },
    async setFile(key, bytes, contentType) {
      await mkdir(dir, { recursive: true });
      await writeFile(file(key), bytes);
      await writeFile(file(key) + ".meta", JSON.stringify({ contentType }));
    },
    async deleteFile(key) {
      await rm(file(key), { force: true });
      await rm(file(key) + ".meta", { force: true });
    },
  };
}

let cached;
export async function storage() {
  if (!cached) {
    const local = process.env.TECHWARD_DATA_DIR;
    cached = local ? fileStorage(local) : await blobsStorage();
  }
  return cached;
}


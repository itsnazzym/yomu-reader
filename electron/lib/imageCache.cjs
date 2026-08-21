"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DEFAULT_MAX_BYTES = 96 * 1024 * 1024;

function createImageCache({ cacheDir, maxBytes = DEFAULT_MAX_BYTES }) {
  fs.mkdirSync(cacheDir, { recursive: true });
  const index = new Map();
  let totalBytes = 0;

  function idFor(key) {
    return crypto.createHash("sha256").update(String(key)).digest("hex");
  }

  function filePathFor(id, ext) {
    const safeExt = (ext || "bin").replace(/[^a-z0-9]/gi, "").slice(0, 8) || "bin";
    return path.join(cacheDir, `${id}.${safeExt}`);
  }

  function evictIfNeeded() {
    while (totalBytes > maxBytes && index.size > 0) {
      let oldestId = null;
      let oldestAccess = Infinity;
      for (const [id, item] of index) {
        if (item.lastAccess < oldestAccess) {
          oldestAccess = item.lastAccess;
          oldestId = id;
        }
      }
      if (!oldestId) break;
      const item = index.get(oldestId);
      index.delete(oldestId);
      totalBytes = Math.max(0, totalBytes - (item.bytes || 0));
      try {
        fs.rmSync(item.path, { force: true });
      } catch {}
    }
  }

  function remember(id, filePath, bytes) {
    const existing = index.get(id);
    if (existing) {
      totalBytes = Math.max(0, totalBytes - (existing.bytes || 0));
      if (existing.path !== filePath) {
        try {
          fs.rmSync(existing.path, { force: true });
        } catch {}
      }
    }
    index.set(id, { path: filePath, bytes, lastAccess: Date.now() });
    totalBytes += bytes;
    evictIfNeeded();
  }

  function urlFor(id) {
    return `nhcache://item/${id}`;
  }

  function getByKey(key) {
    const id = idFor(key);
    const item = index.get(id);
    if (item && fs.existsSync(item.path)) {
      item.lastAccess = Date.now();
      return { id, path: item.path, url: urlFor(id) };
    }
    return null;
  }

  function putBuffer(key, buffer, ext) {
    if (!buffer || !buffer.length) throw new Error("Empty cache buffer");
    const id = idFor(key);
    const dest = filePathFor(id, ext);
    fs.writeFileSync(dest, buffer);
    remember(id, dest, buffer.length);
    return { id, path: dest, url: urlFor(id) };
  }

  function allocatePath(key, ext) {
    const id = idFor(key);
    return { id, path: filePathFor(id, ext), url: urlFor(id) };
  }

  function commitFile(key, filePath) {
    const id = idFor(key);
    const bytes = fs.statSync(filePath).size;
    remember(id, filePath, bytes);
    return { id, path: filePath, url: urlFor(id) };
  }

  function resolveItemId(id) {
    if (!/^[a-f0-9]{64}$/i.test(id || "")) return null;
    const item = index.get(id);
    if (item && fs.existsSync(item.path)) {
      item.lastAccess = Date.now();
      return item.path;
    }
    try {
      const matches = fs.readdirSync(cacheDir).filter((name) => name.startsWith(`${id}.`));
      if (matches.length === 1) {
        const filePath = path.join(cacheDir, matches[0]);
        const bytes = fs.statSync(filePath).size;
        remember(id, filePath, bytes);
        return filePath;
      }
    } catch {}
    return null;
  }

  return {
    idFor,
    urlFor,
    getByKey,
    putBuffer,
    allocatePath,
    commitFile,
    resolveItemId,
    stats: () => ({ entries: index.size, bytes: totalBytes }),
  };
}

function parseNhcacheUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }
  if (parsed.protocol !== "nhcache:") return null;
  const kind = parsed.hostname;
  const parts = parsed.pathname.replace(/^\/+/, "").split("/").filter(Boolean);
  if (kind === "item") {
    return { kind: "item", id: parts[0] || "" };
  }
  if (kind === "book") {
    return { kind: "book", hash: parts[0] || "", index: Number(parts[1]) };
  }
  return null;
}

module.exports = { createImageCache, parseNhcacheUrl, DEFAULT_MAX_BYTES };

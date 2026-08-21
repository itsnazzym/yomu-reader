"use strict";

const fs = require("fs");
const path = require("path");

function createSecretVault({ userDataPath, safeStorage }) {
  const vaultPath = path.join(userDataPath, "secrets.enc");
  let cache = { cookies: "", apiKey: "" };
  let loaded = false;

  function encryptionAvailable() {
    try {
      return Boolean(safeStorage && typeof safeStorage.isEncryptionAvailable === "function" && safeStorage.isEncryptionAvailable());
    } catch {
      return false;
    }
  }

  function encrypt(plain) {
    if (!plain) return "";
    if (encryptionAvailable()) {
      return safeStorage.encryptString(plain).toString("base64");
    }
    return Buffer.from(plain, "utf8").toString("base64");
  }

  function decrypt(encoded) {
    if (!encoded) return "";
    const buf = Buffer.from(encoded, "base64");
    if (encryptionAvailable()) {
      try {
        return safeStorage.decryptString(buf);
      } catch {
        try {
          return buf.toString("utf8");
        } catch {
          return "";
        }
      }
    }
    return buf.toString("utf8");
  }

  function load() {
    if (loaded) return cache;
    loaded = true;
    try {
      if (!fs.existsSync(vaultPath)) return cache;
      const raw = JSON.parse(fs.readFileSync(vaultPath, "utf8"));
      cache = {
        cookies: decrypt(raw.cookies || ""),
        apiKey: decrypt(raw.apiKey || ""),
      };
    } catch {
      cache = { cookies: "", apiKey: "" };
    }
    return cache;
  }

  function save(next) {
    const current = load();
    cache = {
      cookies: next.cookies !== undefined ? String(next.cookies || "") : current.cookies,
      apiKey: next.apiKey !== undefined ? String(next.apiKey || "") : current.apiKey,
    };
    loaded = true;
    const payload = {
      v: 1,
      encrypted: encryptionAvailable(),
      cookies: encrypt(cache.cookies),
      apiKey: encrypt(cache.apiKey),
    };
    fs.writeFileSync(vaultPath, JSON.stringify(payload), { mode: 0o600 });
    return status();
  }

  function status() {
    const value = load();
    return {
      hasCookies: Boolean(value.cookies),
      hasApiKey: Boolean(value.apiKey),
      encrypted: encryptionAvailable(),
    };
  }

  function importIfEmpty(incoming = {}) {
    const value = load();
    const cookies = value.cookies || String(incoming.cookies || "").trim();
    const apiKey = value.apiKey || String(incoming.apiKey || "").trim();
    if ((!value.cookies && cookies) || (!value.apiKey && apiKey)) {
      save({ cookies, apiKey });
    }
    return { cookies, apiKey };
  }

  return {
    load,
    save,
    status,
    importIfEmpty,
    getCookies: () => load().cookies,
    getApiKey: () => load().apiKey,
    clear: () => save({ cookies: "", apiKey: "" }),
  };
}

module.exports = { createSecretVault };

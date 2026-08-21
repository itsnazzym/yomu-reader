"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..", "..");

test("le renderer Electron n'écrit plus cookies/api_key dans localStorage", () => {
  const src = fs.readFileSync(path.join(root, "src", "stores", "settingsStore.ts"), "utf8");
  assert.match(src, /function persistPublicSettings/);
  assert.match(src, /isElectron\(\)\s*\n?\s*\? publicSettings/);
  assert.match(src, /migrateSecrets/);
  assert.match(src, /hasSecureCookies/);
  assert.match(src, /persistPublicSettings\(updated\)/);
});

test("le processus principal capture les cookies dans le coffre, pas en clair vers le renderer", () => {
  const src = fs.readFileSync(path.join(root, "electron", "main.cjs"), "utf8");
  assert.match(src, /getSecretVault\(\)\.save\(\{ cookies: cookieStr \}\)/);
  assert.match(src, /send\("cookies-captured", ""\)/);
  assert.doesNotMatch(src, /send\("cookies-captured", cookieStr\)/);
});

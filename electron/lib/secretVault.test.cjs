"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createSecretVault } = require("./secretVault.cjs");

function mockSafeStorage() {
  return {
    isEncryptionAvailable: () => true,
    encryptString: (plain) => Buffer.from(`enc:${plain}`, "utf8"),
    decryptString: (buf) => {
      const text = buf.toString("utf8");
      assert.ok(text.startsWith("enc:"));
      return text.slice(4);
    },
  };
}

test("secretVault chiffre et restaure cookies et clé API", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nh-vault-"));
  const vault = createSecretVault({ userDataPath: dir, safeStorage: mockSafeStorage() });
  vault.save({ cookies: "sessionid=abc", apiKey: "nhk_test" });
  const raw = JSON.parse(fs.readFileSync(path.join(dir, "secrets.enc"), "utf8"));
  assert.equal(raw.encrypted, true);
  assert.notEqual(raw.cookies, "sessionid=abc");
  assert.equal(vault.getCookies(), "sessionid=abc");
  assert.equal(vault.getApiKey(), "nhk_test");
  assert.deepEqual(vault.status(), { hasCookies: true, hasApiKey: true, encrypted: true });
});

test("secretVault importe une seule fois les secrets renderer", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nh-vault-"));
  const vault = createSecretVault({ userDataPath: dir, safeStorage: mockSafeStorage() });
  vault.importIfEmpty({ cookies: "cf=1", apiKey: "" });
  vault.importIfEmpty({ cookies: "cf=2", apiKey: "later" });
  assert.equal(vault.getCookies(), "cf=1");
  assert.equal(vault.getApiKey(), "later");
});

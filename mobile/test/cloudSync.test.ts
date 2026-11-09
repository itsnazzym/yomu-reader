import assert from "node:assert/strict";
import test from "node:test";
import { assertRecoveryKey, decryptVault, encryptVault, generateRecoveryKey, vaultRecordKey } from "@/lib/cloudSync/crypto";

test("le nonce Google est aléatoire, URL-safe et haché pour Credential Manager", async () => {
  const { createGoogleNonce } = await import("@/lib/cloudSync/googleNonce");
  const nonce = await createGoogleNonce();
  assert.match(nonce.raw, /^[A-Za-z0-9_-]+$/);
  assert.equal(nonce.raw.length, 43, "32 octets encodés base64url sans padding");
  assert.match(nonce.sha256, /^[a-f0-9]{64}$/);
});

test("le coffre cloud chiffre les données et exige la bonne clé", async () => {
  const key = await generateRecoveryKey();
  assert.equal(assertRecoveryKey(key).length, 32);
  const vault = await encryptVault({ favorites: [{ id: 7 }] }, key, "user-1");
  assert.notEqual(vault.ciphertext.includes("favorites"), true);
  assert.deepEqual(decryptVault<{ favorites: { id: number }[] }>(vault, key, "user-1"), { favorites: [{ id: 7 }] });
  assert.throws(() => decryptVault(vault, awaitKeyPlaceholder, "user-1"));
});

// A fixed key makes this test deterministic without embedding a real credential.
const awaitKeyPlaceholder = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

test("la clé de ligne est déterministe et ne révèle pas l'identifiant", async () => {
  const key = await generateRecoveryKey();
  assert.equal(vaultRecordKey(key), vaultRecordKey(key));
  assert.notEqual(vaultRecordKey(key), "vault");
});

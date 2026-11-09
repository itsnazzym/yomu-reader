import test from "node:test";
import assert from "node:assert/strict";
import { createSecureSessionStorage } from "../lib/secureSessionStorage";
import { cleanupSession } from "../lib/sessionCleanup";
import { redactSecrets } from "../lib/redactSecrets";
import * as SecureStore from "expo-secure-store";
import { fixture, seedCloudFixture, capturedStorages } from "./mockCloudRuntime";
import { disconnectCloud, getCloudSyncState } from "../lib/cloudSync/index";

test("les services restent isolés même avec le même nom de jeton", async () => {
  const source = createSecureSessionStorage("test.source");
  const cloud = createSecureSessionStorage("test.cloud");
  await source.setItem("session", "source-fixture");
  await cloud.setItem("session", "cloud-fixture");
  await cloud.clear();
  assert.equal(await cloud.getItem("session"), null);
  assert.equal(await source.getItem("session"), "source-fixture");
  await source.clear();
  assert.throws(() => createSecureSessionStorage("../other"));
  assert.throws(() => cloud.setItem("../other", "fixture"));
});

test("un enregistrement lent ne rétablit pas la session après sa suppression", async () => {
  const values = new Map<string, string>();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const storage = createSecureSessionStorage("test.queued", {
    async getItemAsync(key) { return values.get(key) ?? null; },
    async setItemAsync(key, value) { await gate; values.set(key, value); },
    async deleteItemAsync(key) { values.delete(key); },
  });
  const writing = storage.setItem("session", "fixture");
  const removing = storage.removeItem("session");
  const reading = storage.getItem("session");
  release();
  await Promise.all([writing, removing]);
  assert.equal(await reading, null);
});

test("une erreur de stockage reste visible et ne bloque pas un nouvel effacement", async () => {
  let fail = true;
  const deleted: string[] = [];
  const storage = createSecureSessionStorage("test.failure", {
    async getItemAsync() { return null; },
    async setItemAsync() {},
    async deleteItemAsync(key) {
      deleted.push(key);
      if (fail && key.endsWith(".access")) throw new Error("fixture storage error");
    },
  });
  await storage.setItem("access", "fixture");
  await storage.setItem("refresh", "fixture");
  await assert.rejects(storage.clear(), /Réessayez/);
  assert.equal(deleted.includes("test.failure.refresh"), true);
  fail = false;
  await storage.clear();
});

test("la déconnexion tente chaque nettoyage malgré les erreurs de fournisseurs", async () => {
  const calls: string[] = [];
  const complete = await cleanupSession([
    () => { calls.push("provider"); throw new Error("fixture"); },
    async () => { calls.push("native"); throw new Error("fixture"); },
    async () => { calls.push("local"); },
  ]);
  assert.equal(complete, false);
  assert.deepEqual(calls, ["provider", "native", "local"]);
  assert.equal(await cleanupSession([async () => {}]), true);
});

test("les diagnostics filtrent les secrets imbriqués, URL, OAuth et en-têtes", () => {
  const input = {
    api_key: "key-fixture", accessToken: "token-fixture", nested: { refresh_token: "refresh-fixture" },
    request: { url: "https://alice:pass-fixture@example.test/callback?code=oauth-fixture#access_token=hash-fixture", headers: { Authorization: "Bearer header-fixture", Cookie: "session=fixture" } },
    message: 'apiKey="inline-fixture" Bearer bearer-fixture and https://example.test/?api%5Fkey=encoded-fixture',
    visible: "Problème réseau",
  };
  const cleaned = JSON.stringify(redactSecrets(input));
  for (const secret of ["key-fixture", "token-fixture", "refresh-fixture", "alice", "pass-fixture", "oauth-fixture", "hash-fixture", "header-fixture", "session=fixture", "inline-fixture", "bearer-fixture", "encoded-fixture"]) {
    assert.equal(cleaned.includes(secret), false, `secret filtré: ${secret}`);
  }
  assert.equal(cleaned.includes("Problème réseau"), true);
  assert.equal(input.api_key, "key-fixture", "aucune mutation des identifiants utilisés par l’app");
});

test("le filtrage des diagnostics borne les cycles et les objets profonds", () => {
  const circular: Record<string, unknown> = { label: "réseau" };
  circular.self = circular;
  assert.doesNotThrow(() => JSON.stringify(redactSecrets(circular)));
});

test("la déconnexion Cloud efface uniquement ses secrets, même si le fournisseur échoue", async () => {
  process.env.EXPO_PUBLIC_SUPABASE_URL = "https://fixture.example.test";
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "fixture-public-key";
  await seedCloudFixture();
  fixture.providerFails = true;
  const attempts = await Promise.allSettled([disconnectCloud(), disconnectCloud()]);
  assert.equal(attempts.every((result) => result.status === "rejected"), true);
  assert.equal(fixture.signedOut, 1, "les doubles appuis partagent le même nettoyage");
  assert.equal(fixture.nativeOut, 1);
  assert.equal(await SecureStore.getItemAsync("yomu.supabase.fixture-auth-token"), null);
  assert.equal(await SecureStore.getItemAsync("yomu.cloud.recovery-key.v1.fixture-user"), null);
  assert.equal(await SecureStore.getItemAsync("auth.v2.access_token"), "fixture-other-service");
  assert.equal(getCloudSyncState().status, "error", "aucun faux message de réussite");
  await assert.rejects(capturedStorages[0].setItem("fixture-auth-token", "late-fixture"), /déconnectée/);
  assert.equal(await SecureStore.getItemAsync("yomu.supabase.fixture-auth-token"), null, "un ancien client ne rétablit pas la session");
  fixture.providerFails = false;
  await disconnectCloud();
  assert.equal(getCloudSyncState().status, "signed_out");
  await seedCloudFixture();
  fixture.readFails = true;
  await assert.rejects(disconnectCloud(), /incomplète/);
  assert.equal(await SecureStore.getItemAsync("yomu.supabase.fixture-auth-token"), null);
  assert.equal(fixture.nativeOut, 3, "la panne de lecture ne saute pas les nettoyages");
  fixture.readFails = false;
  await disconnectCloud();
  delete process.env.EXPO_PUBLIC_SUPABASE_URL;
  delete process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
});

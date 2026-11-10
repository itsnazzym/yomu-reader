import assert from "node:assert/strict";
import * as VaultCrypto from "../lib/cloudSync/crypto";
import test from "node:test";
import { assertRecoveryKey, decryptVault, encryptVault, generateRecoveryKey, vaultRecordKey } from "@/lib/cloudSync/crypto";

test("la sauvegarde portable est chiffrée avec un mot de passe et refuse une clé incorrecte", async () => {
  const crypto = VaultCrypto as Record<string, any>;
  assert.equal(typeof crypto.encryptBackupJson, "function");
  const plain = JSON.stringify({ version:3, favorites:[{id:7}] });
  const encrypted = await crypto.encryptBackupJson(plain, "a sufficiently long password");
  assert.doesNotMatch(encrypted, /favorites/);
  assert.equal(await crypto.decryptBackupJson(encrypted, "a sufficiently long password"), plain);
  await assert.rejects(crypto.decryptBackupJson(encrypted, "another sufficiently long password"));
  await assert.rejects(crypto.encryptBackupJson(plain, "short"));
});

test("10 000 favoris synthétiques riches restent dans la limite du coffre sans perdre leurs identités", async (t) => {
  const crypto=VaultCrypto as Record<string,any>;
  assert.equal(typeof crypto.compactCloudBackup,"function");
  const favorites=Array.from({length:10000},(_,i)=>({id:i+1,globalId:`hitomi:${i+1}`,media_id:String(i+1),title:{pretty:`Synthetic gallery ${i} — ${"title ".repeat(9)}`,english:`Synthetic gallery ${i}`,japanese:"合成テスト"},images:{cover:{t:"j",w:300,h:400,url:`https://example.test/covers/${i}.jpg`},thumbnail:{t:"j",w:100,h:150,url:`https://example.test/thumbs/${i}.jpg`},pages:Array.from({length:20},(_,page)=>({t:"j",w:1000,h:1500,url:`https://example.test/pages/${i}/${page}.jpg`}))},tags:Array.from({length:8},(_,tag)=>({id:tag,type:"tag",name:`synthetic tag ${tag}`,url:"",count:1000})),num_pages:20,num_favorites:0,scanlator:"hitomi",upload_date:1700000000}));
  const data={version:3,exportedAt:"2026-11-10T10:00:00Z",favorites,localAvatarBase64:"device avatar"};
  const compact=crypto.compactCloudBackup(data);
  assert.equal(compact.localAvatarBase64,undefined);
  assert.equal(compact.favorites[9999].globalId,"hitomi:10000");
  assert.equal(compact.favorites[9999].images.pages.length,0);
  const key=await generateRecoveryKey();
  const encrypted=await crypto.encryptCloudVault(compact,key,"user-load");
  assert.ok(encrypted.ciphertext.length<=5592500);
  const restored=decryptVault<any>(encrypted,key,"user-load");
  assert.deepEqual(restored,compact);
  assert.throws(()=>decryptVault({...encrypted,schemaVersion:1},key,"user-load"));
  const reduced=await crypto.encryptCloudVault({version:3,exportedAt:data.exportedAt,favorites:[]},key,"user-load",true);
  assert.equal(reduced.schemaVersion,2,"la réduction du coffre ne doit pas réactiver les anciens clients");
  t.diagnostic(`10 000 favoris synthétiques : ${JSON.stringify(data).length} caractères avant, ${JSON.stringify(compact).length} après, ${encrypted.ciphertext.length} caractères chiffrés`);
});

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

import * as Crypto from "expo-crypto";
import { xchacha20poly1305 } from "@noble/ciphers/chacha.js";
import { hmac } from "@noble/hashes/hmac.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { scryptAsync } from "@noble/hashes/scrypt.js";
import { fromByteArray, toByteArray } from "base64-js";
import type { EncryptedVault } from "./types";
import type { BackupData } from "../backupStore";
import { zlibSync, unzlibSync } from "fflate";

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const KEY_BYTES = 32;
const NONCE_BYTES = 24;

function base64Url(bytes: Uint8Array): string {
  return fromByteArray(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  return toByteArray(normalized + "=".repeat((4 - (normalized.length % 4)) % 4));
}

export async function generateRecoveryKey(): Promise<string> {
  return base64Url(await Crypto.getRandomBytesAsync(KEY_BYTES));
}

export function assertRecoveryKey(value: string): Uint8Array {
  const key = fromBase64Url(value.trim());
  if (key.length !== KEY_BYTES) throw new Error("Clé de récupération invalide.");
  return key;
}

export async function encryptVault(value: unknown, recoveryKey: string, aad: string): Promise<EncryptedVault> {
  const key = assertRecoveryKey(recoveryKey);
  const nonce = await Crypto.getRandomBytesAsync(NONCE_BYTES);
  const cipher = xchacha20poly1305(key, nonce, encoder.encode(aad));
  const ciphertext = cipher.encrypt(encoder.encode(JSON.stringify(value)));
  return { nonce: base64Url(nonce), ciphertext: base64Url(ciphertext), schemaVersion: 1 };
}

export function decryptVault<T>(vault: EncryptedVault, recoveryKey: string, aad: string): T {
  try {
    const key = assertRecoveryKey(recoveryKey);
    const nonce = fromBase64Url(vault.nonce);
    if (nonce.length !== NONCE_BYTES) throw new Error("nonce invalide");
    if (vault.schemaVersion !== 1 && vault.schemaVersion !== 2) throw new Error("Version de coffre inconnue.");
    let plain = xchacha20poly1305(key, nonce, encoder.encode(vault.schemaVersion === 2 ? `${aad}:compressed:v2` : aad)).decrypt(fromBase64Url(vault.ciphertext));
    if (vault.schemaVersion === 2) {
      if (plain.length < 5) throw new Error("Coffre incomplet.");
      const length = new DataView(plain.buffer, plain.byteOffset, 4).getUint32(0);
      if (length > 32 * 1024 * 1024) throw new Error("Coffre trop volumineux.");
      plain = unzlibSync(plain.subarray(4), { out: new Uint8Array(length + 1) });
      if (plain.length !== length) throw new Error("Taille du coffre incohérente.");
    }
    return JSON.parse(decoder.decode(plain)) as T;
  } catch {
    throw new Error("Impossible de déchiffrer le coffre. Vérifiez la clé de récupération.");
  }
}

export function compactCloudBackup(data: BackupData): BackupData {
  const { localAvatarBase64: _avatar, localAvatarMime: _mime, ...portable } = data;
  return { ...portable, favorites: data.favorites?.map(gallery => {
    const images = gallery.images && typeof gallery.images === "object" ? gallery.images as Record<string, unknown> : {};
    const id = Number(gallery.id);
    const title = gallery.title && typeof gallery.title === "object" ? gallery.title as Record<string, unknown> : { pretty: typeof gallery.title === "string" ? gallery.title : `Gallery #${id}`, english: "", japanese: "" };
    const placeholder = { t: "j", w: 0, h: 0 };
    return { ...gallery, id, globalId: gallery.globalId || `nhentai:${id}`, media_id: gallery.media_id || String(id), title, tags: Array.isArray(gallery.tags) ? gallery.tags : [], images: { ...images, cover: images.cover || placeholder, thumbnail: images.thumbnail || images.cover || placeholder, pages: [] } };
  }) };
}

export async function encryptCloudVault(data: BackupData, recoveryKey: string, aad: string, forceCompressed = false): Promise<EncryptedVault> {
  const plain = encoder.encode(JSON.stringify(data));
  if (plain.length > 32 * 1024 * 1024) throw new Error("Le coffre dépasse 32 Mio de données. Exportez une sauvegarde avant de réduire son contenu.");
  if (!forceCompressed && plain.length <= 4 * 1024 * 1024 - 16) return encryptVault(data, recoveryKey, aad);
  const compressed = zlibSync(plain, { level: 6 });
  const payload = new Uint8Array(compressed.length + 4);
  new DataView(payload.buffer).setUint32(0, plain.length);
  payload.set(compressed, 4);
  if (payload.length > 4 * 1024 * 1024 - 16) throw new Error("Le coffre dépasse 4 Mio après compression. Exportez une sauvegarde avant de réduire son contenu.");
  const nonce = await Crypto.getRandomBytesAsync(NONCE_BYTES);
  const ciphertext = xchacha20poly1305(assertRecoveryKey(recoveryKey), nonce, encoder.encode(`${aad}:compressed:v2`)).encrypt(payload);
  return { nonce: base64Url(nonce), ciphertext: base64Url(ciphertext), schemaVersion: 2 };
}

export function vaultRecordKey(recoveryKey: string): string {
  return base64Url(hmac(sha256, assertRecoveryKey(recoveryKey), encoder.encode("yomu:vault:v1")));
}

const BACKUP_AAD = "yomu-backup:v1:scrypt-65536-8-1";
async function passwordKey(password: string, salt: Uint8Array): Promise<Uint8Array> {
  if (password.length < 12 || password.length > 1024) throw new Error("Utilisez un mot de passe de 12 à 1 024 caractères.");
  return scryptAsync(password.normalize("NFC"), salt, { N: 65536, r: 8, p: 1, dkLen: 32, maxmem: 80 * 1024 * 1024 });
}

export async function encryptBackupJson(json: string, password: string): Promise<string> {
  const salt = await Crypto.getRandomBytesAsync(16);
  const key = await passwordKey(password, salt);
  try {
    const encrypted = await encryptVault(json, base64Url(key), BACKUP_AAD);
    return JSON.stringify({ format: "yomu-encrypted-backup", version: 1, salt: base64Url(salt), ...encrypted });
  } finally { key.fill(0); }
}

export async function decryptBackupJson(json: string, password: string): Promise<string> {
  if (json.length > 48 * 1024 * 1024) throw new Error("Sauvegarde chiffrée trop volumineuse.");
  const envelope = JSON.parse(json);
  if (envelope?.format !== "yomu-encrypted-backup" || envelope.version !== 1 || typeof envelope.salt !== "string" || typeof envelope.nonce !== "string" || typeof envelope.ciphertext !== "string" || envelope.schemaVersion !== 1) throw new Error("Format de sauvegarde chiffrée invalide.");
  const salt = fromBase64Url(envelope.salt);
  if (salt.length !== 16) throw new Error("Sel de sauvegarde invalide.");
  const key = await passwordKey(password, salt);
  try {
    const value = decryptVault<unknown>(envelope, base64Url(key), BACKUP_AAD);
    if (typeof value !== "string") throw new Error("Contenu de sauvegarde invalide.");
    return value;
  } catch { throw new Error("Mot de passe incorrect ou sauvegarde endommagée."); }
  finally { key.fill(0); }
}

import * as Crypto from "expo-crypto";
import { xchacha20poly1305 } from "@noble/ciphers/chacha.js";
import { hmac } from "@noble/hashes/hmac.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { fromByteArray, toByteArray } from "base64-js";
import type { EncryptedVault } from "./types";

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
    const plain = xchacha20poly1305(key, nonce, encoder.encode(aad)).decrypt(fromBase64Url(vault.ciphertext));
    return JSON.parse(decoder.decode(plain)) as T;
  } catch {
    throw new Error("Impossible de déchiffrer le coffre. Vérifiez la clé de récupération.");
  }
}

export function vaultRecordKey(recoveryKey: string): string {
  return base64Url(hmac(sha256, assertRecoveryKey(recoveryKey), encoder.encode("yomu:vault:v1")));
}

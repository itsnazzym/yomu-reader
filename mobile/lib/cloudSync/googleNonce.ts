import * as Crypto from "expo-crypto";
import { fromByteArray } from "base64-js";

function toBase64Url(bytes: Uint8Array): string {
  return fromByteArray(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

/** Nonce brut pour Supabase et SHA-256 hex pour le jeton Google natif. */
export async function createGoogleNonce(): Promise<{ raw: string; sha256: string }> {
  const raw = toBase64Url(await Crypto.getRandomBytesAsync(32));
  const sha256 = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, raw);
  return { raw, sha256: String(sha256).toLowerCase() };
}

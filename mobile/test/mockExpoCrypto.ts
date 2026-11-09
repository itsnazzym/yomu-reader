import { randomBytes } from "node:crypto";

export async function getRandomBytesAsync(length: number): Promise<Uint8Array> {
  return new Uint8Array(randomBytes(length));
}

export enum CryptoDigestAlgorithm {
  SHA256 = "SHA-256",
}

export async function digestStringAsync(algorithm: CryptoDigestAlgorithm, value: string): Promise<string> {
  return (await import("node:crypto")).createHash(algorithm).update(value).digest("hex");
}

import { randomBytes } from "node:crypto";

export async function getRandomBytesAsync(length: number): Promise<Uint8Array> {
  return new Uint8Array(randomBytes(length));
}

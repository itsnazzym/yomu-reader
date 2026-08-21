const JPEG = [0xff, 0xd8, 0xff];
const PNG = [0x89, 0x50, 0x4e, 0x47];
const GIF = [0x47, 0x49, 0x46, 0x38];
const RIFF = [0x52, 0x49, 0x46, 0x46];

export const MIN_IMAGE_BYTES = 256;

function startsWith(bytes: Uint8Array, magic: number[]): boolean {
  if (bytes.length < magic.length) return false;
  return magic.every((value, index) => bytes[index] === value);
}

export function isValidImageMagic(bytes: Uint8Array | number[]): boolean {
  const view = bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes);
  if (startsWith(view, JPEG) || startsWith(view, PNG) || startsWith(view, GIF)) {
    return true;
  }
  if (startsWith(view, RIFF) && view.length >= 12) {
    return view[8] === 0x57 && view[9] === 0x45 && view[10] === 0x42 && view[11] === 0x50;
  }
  return false;
}

export function decodeBase64Header(base64: string, maxBytes = 16): Uint8Array {
  const slice = base64.replace(/[^A-Za-z0-9+/=]/g, "").slice(0, Math.ceil((maxBytes * 4) / 3) + 4);
  if (typeof Buffer !== "undefined") {
    return Uint8Array.from(Buffer.from(slice, "base64").subarray(0, maxBytes));
  }
  const binary = globalThis.atob(slice);
  const bytes = new Uint8Array(Math.min(maxBytes, binary.length));
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function isCompleteDownload(params: {
  size: number;
  expectedSize?: number | null;
  headerBytes?: Uint8Array | number[] | null;
}): boolean {
  if (!Number.isFinite(params.size) || params.size < MIN_IMAGE_BYTES) return false;
  if (params.expectedSize && params.expectedSize > 0 && params.size !== params.expectedSize) {
    return false;
  }
  if (params.headerBytes && !isValidImageMagic(params.headerBytes)) return false;
  return true;
}

import "server-only";

export const DIRECT_V2_BASE_URL = "https://nhentai.net/api/v2";

function parseMirrorOrigin(value: string | undefined): string | null {
  if (!value) return null;

  try {
    const url = new URL(value);
    const isLoopback =
      url.hostname === "localhost" ||
      url.hostname === "127.0.0.1" ||
      url.hostname === "[::1]";
    const hasUnexpectedParts =
      url.username !== "" ||
      url.password !== "" ||
      url.search !== "" ||
      url.hash !== "" ||
      (url.pathname !== "" && url.pathname !== "/");

    if ((url.protocol !== "https:" && !(url.protocol === "http:" && isLoopback)) || hasUnexpectedParts) {
      return null;
    }

    return url.origin;
  } catch {
    return null;
  }
}

export function getMirrorBaseUrl(): string | null {
  return parseMirrorOrigin(process.env.NHENTAI_MIRROR_URL);
}

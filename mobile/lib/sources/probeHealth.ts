/**
 * Sonde légère réutilisée par SourceAdapter.healthCheck() et probe-sources.ts.
 * catalogue → fiche → téléchargement partiel de la première image.
 */

import type { SourceAdapter } from "./types";

export interface SourceHealthResult {
  ok: boolean;
  latencyMs: number;
  error?: string;
}

const CATALOG_TIMEOUT_MS = 8000;
const DETAIL_TIMEOUT_MS = 10000;
const IMAGE_TIMEOUT_MS = 12000;
const HEALTH_QUERY = "a";

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Timeout ${ms}ms`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Ping standard d'une source : listing minimal + résolution d'une galerie + HEAD.
 */
export async function probeAdapterHealth(
  adapter: Pick<SourceAdapter, "search" | "getGallery" | "meta">,
  opts?: { timeoutMs?: number; query?: string }
): Promise<SourceHealthResult> {
  const catalogTimeoutMs = opts?.timeoutMs ?? CATALOG_TIMEOUT_MS;
  const query = opts?.query ?? HEALTH_QUERY;
  const t0 = Date.now();
  try {
    // query "" → browse (index /folders), pas search.html avec un mot factice.
    const searchOpts =
      query === ""
        ? { page: 1 as const }
        : { query, page: 1 as const };
    const search = await withTimeout(adapter.search(searchOpts), catalogTimeoutMs);
    const first = search.cards[0];
    if (!first) {
      return {
        ok: false,
        latencyMs: Date.now() - t0,
        error: "Aucun résultat",
      };
    }
    const nativeId = first.globalId.includes(":")
      ? first.globalId.slice(first.globalId.indexOf(":") + 1)
      : first.globalId;
    const gal = await withTimeout(adapter.getGallery(nativeId), DETAIL_TIMEOUT_MS);
    if (!gal.pageUrls[0]?.url || gal.numPages <= 0) {
      return {
        ok: false,
        latencyMs: Date.now() - t0,
        error: "Pas d'URL de page",
      };
    }
    const imageController = new AbortController();
    const imageTimer = setTimeout(() => imageController.abort(), IMAGE_TIMEOUT_MS);
    try {
      const imageHeaders: Record<string, string> = { Range: "bytes=0-31" };
      if (adapter.meta.id === "hitomi") {
        imageHeaders.Referer = "https://hitomi.la/";
      }
      const image = await fetch(gal.pageUrls[0].url, {
        signal: imageController.signal,
        headers: imageHeaders,
      });
      const contentType = image.headers.get("content-type") || "";
      const bytes = new Uint8Array(await image.arrayBuffer());
      const isImage = contentType.startsWith("image/");
      const hasSignature =
        (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) ||
        (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) ||
        (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) ||
        (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46);
      const ok = image.ok && isImage && hasSignature;
      return {
        ok,
        latencyMs: Date.now() - t0,
        error: ok ? undefined : `Image ${image.status} / ${contentType || "sans type"}`,
      };
    } finally {
      clearTimeout(imageTimer);
    }
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - t0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Sonde légère réutilisée par SourceAdapter.healthCheck() et probe-sources.ts.
 * search → getGallery → HEAD page 1, timeout court.
 */

import type { SourceAdapter } from "./types";

export interface SourceHealthResult {
  ok: boolean;
  latencyMs: number;
  error?: string;
}

const DEFAULT_TIMEOUT_MS = 8000;
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
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const query = opts?.query ?? HEALTH_QUERY;
  const t0 = Date.now();
  try {
    // query "" → browse (index /folders), pas search.html avec un mot factice.
    const searchOpts =
      query === ""
        ? { page: 1 as const }
        : { query, page: 1 as const };
    const search = await withTimeout(adapter.search(searchOpts), timeoutMs);
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
    const gal = await withTimeout(adapter.getGallery(nativeId), timeoutMs);
    if (!gal.pageUrls[0]?.url || gal.numPages <= 0) {
      return {
        ok: false,
        latencyMs: Date.now() - t0,
        error: "Pas d'URL de page",
      };
    }
    const headController = new AbortController();
    const headTimer = setTimeout(() => headController.abort(), Math.min(timeoutMs, 5000));
    try {
      const headHeaders: Record<string, string> = {};
      if (adapter.meta.id === "hitomi") {
        headHeaders.Referer = "https://hitomi.la/";
      }
      const head = await fetch(gal.pageUrls[0].url, {
        method: "HEAD",
        signal: headController.signal,
        headers: headHeaders,
      });
      const ok = head.ok;
      return {
        ok,
        latencyMs: Date.now() - t0,
        error: ok ? undefined : `HEAD ${head.status}`,
      };
    } finally {
      clearTimeout(headTimer);
    }
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - t0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

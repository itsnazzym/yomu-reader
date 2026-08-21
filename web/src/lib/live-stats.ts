// Real statistics fetched from API v2 at build/request time, with an optional
// server-configured Photon mirror fallback.

import { DIRECT_V2_BASE_URL, getMirrorBaseUrl } from "@/lib/server-config";
import {
  parseGalleryList,
  parseGalleryTotal,
  type GalleryMetrics,
} from "@/lib/upstream-api";

const TIMEOUT_MS = 8000;

export interface LiveStats {
  totalGalleries: number; // approximate archive size (real)
  topFavorites: number; // sum of favorites across the current popular-week top
  topPages: number; // sum of page counts across the current popular-week top
  sampled: number; // how many galleries the favorites/pages figures come from
  fetchedAt: string; // ISO timestamp
}

async function fetchJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36",
        Accept: "application/json",
      },
      // Next.js caches the page (ISR revalidate=3600 in page.tsx);
      // within a single generation the fetch result is reused.
      cache: "force-cache",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchPopularWeek(): Promise<GalleryMetrics[]> {
  // API v2 first: it carries real num_favorites / num_pages. The Photon proxy
  // mirrors the v1 format which zeroes out favorites.
  try {
    const galleries = parseGalleryList(
      await fetchJson(`${DIRECT_V2_BASE_URL}/search?query=*&page=1&sort=popular-week`),
    );
    if (galleries?.length) return galleries;
  } catch {
    // fall through
  }
  const mirrorBaseUrl = getMirrorBaseUrl();
  if (mirrorBaseUrl) {
    try {
      const galleries = parseGalleryList(
        await fetchJson(`${mirrorBaseUrl}/api/galleries/all?page=1&sort=popular-week`),
      );
      if (galleries?.length) return galleries;
    } catch {
      // fall through
    }
  }
  return [];
}

async function fetchTotalGalleries(): Promise<number | null> {
  try {
    const total = parseGalleryTotal(
      await fetchJson(`${DIRECT_V2_BASE_URL}/search?query=*&page=1&sort=recent`),
    );
    if (total) return total;
  } catch {
    // Try the configured mirror below.
  }

  const mirrorBaseUrl = getMirrorBaseUrl();
  if (!mirrorBaseUrl) return null;

  try {
    return parseGalleryTotal(
      await fetchJson(`${mirrorBaseUrl}/api/galleries/all?page=1&sort=recent`),
    );
  } catch {
    return null;
  }
}

/**
 * Real stats, computed at build time. Cached by Next.js; on the landing page
 * it is refreshed with ISR so the numbers stay live without slowing the site.
 */
export async function getLiveStats(): Promise<LiveStats> {
  const [popular, totalGalleries] = await Promise.all([
    fetchPopularWeek(),
    fetchTotalGalleries(),
  ]);

  const topFavorites = popular.reduce((sum, gallery) => sum + gallery.numFavorites, 0);
  const topPages = popular.reduce((sum, gallery) => sum + gallery.numPages, 0);

  return {
    totalGalleries: totalGalleries ?? 0,
    topFavorites,
    topPages,
    sampled: popular.length,
    fetchedAt: new Date().toISOString(),
  };
}

export function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(n);
}

// Real statistics fetched from the nHentai API at build/request time.
// Primary path: the project's Photon mirror proxy (local, fast, unblocked).
// Fallback: nHentai API v2 directly (works from the server).

const MIRROR = "http://localhost:8787";
const DIRECT_V2 = "https://nhentai.net/api/v2";

const TIMEOUT_MS = 8000;

export interface LiveStats {
  totalGalleries: number; // approximate archive size (real)
  topFavorites: number; // sum of favorites across the current popular-week top
  topPages: number; // sum of page counts across the current popular-week top
  sampled: number; // how many galleries the favorites/pages figures come from
  fetchedAt: string; // ISO timestamp
}

async function fetchJson(url: string): Promise<any> {
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

async function fetchPopularWeek(): Promise<any[]> {
  // API v2 first: it carries real num_favorites / num_pages. The Photon proxy
  // mirrors the v1 format which zeroes out favorites.
  try {
    const d = await fetchJson(`${DIRECT_V2}/search?query=*&page=1&sort=popular-week`);
    if (Array.isArray(d?.result) && d.result.length) return d.result;
  } catch {
    // fall through
  }
  try {
    const d = await fetchJson(`${MIRROR}/api/galleries/all?page=1&sort=popular-week`);
    if (Array.isArray(d?.result) && d.result.length) return d.result;
  } catch {
    // fall through
  }
  return [];
}

/** Total archive size: proxy reports num_pages for sort=recent (25/page). */
async function fetchTotalPages(): Promise<number | null> {
  try {
    const d = await fetchJson(`${MIRROR}/api/galleries/all?page=1&sort=recent`);
    const numPages = Number(d?.num_pages);
    if (numPages > 0) return numPages * 25;
  } catch {
    // fall through
  }
  return null;
}

/**
 * Real stats, computed at build time. Cached by Next.js; on the landing page
 * it is refreshed with ISR so the numbers stay live without slowing the site.
 */
export async function getLiveStats(): Promise<LiveStats> {
  const [popular, totalPages] = await Promise.all([fetchPopularWeek(), fetchTotalPages()]);

  const topFavorites = popular.reduce((sum, g) => sum + (Number(g.num_favorites) || 0), 0);
  const topPages = popular.reduce((sum, g) => sum + (Number(g.num_pages) || 0), 0);

  return {
    totalGalleries: totalPages ?? 0,
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

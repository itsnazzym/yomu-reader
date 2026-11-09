import { fetchEhTagDatabase } from "./tagCatalogFetchers";
/**
 * Adaptateur E-Hentai & ExHentai (JHenTai style).
 *
 * Fonctionnalités clés :
 * - Mode double E-Hentai (e-hentai.org) / ExHentai (exhentai.org "Panda") selon les cookies isolés.
 * - Catégories standard E-Hentai avec typage et charte de couleur JHenTai.
 * - API JSON officielle (api.php) pour des métadonnées riches et rapides.
 * - Extraction des vraies vignettes WebP (ehgt.org) et rejet des icônes d'interface (td.png).
 * - Résolution des pages de lecture avec cache en mémoire pour vitesse maximale.
 */

import { Platform } from "react-native";
import {
  extractMatches,
  stripTags,
  decodeEntities,
} from "./html";
import {
  makeGlobalId,
  type SourceAdapter,
  type SourceGallery,
  type SourceGalleryCard,
  type SourceMeta,
  type SourceSearchOptions,
  type SourceTag,
  type SourceTaxonomyItem,
} from "./types";
import {
  formatCookieHeader,
  getSourceAuth,
} from "./authStore";
import {
  getEhentaiCategoryInfo,
  EHENTAI_CATEGORIES,
  calculateCategoryBitmask,
} from "./ehentaiCategories";

const BASE_EHENTAI = "https://e-hentai.org";
const BASE_EXHENTAI = "https://exhentai.org";
const API_URL = "https://api.e-hentai.org/api.php";
const TIMEOUT_MS = 14000;

const BASE_HEADERS: Record<string, string> = {
  "User-Agent":
    Platform.OS === "android"
      ? "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36"
      : "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9,fr;q=0.8",
};

interface EhentaiApiMetadata {
  gid: number;
  token: string;
  archiver_key?: string;
  title: string;
  title_jpn?: string;
  category?: string;
  thumb?: string;
  uploader?: string;
  posted?: string | number;
  filecount?: string | number;
  filesize?: number;
  expunged?: boolean;
  rating?: string | number;
  torrentcount?: string;
  tags?: string[];
}

/** Cache des URLs d'images directes résolues par page de lecture (/s/...) */
const pageImageCache = new Map<string, { url: string; cachedAt: number }>();
const PAGE_IMAGE_TTL_MS = 60 * 60 * 1000;

export function getCachedEhentaiPageImage(viewerUrl: string): string | undefined {
  const cached = pageImageCache.get(viewerUrl);
  if (cached && Date.now() - cached.cachedAt < PAGE_IMAGE_TTL_MS) {
    return cached.url;
  }
  return undefined;
}

export function parseEhentaiNativeId(nativeId: string): { gid: string; token: string } {
  const clean = nativeId.trim().replace(/^\/+|\/+$/g, "");
  const parts = clean.includes("/") ? clean.split("/") : clean.split("_");
  return {
    gid: parts[0] || "",
    token: parts[1] || "",
  };
}

/**
 * Calcule la note moyenne (sur 5.0) à partir des coordonnées de sprite E-Hentai.
 */
function parseRatingFromSprite(posXStr?: string, posYStr?: string): number | undefined {
  if (!posXStr || !posYStr) return undefined;
  const x = parseInt(posXStr, 10);
  const y = parseInt(posYStr, 10);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return undefined;

  const base = 5 - Math.abs(x) / 16;
  const halfPenalty = Math.abs(y) > 10 ? 0.5 : 0;
  const r = Math.max(0, Math.min(5, base - halfPenalty));
  return Number.isFinite(r) ? parseFloat(r.toFixed(2)) : undefined;
}

/** Parse les cartes depuis le HTML d'un listing E-Hentai / ExHentai. */
export function parseEhentaiListingCards(html: string): SourceGalleryCard[] {
  const cards: SourceGalleryCard[] = [];
  const seenGids = new Set<string>();

  // 1. Découpage par lignes de tableau (mode standard Minimal / Minimal+ `dm_m`)
  const rows = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];

  for (const r of rows) {
    const rowHtml = r[1] || "";
    const linkMatch = rowHtml.match(/href="https?:\/\/(?:e-hentai|exhentai)\.org\/g\/(\d+)\/([a-f0-9]+)\/?"[^>]*>/i);
    if (!linkMatch) continue;
    const gid = linkMatch[1];
    const token = linkMatch[2];
    if (!gid || !token || seenGids.has(gid)) continue;

    // Titre
    const titleMatch = rowHtml.match(/<div class="glink">([\s\S]*?)<\/div>/i);
    if (!titleMatch) continue;
    const title = decodeEntities(stripTags(titleMatch[1])).trim();
    if (!title || title.length < 2) continue;
    seenGids.add(gid);

    // Catégorie
    let category = "Misc";
    const catMatch =
      rowHtml.match(/<div class="cn ct[a-z0-9]+"[^>]*>([\s\S]*?)<\/div>/i) ||
      rowHtml.match(/<div class="cn [^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    if (catMatch) {
      const rawCat = stripTags(catMatch[1]).trim();
      category = getEhentaiCategoryInfo(rawCat).name;
    }

    // Prefer the thumbnail container; older listing modes may only expose an image.
    const thumbArea = rowHtml.match(/<div\b[^>]*class="[^"]*\bglthumb\b[^"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1] || rowHtml;
    const candidates = [...thumbArea.matchAll(/\bdata-src="([^"]+)"/gi), ...thumbArea.matchAll(/(?:^|\s)src="([^"]+)"/gi)];
    const coverUrl = candidates.map(match => decodeEntities(match[1])).find(url => {
      if (!/^https?:\/\//i.test(url)) return false;
      return !/\/(?:td\.png|t\.png|blank\.gif)(?:[?#]|$)/i.test(url);
    }) || "";

    // Nombre de pages
    let numPages: number | undefined;
    const pagesMatch = rowHtml.match(/(\d+)\s*pages?/i);
    if (pagesMatch) {
      numPages = parseInt(pagesMatch[1], 10);
    }

    // Note moyenne (sprite d'étoiles)
    let rating: number | undefined;
    const spriteMatch = rowHtml.match(/background-position:\s*(-?\d+)px\s+(-?\d+)px/i);
    if (spriteMatch) {
      rating = parseRatingFromSprite(spriteMatch[1], spriteMatch[2]);
    }
    if (typeof rating !== "number") {
      const ratingMatch = rowHtml.match(/rating:\s*([0-9.]+)/i);
      if (ratingMatch) rating = parseFloat(ratingMatch[1]);
    }

    // Date
    let uploadDate: number | undefined;
    const dateMatch = rowHtml.match(/(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})/);
    if (dateMatch) {
      const parsed = Date.parse(dateMatch[1] + " UTC");
      if (Number.isFinite(parsed)) uploadDate = parsed;
    }

    // Uploader
    let uploader: string | undefined;
    const uploaderMatch = rowHtml.match(/\/uploader\/([^"]+)"[^>]*>([^<]+)<\/a>/i);
    if (uploaderMatch) {
      uploader = decodeEntities(uploaderMatch[2].trim());
    }

    cards.push({
      globalId: makeGlobalId("ehentai", `${gid}_${token}`),
      title,
      coverUrl: coverUrl || "https://ehgt.org/g/blank.gif",
      numPages,
      uploadDate,
      category,
      rating,
      uploader,
      tags: category ? [{ name: category.toLowerCase(), type: "category" }] : [],
    });
  }

  // Fallback si la page était dans un autre mode (ex: thumbnails `gtd`)
  if (cards.length === 0) {
    const galleryLinkRe =
      /href="https?:\/\/(?:e-hentai|exhentai)\.org\/g\/(\d+)\/([a-f0-9]+)\/?"[^>]*>([\s\S]*?)<\/a>/gi;
    const matches = [...html.matchAll(galleryLinkRe)];

    for (const match of matches) {
      const gid = match[1];
      const token = match[2];
      const innerHtml = match[3] || "";
      if (!gid || !token || seenGids.has(gid)) continue;

      let title = "";
      const glinkMatch = innerHtml.match(/<div class="glink">([\s\S]*?)<\/div>/i);
      title = glinkMatch ? decodeEntities(stripTags(glinkMatch[1])) : decodeEntities(stripTags(innerHtml));
      if (!title || title.length < 2) continue;
      seenGids.add(gid);

      const matchIndex = match.index ?? 0;
      const snippet = html.slice(Math.max(0, matchIndex - 600), Math.min(html.length, matchIndex + 1400));

      let coverUrl = "";
      const dataSrc = snippet.match(/data-src="([^"]*ehgt\.org\/[^"]*|[^"]*hentai\.org\/[^"]*)"/i);
      if (dataSrc) {
        coverUrl = dataSrc[1];
      } else {
        const srcMatch = snippet.match(/src="([^"]*ehgt\.org\/[^"]*|[^"]*hentai\.org\/[^"]*)"/i);
        if (srcMatch && !srcMatch[1].includes("td.png") && !srcMatch[1].includes("blank.gif")) {
          coverUrl = srcMatch[1];
        }
      }

      cards.push({
        globalId: makeGlobalId("ehentai", `${gid}_${token}`),
        title,
        coverUrl: coverUrl || "https://ehgt.org/g/blank.gif",
        category: "Misc",
        tags: [{ name: "misc", type: "category" }],
      });
    }
  }

  return cards;
}

export async function resolveEhentaiPageImage(
  viewerUrl: string,
  headers?: Record<string, string>
): Promise<string> {
  const cached = getCachedEhentaiPageImage(viewerUrl);
  if (cached) return cached;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(viewerUrl, {
      headers: headers || { ...BASE_HEADERS, Cookie: "nw=1" },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} sur ${viewerUrl}`);
    const html = await res.text();

    const match = html.match(/<img\b[^>]*id=["']img["'][^>]*src=["']([^"']+)["']/i);
    if (match && match[1]) {
      const directUrl = decodeEntities(match[1]);
      pageImageCache.set(viewerUrl, { url: directUrl, cachedAt: Date.now() });
      return directUrl;
    }
    throw new Error("Balise <img id='img'> introuvable dans la page E-Hentai");
  } finally {
    clearTimeout(timer);
  }
}

export class EhentaiSource implements SourceAdapter {
  capabilities = {
    search: true,
    pagination: true,
    tags: true,
    random: false,
  } as const;

  meta: SourceMeta = {
    id: "ehentai",
    label: "E-Hentai",
    baseUrl: BASE_EHENTAI,
    accentColor: "#e63946",
    supportsLogin: true,
    supportsComments: true,
  };

  /** Cache des curseurs nextGid par requête pour pagination fluide sans boucle infinie (JHenTai style) */
  private searchCursors = new Map<string, Map<number, string>>();

  /** Détermine le domaine actif (E-Hentai ou ExHentai) et les headers de requête. */
  private async getRequestConfig(): Promise<{ baseUrl: string; headers: Record<string, string> }> {
    const auth = await getSourceAuth("ehentai");
    const useEx = Boolean(auth.isLoggedIn && auth.isExHentaiEnabled && auth.cookies?.igneous);
    const baseUrl = useEx ? BASE_EXHENTAI : BASE_EHENTAI;

    const headers: Record<string, string> = {
      ...BASE_HEADERS,
      Referer: `${baseUrl}/`,
    };

    const cookieMap: Record<string, string> = {
      nw: "1", // Bypass prompt d'avertissement de contenu
      ...(auth.cookies || {}),
    };
    headers.Cookie = formatCookieHeader(cookieMap);

    return { baseUrl, headers };
  }

  async search(opts: SourceSearchOptions): Promise<{ cards: SourceGalleryCard[]; hasMore: boolean }> {
    const { baseUrl, headers } = await this.getRequestConfig();
    const pageNum = Math.max(1, opts.page || 1);

    const cacheKey = `${baseUrl}|${opts.query || ""}|${(opts.categories || []).join(",")}|${opts.pageMin || ""}|${opts.pageMax || ""}|${opts.minRating || ""}|${opts.sort || ""}`;

    const params = new URLSearchParams();
    // inline_set=dm_m force l'affichage en mode tableau Minimal+ prévisible
    params.append("inline_set", "dm_m");

    if (opts.query?.trim()) {
      params.append("f_search", opts.query.trim());
    }

    // Gestion du curseur nextGid pour pagination E-Hentai (JHenTai style)
    if (pageNum === 1) {
      this.searchCursors.delete(cacheKey);
    } else {
      const cursors = this.searchCursors.get(cacheKey);
      const nextGid = cursors?.get(pageNum);
      if (nextGid) {
        params.append("next", nextGid);
      } else {
        params.append("page", String(pageNum - 1));
      }
    }

    if (opts.categories && opts.categories.length > 0) {
      const allCategoryKeys = Object.keys(EHENTAI_CATEGORIES);
      const disabled = allCategoryKeys.filter(
        (cat) => !opts.categories.some((c) => c.toLowerCase() === cat.toLowerCase())
      );
      if (disabled.length > 0) {
        const mask = calculateCategoryBitmask(disabled);
        params.append("f_cats", String(mask));
      }
    }

    if (opts.pageMin !== undefined || opts.pageMax !== undefined) {
      params.append("f_sp", "on");
      if (opts.pageMin !== undefined && opts.pageMin > 0) {
        params.append("f_spf", String(opts.pageMin));
      }
      if (opts.pageMax !== undefined && opts.pageMax > 0) {
        params.append("f_spt", String(opts.pageMax));
      }
    }

    if (opts.minRating !== undefined && opts.minRating > 0) {
      params.append("f_sr", "on");
      params.append("f_srdd", String(opts.minRating));
    }

    if (
      opts.pageMin !== undefined ||
      opts.pageMax !== undefined ||
      (opts.minRating !== undefined && opts.minRating > 0)
    ) {
      params.append("advsearch", "1");
      params.append("f_sname", "on");
      params.append("f_stags", "on");
      params.append("f_sdesc", "on");
    }

    const url = `${baseUrl}/?${params.toString()}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(url, { headers, signal: controller.signal });
      if (!response.ok) {
        throw new Error(`E-Hentai HTTP ${response.status} sur ${url}`);
      }
      const html = await response.text();
      const cards = parseEhentaiListingCards(html);

      // Extraction du curseur nextGid dans le HTML (#dnext ou #unext ou next=XXXX)
      const nextMatch =
        html.match(/id=["']dnext["'][^>]*href=["'][^"']*(?:[?&]|&amp;)next=([\d-]+)/i) ||
        html.match(/id=["']unext["'][^>]*href=["'][^"']*(?:[?&]|&amp;)next=([\d-]+)/i) ||
        html.match(/(?:[?&]|&amp;)next=([\d-]+)/i);
      const nextCursor = nextMatch ? nextMatch[1] : undefined;

      if (nextCursor) {
        let cursors = this.searchCursors.get(cacheKey);
        if (!cursors) {
          cursors = new Map<number, string>();
          this.searchCursors.set(cacheKey, cursors);
        }
        cursors.set(pageNum + 1, nextCursor);
      }

      return {
        cards,
        hasMore: Boolean(nextCursor) || cards.length >= 25,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  async getGallery(nativeId: string): Promise<SourceGallery> {
    const { gid, token } = parseEhentaiNativeId(nativeId);
    if (!gid || !token) {
      throw new Error(`Identifiant E-Hentai invalide: '${nativeId}'`);
    }

    const { baseUrl, headers } = await this.getRequestConfig();

    // 1. Appel API JSON officiel pour les métadonnées de la galerie
    let meta: EhentaiApiMetadata | null = null;
    try {
      const apiRes = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method: "gdata",
          gidlist: [[parseInt(gid, 10), token]],
          namespace: 1,
        }),
      });

      if (apiRes.ok) {
        const json = await apiRes.json();
        if (json?.gmetadata?.[0] && !json.gmetadata[0].error) {
          meta = json.gmetadata[0] as EhentaiApiMetadata;
        }
      }
    } catch {}

    // 2. Scraping HTML de la page 0 de la galerie pour extraire les liens des pages
    const galleryHtmlUrl = `${baseUrl}/g/${gid}/${token}/?p=0`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    let galleryHtml = "";
    try {
      const htmlRes = await fetch(galleryHtmlUrl, { headers, signal: controller.signal });
      if (htmlRes.ok) {
        galleryHtml = await htmlRes.text();
      }
    } finally {
      clearTimeout(timer);
    }

    // Extraction des URLs de lecteur /s/<page_token>/<gid>-<page_num>
    const readerPageLinks: { url: string; pageNum: number }[] = [];
    const linkMatches = extractMatches(
      galleryHtml,
      /href="(https?:\/\/(?:e-hentai|exhentai)\.org\/s\/([a-f0-9]+)\/(\d+)-(\d+))"/g
    );

    for (const m of linkMatches) {
      const fullUrl = m[1];
      const pageNum = parseInt(m[4], 10);
      if (!readerPageLinks.some((p) => p.pageNum === pageNum)) {
        readerPageLinks.push({ url: fullUrl, pageNum });
      }
    }
    readerPageLinks.sort((a, b) => a.pageNum - b.pageNum);

    const totalPages =
      typeof meta?.filecount === "number"
        ? meta.filecount
        : typeof meta?.filecount === "string"
        ? parseInt(meta.filecount, 10)
        : readerPageLinks.length || 1;

    // Normalisation des tags avec leurs namespaces (JHenTai style)
    const tags: SourceTag[] = [];
    if (Array.isArray(meta?.tags)) {
      for (const rawTag of meta.tags) {
        const colonIdx = rawTag.indexOf(":");
        if (colonIdx > 0) {
          tags.push({
            name: rawTag.slice(colonIdx + 1),
            type: rawTag.slice(0, colonIdx),
          });
        } else {
          tags.push({ name: rawTag, type: "tag" });
        }
      }
    }

    if (meta?.category) {
      tags.unshift({ name: meta.category, type: "category" });
    }

    // Pré-résolution asynchrone non-bloquante pour affichage instantané de la fiche
    const preResolveCount = Math.min(2, readerPageLinks.length);
    readerPageLinks.slice(0, preResolveCount).forEach((p) => {
      void this.resolvePageImageUrl(p.url, headers).catch(() => "");
    });

    // Construction de la liste des pages pour le lecteur
    const pageUrls: { url: string; width?: number; height?: number }[] = [];
    for (let i = 0; i < totalPages; i++) {
      const readerLink = readerPageLinks[i]?.url;
      const cached = readerLink ? getCachedEhentaiPageImage(readerLink) : undefined;
      if (cached) {
        pageUrls.push({ url: cached });
      } else if (readerLink) {
        pageUrls.push({ url: readerLink });
      } else {
        pageUrls.push({ url: meta?.thumb || `${baseUrl}/g/blank.gif` });
      }
    }

    const title = meta?.title_jpn || meta?.title || `E-Hentai #${gid}`;
    const coverUrl = meta?.thumb || `${baseUrl}/g/blank.gif`;
    const rating = meta?.rating ? parseFloat(String(meta.rating)) : undefined;
    const uploadDate = meta?.posted ? parseInt(String(meta.posted), 10) * 1000 : undefined;

    return {
      globalId: makeGlobalId("ehentai", `${gid}_${token}`),
      nativeId: `${gid}_${token}`,
      title: decodeEntities(title),
      coverUrl,
      numPages: totalPages,
      uploadDate,
      tags,
      category: meta?.category || "Misc",
      rating,
      uploader: meta?.uploader,
      pageUrls,
    };
  }

  async resolvePageImageUrl(viewerUrl: string, headers?: Record<string, string>): Promise<string> {
    return resolveEhentaiPageImage(viewerUrl, headers);
  }

  async getTags(): Promise<SourceTaxonomyItem[]> {
    return fetchEhTagDatabase();
  }

  async healthCheck(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
    const startedAt = Date.now();
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: "gdata", gidlist: [[1, ""]], namespace: 1 }),
      });
      return { ok: res.ok, latencyMs: Date.now() - startedAt };
    } catch (err) {
      return {
        ok: false,
        latencyMs: Date.now() - startedAt,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}

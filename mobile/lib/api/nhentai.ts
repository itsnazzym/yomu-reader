import { Gallery, GalleryImage, SearchResult, Comment, Tag } from "./types";
import { Platform } from "react-native";
import {
  searchGalleries as v2Search,
  getGallery as v2GetGallery,
  getRelatedGalleries as v2GetRelatedGalleries,
  getRandomGalleryId as v2GetRandomGalleryId,
  getComments as v2GetComments,
  resolveThumbUrl as v2ResolveThumbUrl,
  resolveImageUrl as v2ResolveImageUrl,
  initCdn,
} from "./v2";
import type { GalleryCard as V2GalleryCard, Gallery as V2Gallery } from "./v2/types";
import { ApiError } from "./v2/client";

const BASE_URL = "https://nhentai.net";
const API_V1_URL = `${BASE_URL}/api`;

/**
 * Passerelle miroir locale optionnelle (proxy/nhentai-mirror.mjs à la racine du repo) :
 * Utilisée en fallback ultime si l'API directe est inaccessible.
 */
const FALLBACK_API_BASE =
  Platform.OS === "android" ? "http://10.0.2.2:8787" : "http://localhost:8787";

export function getMirrorBase(): string {
  return FALLBACK_API_BASE;
}

const REQUEST_TIMEOUT_MS = 8000;

const EXT_MAP: Record<string, string> = {
  j: "jpg",
  p: "png",
  g: "gif",
  w: "webp",
};

const COMMON_HEADERS: Record<string, string> = {
  "User-Agent":
    Platform.OS === "android"
      ? "Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AD1A.240905.004) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.6723.102 Mobile Safari/537.36"
      : "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
  Accept: "application/json, text/plain, */*",
  Referer: "https://nhentai.net/",
  "Accept-Language": "en-US,en;q=0.9,fr;q=0.8,ja;q=0.7",
};

// Global in-memory cache
export const galleryCache = new Map<number, Gallery>();
const GALLERY_CACHE_MAX_ENTRIES = 300;

function cacheGallery(gallery: Gallery): void {
  const id = Number(gallery.id);
  if (!Number.isFinite(id) || id <= 0) return;
  galleryCache.delete(id);
  galleryCache.set(id, gallery);
  while (galleryCache.size > GALLERY_CACHE_MAX_ENTRIES) {
    const oldestId = galleryCache.keys().next().value;
    if (oldestId === undefined) break;
    galleryCache.delete(oldestId);
  }
}

// In-flight request deduplicator
const inFlightRequests = new Map<string, Promise<any>>();

// Initialisation asynchrone du CDN en tâche de fond
initCdn().catch(() => {});

export function getExtension(t: string): string {
  return EXT_MAP[t] || "jpg";
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function nativeFetchJson<T>(url: string): Promise<T> {
  if (inFlightRequests.has(url)) {
    return inFlightRequests.get(url)!;
  }

  const reqPromise = (async () => {
    try {
      const res = await fetchWithTimeout(url, {
        method: "GET",
        headers: COMMON_HEADERS,
      });

      if (!res.ok) {
        throw new ApiError(`HTTP ${res.status}: ${res.statusText}`, res.status);
      }

      return (await res.json()) as T;
    } finally {
      inFlightRequests.delete(url);
    }
  })();

  inFlightRequests.set(url, reqPromise);
  return reqPromise;
}

/**
 * Parse metadata from nHentai title formatting
 */
export function parseTitleMetadata(rawTitle: string): {
  artist?: string;
  circle?: string;
  parody?: string;
  language?: string;
} {
  if (!rawTitle) return {};

  let title = rawTitle.trim();
  let artist = "";
  let circle = "";
  let parody = "";
  let language = "";

  title = title.replace(/^\([^)]+\)\s*/, "");

  const artistMatch = title.match(/^\[([^\]]+)\]/);
  if (artistMatch) {
    const inside = artistMatch[1].trim();
    title = title.replace(/^\[[^\]]+\]\s*/, "");

    const subMatch = inside.match(/^([^(]+)\s*\(([^)]+)\)$/);
    if (subMatch) {
      circle = subMatch[1].trim();
      artist = subMatch[2].trim();
    } else {
      artist = inside;
    }
  }

  const langMatch = title.match(
    /\[(english|chinese|japanese|french|français|francais|spanish|español|korean|russian|german|deutsch|italian|italiano|digital|dl版|中国翻訳|英訳|fr|en|jp|cn|es|de|ru|it|ko)\]/i
  );
  if (langMatch) {
    const l = langMatch[1].toLowerCase();
    if (l === "english" || l === "en" || l === "英訳") language = "english";
    else if (l === "chinese" || l === "cn" || l === "中国翻訳") language = "chinese";
    else if (l === "japanese" || l === "jp") language = "japanese";
    else if (l === "french" || l === "fr" || l === "français" || l === "francais") language = "french";
    else if (l === "spanish" || l === "es" || l === "español") language = "spanish";
    else if (l === "german" || l === "de" || l === "deutsch") language = "german";
    else if (l === "russian" || l === "ru") language = "russian";
    else if (l === "italian" || l === "it" || l === "italiano") language = "italian";
    else if (l === "korean" || l === "ko") language = "korean";
  }

  const parodyMatch = title.match(/\(([^)]+)\)\s*(?:\[[^\]]+\]\s*)*$/);
  if (parodyMatch) {
    parody = parodyMatch[1].trim();
  }

  return { artist, circle, parody, language };
}

const NHENTAI_LANG_TAG_IDS: Record<number, string> = {
  16947: "french",
  12227: "english",
  6346: "japanese",
  29963: "chinese",
  20525: "spanish",
  20617: "russian",
  12824: "german",
  35763: "korean",
  33842: "italian",
};

export function resolveCoverUrl(media_id: string, imgOrCover?: any): string {
  if (typeof imgOrCover === "string" && imgOrCover.startsWith("http")) return imgOrCover;
  if (imgOrCover?.url) return imgOrCover.url;
  if (imgOrCover?.path) {
    return v2ResolveThumbUrl(imgOrCover.path);
  }
  if (!media_id) return "";
  const ext = imgOrCover?.t ? getExtension(imgOrCover.t) : "webp";
  return v2ResolveThumbUrl(`/galleries/${media_id}/thumb.${ext}`);
}

export function resolveThumbnailUrl(media_id: string, imgOrThumb?: any): string {
  if (typeof imgOrThumb === "string" && imgOrThumb.startsWith("http")) return imgOrThumb;
  if (imgOrThumb?.url) return imgOrThumb.url;
  if (imgOrThumb?.path) {
    return v2ResolveThumbUrl(imgOrThumb.path);
  }
  if (typeof imgOrThumb === "string") {
    return v2ResolveThumbUrl(imgOrThumb);
  }
  if (!media_id) return "";
  const ext = imgOrThumb?.t ? getExtension(imgOrThumb.t) : "webp";
  return v2ResolveThumbUrl(`/galleries/${media_id}/thumb.${ext}`);
}

export function resolvePageUrl(media_id: string, index: number, imgOrPage?: any): string {
  if (typeof imgOrPage === "string" && imgOrPage.startsWith("http")) return imgOrPage;
  if (imgOrPage?.url) return imgOrPage.url;
  if (imgOrPage?.path) {
    return v2ResolveImageUrl(imgOrPage.path);
  }
  if (!media_id) return "";
  const ext = imgOrPage?.t ? getExtension(imgOrPage.t) : "webp";
  return v2ResolveImageUrl(`/galleries/${media_id}/${index + 1}.${ext}`);
}

export function resolvePageThumbUrl(media_id: string, index: number, imgOrPage?: any): string {
  if (typeof imgOrPage === "string" && imgOrPage.startsWith("http")) return imgOrPage;
  if (imgOrPage?.urlThumb) return imgOrPage.urlThumb;
  if (imgOrPage?.thumbnail) {
    return v2ResolveThumbUrl(imgOrPage.thumbnail);
  }
  if (!media_id) return "";
  const ext = imgOrPage?.t ? getExtension(imgOrPage.t) : "webp";
  return v2ResolveThumbUrl(`/galleries/${media_id}/${index + 1}t.${ext}`);
}

/**
 * Convertit un GalleryCard v2 en Gallery complet pour la vue Liste
 */
export function v2CardToGallery(card: V2GalleryCard): Gallery {
  const thumbUrl = v2ResolveThumbUrl(card.thumbnail);
  const media_id = card.media_id || String(card.id);
  const english = card.english_title || "";
  const japanese = card.japanese_title || "";
  const pretty = english || japanese || `Gallery #${card.id}`;
  const meta = parseTitleMetadata(english);
  const syntheticTags: Tag[] = [];

  if (meta.artist) {
    syntheticTags.push({ id: 10001, type: "artist", name: meta.artist.toLowerCase(), url: "", count: 0 });
  }
  if (meta.circle) {
    syntheticTags.push({ id: 10002, type: "group", name: meta.circle.toLowerCase(), url: "", count: 0 });
  }
  if (meta.parody) {
    syntheticTags.push({ id: 10003, type: "parody", name: meta.parody.toLowerCase(), url: "", count: 0 });
  }

  // Détection prioritaire par tag_ids officiel nHentai
  let detectedLang = meta.language;
  if (Array.isArray(card.tag_ids)) {
    for (const tid of card.tag_ids) {
      if (NHENTAI_LANG_TAG_IDS[tid]) {
        detectedLang = NHENTAI_LANG_TAG_IDS[tid];
        break;
      }
    }
  }

  if (detectedLang) {
    syntheticTags.push({ id: 10004, type: "language", name: detectedLang.toLowerCase(), url: "", count: 0 });
  }

  const gallery: Gallery = {
    id: card.id,
    media_id,
    title: { english, japanese, pretty },
    images: {
      cover: {
        t: "w",
        w: card.thumbnail_width || 250,
        h: card.thumbnail_height || 350,
        url: thumbUrl,
        urlThumb: thumbUrl,
      },
      thumbnail: {
        t: "w",
        w: card.thumbnail_width || 250,
        h: card.thumbnail_height || 350,
        url: thumbUrl,
        urlThumb: thumbUrl,
      },
      pages: [],
    },
    scanlator: card.scanlator || "",
    upload_date: card.upload_date || Math.floor(Date.now() / 1000),
    tags: syntheticTags,
    tag_ids: card.tag_ids || [],
    num_pages: card.num_pages || 0,
    num_favorites: card.num_favorites || 0,
  };

  cacheGallery(gallery);
  return gallery;
}

/**
 * Convertit un V2Gallery détaillé en Gallery complet avec pages
 */
export function v2GalleryToAppGallery(g: V2Gallery): Gallery {
  const media_id = g.media_id || String(g.id);
  const coverUrl = v2ResolveThumbUrl(g.cover?.path || `/galleries/${media_id}/thumb.webp`);
  const thumbUrl = v2ResolveThumbUrl(g.thumbnail?.path || `/galleries/${media_id}/thumb.webp`);

  const pages: GalleryImage[] = (g.pages || []).map((p, idx) => ({
    t: "w",
    w: p.width || 1280,
    h: p.height || 1800,
    url: v2ResolveImageUrl(p.path || `/galleries/${media_id}/${idx + 1}.webp`),
    urlThumb: v2ResolveThumbUrl(p.thumbnail || `/galleries/${media_id}/${idx + 1}t.webp`),
  }));

  const tags: Tag[] = (g.tags || []).map((t) => ({
    id: t.id,
    type: t.type as any,
    name: t.name,
    url: t.url || "",
    count: t.count || 0,
  }));

  const gallery: Gallery = {
    id: g.id,
    media_id,
    title: {
      english: g.title?.english || "",
      japanese: g.title?.japanese || "",
      pretty: g.title?.pretty || g.title?.english || g.title?.japanese || `Gallery #${g.id}`,
    },
    images: {
      cover: {
        t: "w",
        w: g.cover?.width || 350,
        h: g.cover?.height || 500,
        url: coverUrl,
        urlThumb: thumbUrl,
      },
      thumbnail: {
        t: "w",
        w: g.thumbnail?.width || 250,
        h: g.thumbnail?.height || 350,
        url: thumbUrl,
        urlThumb: thumbUrl,
      },
      pages,
    },
    scanlator: g.scanlator || "",
    upload_date: g.upload_date || Math.floor(Date.now() / 1000),
    tags,
    num_pages: g.num_pages || pages.length,
    num_favorites: g.num_favorites || 0,
  };

  cacheGallery(gallery);
  return gallery;
}

export function enrichGalleryImages(raw: any): Gallery {
  if (!raw) return raw;
  if (raw.pages && Array.isArray(raw.pages) && raw.pages[0]?.path) {
    return v2GalleryToAppGallery(raw);
  }
  if (raw.thumbnail && typeof raw.thumbnail === "string" && !raw.images?.pages?.length) {
    return v2CardToGallery(raw);
  }

  const gallery: Gallery = { ...raw };
  const media_id = String(raw.media_id || raw.id || "");

  const englishTitle =
    raw.english_title ||
    raw.title?.english ||
    raw.title?.pretty ||
    raw.title?.japanese ||
    raw.japanese_title ||
    `Gallery #${raw.id}`;

  const japaneseTitle = raw.japanese_title || raw.title?.japanese || "";
  const prettyTitle = raw.title?.pretty || englishTitle;

  gallery.title = {
    english: englishTitle,
    japanese: japaneseTitle,
    pretty: prettyTitle,
  };

  const meta = parseTitleMetadata(englishTitle);
  const syntheticTags: Tag[] = [];

  if (meta.artist) {
    syntheticTags.push({ id: 10001, type: "artist", name: meta.artist.toLowerCase(), url: "", count: 0 });
  }
  if (meta.circle) {
    syntheticTags.push({ id: 10002, type: "group", name: meta.circle.toLowerCase(), url: "", count: 0 });
  }
  if (meta.parody) {
    syntheticTags.push({ id: 10003, type: "parody", name: meta.parody.toLowerCase(), url: "", count: 0 });
  }
  if (meta.language) {
    syntheticTags.push({ id: 10004, type: "language", name: meta.language.toLowerCase(), url: "", count: 0 });
  }

  if (!gallery.tags || gallery.tags.length === 0) {
    gallery.tags = syntheticTags;
  }

  const coverObj = raw.cover || raw.thumbnail || raw.images?.cover;
  const thumbObj = raw.thumbnail || raw.cover || raw.images?.thumbnail;

  const resolvedCover = resolveCoverUrl(media_id, coverObj);
  const resolvedThumb = resolveThumbnailUrl(media_id, thumbObj);

  if (!gallery.images) {
    gallery.images = {
      cover: { t: "w", w: 350, h: 500, url: resolvedCover },
      thumbnail: { t: "w", w: 250, h: 350, url: resolvedThumb },
      pages: [],
    };
  } else {
    if (gallery.images.cover) gallery.images.cover.url = resolvedCover;
    else gallery.images.cover = { t: "w", w: 350, h: 500, url: resolvedCover };

    if (gallery.images.thumbnail) gallery.images.thumbnail.url = resolvedThumb;
    else gallery.images.thumbnail = { t: "w", w: 250, h: 350, url: resolvedThumb };
  }

  const rawPages = raw.pages || raw.images?.pages || [];
  if (Array.isArray(rawPages) && rawPages.length > 0) {
    gallery.images.pages = rawPages.map((p: any, idx: number) => ({
      t: p.t || "w",
      w: p.width || p.w || 1280,
      h: p.height || p.h || 1800,
      url: resolvePageUrl(media_id, idx, p),
      urlThumb: resolvePageThumbUrl(media_id, idx, p),
    }));
  }

  if (gallery.id) {
    cacheGallery(gallery);
  }

  return gallery;
}

export async function searchGalleries(
  query = "",
  page = 1,
  sort: "recent" | "popular" | "popular-today" | "popular-week" | "popular-month" = "recent"
): Promise<SearchResult> {
  const trimmed = query.trim();
  console.log(`[🔍 SEARCH] "${trimmed || '*'}" (Page ${page}, Tri: ${sort})`);

  // 1. Priorité absolue : API v2 officielle authentifiée
  try {
    let sortOrder = "date";
    if (sort === "popular") sortOrder = "popular";
    else if (sort === "popular-today") sortOrder = "popular-today";
    else if (sort === "popular-week") sortOrder = "popular-week";
    else if (sort === "popular-month") sortOrder = "popular-month";

    const v2Res = await v2Search({
      query: trimmed,
      sort: sortOrder as any,
      page,
    });

    const rawList = v2Res?.result || [];
    const resultList: Gallery[] = rawList.map(v2CardToGallery);
    const numPages = Math.max(1, v2Res?.num_pages || Math.ceil((v2Res?.total || 25) / (v2Res?.per_page || 25)));

    console.log(`[✅ V2 SEARCH] ${resultList.length} mangas trouvés (${numPages} pages)`);
    return {
      result: resultList,
      num_pages: numPages,
      per_page: v2Res?.per_page || 25,
    };
  } catch (v2Err: any) {
    console.warn(`[API V2 SEARCH ERROR] ${v2Err?.message}. Tentative fallback...`);
  }

  const q = trimmed ? encodeURIComponent(trimmed) : "";
  const endpointV1 = trimmed
    ? `${API_V1_URL}/galleries/search?query=${q}&page=${page}&sort=${sort}`
    : `${API_V1_URL}/galleries/all?page=${page}&sort=${sort}`;

  // 2. API v1 officielle, utile lorsque v2 est temporairement indisponible.
  try {
    const data = await nativeFetchJson<any>(endpointV1);
    const rawList = data?.result || data?.galleries || data?.data || [];
    const resultList: Gallery[] = rawList.map(enrichGalleryImages);
    const numPages =
      data?.num_pages ||
      data?.total_pages ||
      (data?.total ? Math.ceil(data.total / 25) : 1);
    return {
      result: resultList,
      num_pages: numPages,
      per_page: data?.per_page || 25,
    };
  } catch (v1Err: any) {
    console.warn(`[API V1 SEARCH ERROR] ${v1Err?.message}. Tentative miroir...`);
  }

  // 3. Fallback miroir proxy local
  const endpointMirror = trimmed
    ? `${FALLBACK_API_BASE}/api/galleries/search?query=${q}&page=${page}&sort=${sort}`
    : `${FALLBACK_API_BASE}/api/galleries/all?page=${page}&sort=${sort}`;

  try {
    const data = await nativeFetchJson<any>(endpointMirror);
    const rawList = data?.result || data?.galleries || data?.data || [];
    const resultList: Gallery[] = rawList.map(enrichGalleryImages);
    const numPages = data?.num_pages || data?.total_pages || (data?.total ? Math.ceil(data.total / 25) : 1);
    return {
      result: resultList,
      num_pages: numPages,
      per_page: data?.per_page || 25,
    };
  } catch (mirrorErr: any) {
    console.warn(`[MIRROR SEARCH ERROR] ${mirrorErr?.message}`);
  }

  throw new Error("Impossible de charger les galeries. Veuillez vérifier votre connexion ou réessayer.");
}

export async function getGallery(id: number | string): Promise<Gallery> {
  const numId = Number(id);
  if (galleryCache.has(numId)) {
    const cached = galleryCache.get(numId)!;
    if (cached.images?.pages && cached.images.pages.length > 0) {
      galleryCache.delete(numId);
      galleryCache.set(numId, cached);
      return cached;
    }
  }

  // 1. API v2 officielle
  try {
    const v2Detail = await v2GetGallery(id, { include: "comments,related" });
    if (v2Detail && v2Detail.id) {
      const appGallery = v2GalleryToAppGallery(v2Detail);
      return appGallery;
    }
  } catch (v2Err: any) {
    console.warn(`[v2 getGallery error] ${v2Err?.message}`);
    if (v2Err instanceof ApiError && v2Err.status === 404) {
      throw v2Err;
    }
  }

  // 2. API v1 officielle.
  try {
    const data = await nativeFetchJson<any>(`${API_V1_URL}/gallery/${id}`);
    if (data) {
      return enrichGalleryImages(data);
    }
  } catch (v1Err: any) {
    console.warn(`[v1 getGallery error] ${v1Err?.message}`);
    if (v1Err instanceof ApiError && v1Err.status === 404) {
      throw v1Err;
    }
  }

  // 3. Fallback miroir
  try {
    const data = await nativeFetchJson<any>(`${FALLBACK_API_BASE}/api/gallery/${id}`);
    if (data) {
      const enriched = enrichGalleryImages(data);
      return enriched;
    }
  } catch (mirrorErr: any) {
    console.warn(`[mirror getGallery error] ${mirrorErr?.message}`);
  }

  throw new Error(`Galerie #${id} indisponible.`);
}

export async function getRandomGallery(): Promise<Gallery> {
  try {
    const randomId = await v2GetRandomGalleryId();
    if (randomId) {
      return await getGallery(randomId);
    }
  } catch {}

  try {
    const res = await fetchWithTimeout(`${BASE_URL}/random/`, {
      method: "GET",
      headers: COMMON_HEADERS,
      redirect: "follow",
    });
    const match = res.url?.match(/\/g\/(\d+)\//);
    if (match && match[1]) {
      return getGallery(match[1]);
    }
  } catch {}

  try {
    const data = await nativeFetchJson<any>(`${FALLBACK_API_BASE}/random/`);
    if (data?.id) return getGallery(data.id);
  } catch {}

  return getGallery(Math.floor(Math.random() * 500000) + 1);
}

export async function getComments(id: number | string): Promise<Comment[]> {
  try {
    const comments = await v2GetComments(id);
    if (Array.isArray(comments) && comments.length > 0) {
      return comments.map((c: any) => ({
        id: c.id,
        gallery_id: Number(id),
        poster: {
          id: c.poster?.id || 0,
          username: c.poster?.username || "Anonyme",
          slug: c.poster?.slug || "",
          avatar_url: c.poster?.avatar_url ? v2ResolveImageUrl(c.poster.avatar_url) : "",
          is_superuser: Boolean(c.poster?.is_superuser),
          is_staff: Boolean(c.poster?.is_staff),
        },
        post_date: c.post_date || Math.floor(Date.now() / 1000),
        body: c.body || "",
      }));
    }
  } catch {}

  try {
    const data = await nativeFetchJson<any>(`${FALLBACK_API_BASE}/api/gallery/${id}/comments`);
    return data || [];
  } catch {
    return [];
  }
}

/** Lightweight related card — never written to `galleryCache`. */
export interface RelatedCard {
  id: number;
  title: string;
  coverUrl: string;
  tag_ids: number[];
  tagNames: string[];
}

export function relatedToCards(raw: unknown): RelatedCard[] {
  const list = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && Array.isArray((raw as { result?: unknown[] }).result)
      ? ((raw as { result: unknown[] }).result)
      : [];

  const cards: RelatedCard[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, any>;
    const id = Number(r.id);
    if (!Number.isFinite(id) || id <= 0) continue;

    const title =
      r.english_title ||
      r.title?.pretty ||
      r.title?.english ||
      r.japanese_title ||
      r.title?.japanese ||
      `Gallery #${id}`;

    let coverUrl = "";
    if (typeof r.thumbnail === "string" && r.thumbnail) {
      coverUrl = v2ResolveThumbUrl(r.thumbnail);
    } else if (r.thumbnail?.path) {
      coverUrl = v2ResolveThumbUrl(r.thumbnail.path);
    } else if (r.cover?.path) {
      coverUrl = v2ResolveThumbUrl(r.cover.path);
    } else if (r.images?.cover?.url) {
      coverUrl = String(r.images.cover.url);
    } else if (r.images?.thumbnail?.url) {
      coverUrl = String(r.images.thumbnail.url);
    } else if (r.media_id) {
      coverUrl = v2ResolveThumbUrl(`/galleries/${r.media_id}/thumb.webp`);
    }

    const tagNames: string[] = [];
    if (Array.isArray(r.tags)) {
      for (const t of r.tags) {
        const name = t?.name ? String(t.name).toLowerCase() : "";
        if (name) tagNames.push(name);
      }
    }

    const tag_ids = Array.isArray(r.tag_ids)
      ? r.tag_ids.map((tid: unknown) => Number(tid)).filter((tid: number) => Number.isFinite(tid) && tid > 0)
      : [];

    cards.push({
      id,
      title: String(title),
      coverUrl,
      tag_ids,
      tagNames,
    });
  }
  return cards;
}

/**
 * Related galleries from API v2 only (no gallery cache, no mirror fallback).
 * Throws on network/HTTP error so the UI can hide the section.
 */
export async function getRelatedGalleryCards(
  id: number | string
): Promise<RelatedCard[]> {
  const raw = await v2GetRelatedGalleries(id);
  return relatedToCards(raw);
}

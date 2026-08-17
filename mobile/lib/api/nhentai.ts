import { Gallery, GalleryImage, SearchResult, Comment, Tag } from "./types";

const BASE_URL = "https://nhentai.net";
const API_V2_URL = `${BASE_URL}/api/v2`;
const API_V1_URL = `${BASE_URL}/api`;

const EXT_MAP: Record<string, string> = {
  j: "jpg",
  p: "png",
  g: "gif",
  w: "webp",
};

const COMMON_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  Referer: "https://nhentai.net/",
  "Accept-Language": "en-US,en;q=0.9,fr;q=0.8,ja;q=0.7",
};

// Global in-memory cache
export const galleryCache = new Map<number, Gallery>();
// In-flight request deduplicator
const inFlightRequests = new Map<string, Promise<any>>();

export function getExtension(t: string): string {
  return EXT_MAP[t] || "jpg";
}

/**
 * Robust Native Fetch wrapper without Axios 403 overhead
 */
async function nativeFetchJson<T>(url: string): Promise<T> {
  if (inFlightRequests.has(url)) {
    return inFlightRequests.get(url)!;
  }

  const reqPromise = (async () => {
    try {
      const res = await fetch(url, {
        method: "GET",
        headers: COMMON_HEADERS,
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
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

  // Prefix e.g. (C102)
  title = title.replace(/^\([^)]+\)\s*/, "");

  // [Circle (Artist)] or [Artist]
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

  // [Language]
  const langMatch = title.match(/\[(english|chinese|japanese|french|spanish|korean|russian|german|digital|dl版|中国翻訳|英訳)\]/i);
  if (langMatch) {
    const l = langMatch[1].toLowerCase();
    if (l === "english" || l === "英訳") language = "english";
    else if (l === "chinese" || l === "中国翻訳") language = "chinese";
    else if (l === "japanese") language = "japanese";
    else if (l === "french") language = "french";
  }

  // (Parody)
  const parodyMatch = title.match(/\(([^)]+)\)\s*(?:\[[^\]]+\]\s*)*$/);
  if (parodyMatch) {
    parody = parodyMatch[1].trim();
  }

  return { artist, circle, parody, language };
}

export function resolveCoverUrl(media_id: string, imgOrCover?: any): string {
  if (typeof imgOrCover === "string" && imgOrCover.startsWith("http")) return imgOrCover;
  if (imgOrCover?.path) {
    const cleanPath = String(imgOrCover.path).replace(/^\//, "");
    return `https://t3.nhentai.net/${cleanPath}`;
  }
  if (!media_id) return "";
  const ext = imgOrCover?.t ? getExtension(imgOrCover.t) : "webp";
  return `https://t3.nhentai.net/galleries/${media_id}/thumb.${ext}`;
}

export function resolveThumbnailUrl(media_id: string, imgOrThumb?: any): string {
  if (typeof imgOrThumb === "string" && imgOrThumb.startsWith("http")) return imgOrThumb;
  if (imgOrThumb?.path) {
    const cleanPath = String(imgOrThumb.path).replace(/^\//, "");
    return `https://t3.nhentai.net/${cleanPath}`;
  }
  if (typeof imgOrThumb === "string") {
    const cleanPath = imgOrThumb.replace(/^\//, "");
    return `https://t3.nhentai.net/${cleanPath}`;
  }
  if (!media_id) return "";
  const ext = imgOrThumb?.t ? getExtension(imgOrThumb.t) : "webp";
  return `https://t3.nhentai.net/galleries/${media_id}/thumb.${ext}`;
}

export function resolvePageUrl(media_id: string, index: number, imgOrPage?: any): string {
  if (typeof imgOrPage === "string" && imgOrPage.startsWith("http")) return imgOrPage;
  if (imgOrPage?.path) {
    const cleanPath = String(imgOrPage.path).replace(/^\//, "");
    return `https://i3.nhentai.net/${cleanPath}`;
  }
  if (!media_id) return "";
  const ext = imgOrPage?.t ? getExtension(imgOrPage.t) : "webp";
  return `https://i3.nhentai.net/galleries/${media_id}/${index + 1}.${ext}`;
}

export function resolvePageThumbUrl(media_id: string, index: number, imgOrPage?: any): string {
  if (typeof imgOrPage === "string" && imgOrPage.startsWith("http")) return imgOrPage;
  if (imgOrPage?.thumbnail) {
    const cleanPath = String(imgOrPage.thumbnail).replace(/^\//, "");
    return `https://t3.nhentai.net/${cleanPath}`;
  }
  if (!media_id) return "";
  const ext = imgOrPage?.t ? getExtension(imgOrPage.t) : "webp";
  return `https://t3.nhentai.net/galleries/${media_id}/${index + 1}t.${ext}`;
}

export function enrichGalleryImages(raw: any): Gallery {
  if (!raw) return raw;
  const gallery: Gallery = { ...raw };
  const media_id = String(raw.media_id || raw.id || "");

  // Normalize titles from v2 (english_title) or v1 (title.english)
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

  // Extract tags from title
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

  // Cover & Thumbnail URLs
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

  // Resolve pages
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
    galleryCache.set(Number(gallery.id), gallery);
  }

  return gallery;
}

export async function searchGalleries(
  query = "",
  page = 1,
  sort: "recent" | "popular" | "popular-today" | "popular-week" = "recent"
): Promise<SearchResult> {
  const sortParam = sort && sort !== "recent" ? `&sort=${sort}` : "";
  console.log(`[🔍 SEARCH] "${query || '*'}" (Page ${page}, Tri: ${sort})`);

  try {
    const q = query.trim() ? encodeURIComponent(query.trim()) : "*";
    const endpoint = `${API_V2_URL}/search?query=${q}&page=${page}${sortParam}`;

    const data = await nativeFetchJson<any>(endpoint);
    const rawList = data.result || data.galleries || data.data || [];
    const resultList: Gallery[] = rawList.map(enrichGalleryImages);
    const numPages = data.num_pages || data.total_pages || (data.total ? Math.ceil(data.total / 25) : 1);

    console.log(`[✅ SEARCH SUCCESS] ${resultList.length} mangas trouvés (${numPages} pages)`);

    return {
      result: resultList,
      num_pages: numPages,
      per_page: data.per_page || 25,
    };
  } catch (errV2: any) {
    console.warn(`[⚠️ FALLBACK V1] ${errV2?.message}`);
    const endpointV1 = query.trim()
      ? `${API_V1_URL}/galleries/search?query=${encodeURIComponent(query.trim())}&page=${page}${sortParam}`
      : `${API_V1_URL}/galleries/all?page=${page}${sortParam}`;

    const data = await nativeFetchJson<any>(endpointV1);
    const list = (data.result || []).map(enrichGalleryImages);
    return {
      result: list,
      num_pages: data.num_pages || 1,
      per_page: data.per_page || 25,
    };
  }
}

export async function getGallery(id: number | string): Promise<Gallery> {
  const numId = Number(id);
  if (galleryCache.has(numId)) {
    const cached = galleryCache.get(numId)!;
    if (cached.images?.pages && cached.images.pages.length > 0) {
      return cached;
    }
  }

  try {
    const data = await nativeFetchJson<any>(`${API_V2_URL}/galleries/${id}`);
    const enriched = enrichGalleryImages(data);
    galleryCache.set(numId, enriched);
    return enriched;
  } catch {
    const data = await nativeFetchJson<any>(`${API_V1_URL}/gallery/${id}`);
    const enriched = enrichGalleryImages(data);
    galleryCache.set(numId, enriched);
    return enriched;
  }
}

export async function getRandomGallery(): Promise<Gallery> {
  try {
    const res = await fetch(`${BASE_URL}/random/`, {
      method: "GET",
      headers: COMMON_HEADERS,
      redirect: "follow",
    });
    const url = res.url;
    const match = url?.match(/\/g\/(\d+)\//);
    if (match && match[1]) {
      return getGallery(match[1]);
    }
  } catch {}
  return getGallery(Math.floor(Math.random() * 500000) + 1);
}

export async function getComments(id: number | string): Promise<Comment[]> {
  try {
    const data = await nativeFetchJson<any>(`${API_V2_URL}/galleries/${id}/comments`);
    return data || [];
  } catch {
    try {
      const data = await nativeFetchJson<any>(`${API_V1_URL}/gallery/${id}/comments`);
      return data || [];
    } catch {
      return [];
    }
  }
}

import { Gallery, SearchResponse, AppSettings, DownloadProgressPayload, DownloadFormat } from "../types";

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
    electronAPI?: {
      searchGalleries: (params: { query: string; sort: string; page: number; cookies?: string; apiKey?: string }) => Promise<SearchResponse>;
      getGallery: (params: { id: number; cookies?: string; apiKey?: string }) => Promise<Gallery>;
      getRandomGallery: (params: { cookies?: string; apiKey?: string }) => Promise<Gallery>;
      getTags: (params: { tagType: string; sort: string; page: number; cookies?: string; apiKey?: string }) => Promise<{ result: import("../types").Tag[]; num_pages: number; per_page: number }>;
      getDefaultSettings: () => Promise<AppSettings>;
      selectDownloadDirectory: () => Promise<string | null>;
      formatFilenamePreview: (params: { pattern: string; gallery: Gallery }) => Promise<string>;
      startDownload: (params: { gallery: Gallery; formatType: DownloadFormat; pattern: string; destDir: string; cookies?: string; apiKey?: string }) => Promise<string>;
      cancelDownload: (params: { galleryId: number }) => Promise<boolean>;
      openFolder: (params: { targetPath: string }) => Promise<void>;
      scanLocalLibrary: (params: { directoryPath?: string }) => Promise<import("../types").LocalBookItem[]>;
      readLocalBook: (params: { filePath: string }) => Promise<import("../types").LocalBookContent>;
      getDownloadedIds: (params: { directoryPath?: string }) => Promise<number[]>;
      openAuthWindow: () => Promise<void>;
      getImageData: (params: { url: string; referer?: string; cookies?: string; apiKey?: string }) => Promise<string | null>;
      preloadGalleryImages: (params: { urls: string[]; referer?: string; cookies?: string; apiKey?: string }) => Promise<{ preloaded: number }>;
      saveDownloadedArchive: (params: { gallery: Gallery; formatType: DownloadFormat; pattern: string; destDir: string; pagesData: Array<{ pageNum: number; ext: string; bufferBase64: string }> }) => Promise<string>;
      logTerminal?: (text: string) => Promise<boolean>;
      onDownloadProgress: (callback: (payload: DownloadProgressPayload) => void) => () => void;
      onCookiesCaptured: (callback: (cookies: string) => void) => () => void;
    };
  }
}

export function isElectron(): boolean {
  return typeof window !== "undefined" && !!window.electronAPI;
}

export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function searchGalleries(
  query: string,
  sort: string,
  page: number,
  cookies?: string,
  apiKey?: string
): Promise<SearchResponse> {
  if (isElectron() && window.electronAPI) {
    return await window.electronAPI.searchGalleries({ query, sort, page, cookies, apiKey });
  }
  if (isTauri()) {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<SearchResponse>("search_galleries", {
      query,
      sort,
      page,
      cookies: cookies || null,
    });
  }
  console.warn("Desktop environment not detected, using demo data");
  return mockSearchResponse(query, page);
}

export async function getGallery(id: number, cookies?: string, apiKey?: string): Promise<Gallery> {
  if (isElectron() && window.electronAPI) {
    return await window.electronAPI.getGallery({ id, cookies, apiKey });
  }
  if (isTauri()) {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<Gallery>("get_gallery", { id, cookies: cookies || null });
  }
  return mockGallery(id);
}

export async function getRandomGallery(cookies?: string, apiKey?: string): Promise<Gallery> {
  if (isElectron() && window.electronAPI?.getRandomGallery) {
    return await window.electronAPI.getRandomGallery({ cookies, apiKey });
  }
  const randomId = Math.floor(Math.random() * 400000) + 100000;
  return mockGallery(randomId);
}

export async function getTagsByType(
  tagType: string,
  sort = "popular",
  page = 1,
  cookies?: string,
  apiKey?: string
): Promise<{ result: import("../types").Tag[]; num_pages: number; per_page: number }> {
  if (isElectron() && window.electronAPI?.getTags) {
    return await window.electronAPI.getTags({ tagType, sort, page, cookies, apiKey });
  }
  return { result: [], num_pages: 1, per_page: 100 };
}

export async function getDefaultSettings(): Promise<AppSettings> {
  if (isElectron() && window.electronAPI) {
    return await window.electronAPI.getDefaultSettings();
  }
  if (isTauri()) {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<AppSettings>("get_default_settings");
  }
  return {
    download_directory: "C:\\nHentai Downloads",
    naming_pattern: "[{id}] [{artist}] {title} ({language})",
    default_format: "cbz",
    concurrent_downloads: 2,
    concurrent_images_per_gallery: 4,
    blacklisted_tags: ["scat", "guro"],
  };
}

export async function selectDownloadDirectory(): Promise<string | null> {
  if (isElectron() && window.electronAPI) {
    return await window.electronAPI.selectDownloadDirectory();
  }
  return null;
}

export async function formatFilenamePreview(
  pattern: string,
  gallery: Gallery
): Promise<string> {
  if (isElectron() && window.electronAPI) {
    return await window.electronAPI.formatFilenamePreview({ pattern, gallery });
  }
  if (isTauri()) {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<string>("format_filename_preview", { pattern, gallery });
  }
  const artist = gallery.tags.find((t) => t.type === "artist")?.name || "Unknown";
  const lang = gallery.tags.find((t) => t.type === "language" && t.name !== "translated")?.name || "japanese";
  return pattern
    .replace("{id}", gallery.id.toString())
    .replace("{title}", gallery.title.pretty || gallery.title.english || "Title")
    .replace("{artist}", artist)
    .replace("{language}", lang)
    .replace("{pages}", gallery.num_pages.toString());
}

export async function startDownload(
  gallery: Gallery,
  formatType: DownloadFormat,
  pattern: string,
  destDir: string,
  cookies?: string,
  apiKey?: string
): Promise<string> {
  if (isElectron() && window.electronAPI) {
    return await window.electronAPI.startDownload({
      gallery,
      formatType,
      pattern,
      destDir,
      cookies,
      apiKey,
    });
  }
  if (isTauri()) {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<string>("start_download", {
      gallery,
      formatType,
      pattern,
      destDir,
      cookies: cookies || null,
    });
  }
  return `C:\\nHentai Downloads\\${gallery.id}.cbz`;
}

export async function cancelDownload(galleryId: number): Promise<void> {
  if (isElectron() && window.electronAPI) {
    await window.electronAPI.cancelDownload({ galleryId });
    return;
  }
  if (isTauri()) {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("cancel_download", { galleryId });
  }
}

export async function openFolder(path: string): Promise<void> {
  if (isElectron() && window.electronAPI) {
    await window.electronAPI.openFolder({ targetPath: path });
    return;
  }
  if (isTauri()) {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("open_folder", { path });
  }
}

export async function scanLocalLibrary(directoryPath?: string): Promise<import("../types").LocalBookItem[]> {
  if (isElectron() && window.electronAPI?.scanLocalLibrary) {
    return await window.electronAPI.scanLocalLibrary({ directoryPath });
  }
  return [];
}

export async function readLocalBook(filePath: string): Promise<import("../types").LocalBookContent | null> {
  if (isElectron() && window.electronAPI?.readLocalBook) {
    return await window.electronAPI.readLocalBook({ filePath });
  }
  return null;
}

export async function getDownloadedGalleryIds(directoryPath?: string): Promise<Set<number>> {
  if (isElectron() && window.electronAPI?.getDownloadedIds) {
    const list = await window.electronAPI.getDownloadedIds({ directoryPath });
    return new Set(list);
  }
  return new Set();
}

export async function openAuthWindow(): Promise<void> {
  if (isElectron() && window.electronAPI) {
    await window.electronAPI.openAuthWindow();
    return;
  }
  if (isTauri()) {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("open_auth_window");
    return;
  }
  window.open("https://nhentai.net/login/", "_blank");
}

export function onDownloadProgress(
  callback: (payload: DownloadProgressPayload) => void
): () => void {
  if (isElectron() && window.electronAPI) {
    return window.electronAPI.onDownloadProgress(callback);
  }
  if (isTauri()) {
    let unlisten: (() => void) | null = null;
    import("@tauri-apps/api/event").then(({ listen }) => {
      listen<DownloadProgressPayload>("download-progress", (event) => {
        callback(event.payload);
      }).then((u) => {
        unlisten = u;
      });
    });
    return () => {
      if (unlisten) unlisten();
    };
  }
  return () => {};
}

export function onCookiesCaptured(
  callback: (cookies: string) => void
): () => void {
  if (isElectron() && window.electronAPI) {
    return window.electronAPI.onCookiesCaptured(callback);
  }
  return () => {};
}

// Helpers for image URL generation
export function cleanCdnPath(rawPath?: string): string {
  if (!rawPath) return "";
  let clean = rawPath.replace(/^\//, "");
  // Fix double extensions returned by nHentai API v2 like .jpg.webp -> .webp or .webp.webp -> .webp
  clean = clean.replace(/\.(jpg|jpeg|png|webp)\.webp$/i, ".webp");
  clean = clean.replace(/\.(jpg|jpeg|png|webp)\.jpg$/i, ".jpg");
  clean = clean.replace(/\.(jpg|jpeg|png|webp)\.png$/i, ".png");
  return clean;
}

export function getExtension(t: string): string {
  switch (t) {
    case "j": return "jpg";
    case "p": return "png";
    case "w": return "webp";
    case "g": return "gif";
    default: return "webp";
  }
}

export function getCoverUrl(gallery: Gallery): string {
  if (gallery.images?.cover?.path) {
    return `https://t.nhentai.net/${cleanCdnPath(gallery.images.cover.path)}`;
  }
  const mid = gallery.media_id || String(gallery.id);
  const ext = getExtension(gallery.images?.cover?.t || "w");
  return `https://t.nhentai.net/galleries/${mid}/thumb.${ext}`;
}

export function getThumbnailUrl(gallery: Gallery): string {
  if (gallery.images?.thumbnail?.path) {
    return `https://t.nhentai.net/${cleanCdnPath(gallery.images.thumbnail.path)}`;
  }
  const mid = gallery.media_id || String(gallery.id);
  const ext = getExtension(gallery.images?.thumbnail?.t || "w");
  return `https://t.nhentai.net/galleries/${mid}/thumb.${ext}`;
}

export function getPageThumbnailUrl(mediaId: string, pageIndex: number, extType: string): string {
  const ext = getExtension(extType || "w");
  return `https://t.nhentai.net/galleries/${mediaId}/${pageIndex + 1}t.${ext}`;
}

export function getPageFullUrl(
  mediaId: string,
  pageIndex: number,
  extType?: string,
  path?: string
): string {
  if (path) {
    return `https://i.nhentai.net/${cleanCdnPath(path)}`;
  }
  const ext = getExtension(extType || "w");
  return `https://i.nhentai.net/galleries/${mediaId}/${pageIndex + 1}.${ext}`;
}

export function extractArtistFromTitle(title: string): string | null {
  if (!title) return null;
  const match = title.match(/^\s*(?:\([^)]+\)\s*)?\[([^\]]+)\]/);
  return match ? match[1].trim() : null;
}

export function getGalleryDisplayTitle(gallery: Gallery): string {
  return gallery.title?.pretty || gallery.title?.english || gallery.title?.japanese || `Gallery #${gallery.id}`;
}

export function getGalleryLanguage(gallery: Gallery): string {
  const langTag = gallery.tags?.find((t) => t.type === "language" && t.name !== "translated");
  if (langTag && langTag.name) return langTag.name;
  const raw = (gallery.title?.english || gallery.title?.pretty || "").toLowerCase();
  if (raw.includes("[english]") || raw.includes("(english)")) return "english";
  if (raw.includes("[chinese]") || raw.includes("(chinese)")) return "chinese";
  if (raw.includes("[french]") || raw.includes("(french)")) return "french";
  if (raw.includes("[spanish]") || raw.includes("(spanish)")) return "spanish";
  return "japanese";
}

export function getGalleryArtist(gallery: Gallery): string {
  const artistTag = gallery.tags?.find((t) => t.type === "artist");
  if (artistTag && artistTag.name) return artistTag.name;
  const fromTitle = extractArtistFromTitle(gallery.title?.english || gallery.title?.pretty || "");
  return fromTitle || "Unknown Artist";
}

function mockGallery(id: number): Gallery {
  return {
    id,
    media_id: "2849182",
    title: {
      pretty: `Sample Doujinshi #${id}`,
      english: `[Artist] Sample Doujinshi #${id} [English]`,
      japanese: `[作家] サンプル同人誌 #${id}`,
    },
    images: {
      cover: { t: "j", w: 350, h: 500 },
      thumbnail: { t: "j", w: 250, h: 350 },
      pages: Array.from({ length: 24 }, () => ({ t: "j", w: 1200, h: 1800 })),
    },
    num_pages: 24,
    num_favorites: 1420,
    upload_date: 1700000000,
    tags: [
      { id: 1, type: "artist", name: "matsumoto", url: "/artist/matsumoto/", count: 42 },
      { id: 2, type: "language", name: "english", url: "/language/english/", count: 120000 },
      { id: 3, type: "category", name: "doujinshi", url: "/category/doujinshi/", count: 350000 },
      { id: 4, type: "parody", name: "original", url: "/parody/original/", count: 210000 },
      { id: 5, type: "tag", name: "sole female", url: "/tag/sole-female/", count: 95000 },
      { id: 6, type: "tag", name: "sole male", url: "/tag/sole-male/", count: 88000 },
      { id: 7, type: "tag", name: "stockings", url: "/tag/stockings/", count: 72000 },
    ],
  };
}

function mockSearchResponse(_query: string, page: number): SearchResponse {
  return {
    result: Array.from({ length: 12 }, (_, i) => mockGallery(400000 + i + (page - 1) * 12)),
    num_pages: 5,
    per_page: 12,
  };
}

export async function fetchImageData(
  url: string,
  referer?: string,
  cookies?: string,
  apiKey?: string
): Promise<string | null> {
  if (isElectron() && window.electronAPI?.getImageData) {
    return await window.electronAPI.getImageData({ url, referer, cookies, apiKey });
  }
  return url;
}

export async function preloadGalleryImages(
  urls: string[],
  referer?: string,
  cookies?: string,
  apiKey?: string
): Promise<void> {
  if (isElectron() && window.electronAPI?.preloadGalleryImages) {
    await window.electronAPI.preloadGalleryImages({ urls, referer, cookies, apiKey });
  }
}

export async function saveDownloadedArchive(params: {
  gallery: Gallery;
  formatType: DownloadFormat;
  pattern: string;
  destDir: string;
  pagesData: Array<{ pageNum: number; ext: string; bufferBase64: string }>;
}): Promise<string> {
  if (isElectron() && window.electronAPI?.saveDownloadedArchive) {
    return await window.electronAPI.saveDownloadedArchive(params);
  }
  return "";
}

export async function logToTerminal(text: string): Promise<void> {
  if (isElectron() && window.electronAPI?.logTerminal) {
    await window.electronAPI.logTerminal(text);
  } else {
    console.log(text);
  }
}


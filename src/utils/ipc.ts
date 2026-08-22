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
      getCdnConfig?: () => Promise<import("../types").CdnConfig>;
      getGalleryComments?: (params: { galleryId: number; cookies?: string; apiKey?: string }) => Promise<import("../types").GalleryComment[]>;
      updateDnsSettings?: (params: { dns_provider: string; enable_custom_dns: boolean; enable_doh: boolean }) => Promise<{ success: boolean; error?: string }>;
      startQuickShareServer?: (params?: { port?: number; directoryPath?: string }) => Promise<{ active: boolean; port: number; ip: string; url: string }>;
      stopQuickShareServer?: () => Promise<{ active: boolean }>;
      getQuickShareStatus?: () => Promise<{ active: boolean; port: number; ip: string; url: string; filesCount: number; activeTransfers: number; uptime: number }>;
      getLocalDownloadedFiles?: (params?: { directoryPath?: string }) => Promise<Array<{ id?: number; filename: string; title: string; artist?: string; size: number; sizeFormatted: string; pagesCount: number; format: string; mtime: number }>>;
      getSecretStatus?: () => Promise<{ hasCookies: boolean; hasApiKey: boolean; encrypted: boolean }>;
      setSecrets?: (params: { cookies?: string; apiKey?: string }) => Promise<{ hasCookies: boolean; hasApiKey: boolean; encrypted: boolean }>;
      migrateSecrets?: (params: { cookies?: string; apiKey?: string }) => Promise<{ hasCookies: boolean; hasApiKey: boolean; encrypted: boolean }>;
      clearSecrets?: () => Promise<{ hasCookies: boolean; hasApiKey: boolean; encrypted: boolean }>;
      logTerminal?: (text: string) => Promise<boolean>;
      onDownloadProgress: (callback: (payload: DownloadProgressPayload) => void) => () => void;
      onCookiesCaptured: (callback: (cookies: string) => void) => () => void;
      onSecretsUpdated?: (callback: (status: { hasCookies: boolean; hasApiKey: boolean; encrypted: boolean }) => void) => () => void;
      onCloudflareChallengeNeeded?: (callback: () => void) => () => void;
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
  try {
    const sortParam = sort && sort !== "date" ? `&sort=${sort}` : "";
    const queryParam = query.trim() ? `query=${encodeURIComponent(query)}&` : "";
    const url = query.trim()
      ? `http://127.0.0.1:8787/api/galleries/search?${queryParam}page=${page}${sortParam}`
      : `http://127.0.0.1:8787/api/galleries/all?page=${page}`;
    const res = await fetch(url);
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.warn("Direct mirror request failed:", e);
  }
  return { result: [], num_pages: 0, per_page: 25 };
}

const galleryCache = new Map<number, { gallery: Gallery; timestamp: number }>();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes TTL

export async function getGallery(id: number, cookies?: string, apiKey?: string): Promise<Gallery> {
  const cached = galleryCache.get(id);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.gallery;
  }

  let gallery: Gallery | null = null;
  if (isElectron() && window.electronAPI) {
    gallery = await window.electronAPI.getGallery({ id, cookies, apiKey });
  } else if (isTauri()) {
    const { invoke } = await import("@tauri-apps/api/core");
    gallery = await invoke<Gallery>("get_gallery", { id, cookies: cookies || null });
  } else {
    try {
      const res = await fetch(`http://127.0.0.1:8787/api/gallery/${id}`);
      if (res.ok) {
        gallery = await res.json();
      }
    } catch {}
  }

  if (gallery && gallery.id) {
    galleryCache.set(id, { gallery, timestamp: Date.now() });
    if (galleryCache.size > 200) {
      const oldestKey = galleryCache.keys().next().value;
      if (oldestKey !== undefined) galleryCache.delete(oldestKey);
    }
    return gallery;
  }

  throw new Error(`Galerie #${id} introuvable`);
}

export async function getRandomGallery(cookies?: string, apiKey?: string): Promise<Gallery> {
  if (isElectron() && window.electronAPI?.getRandomGallery) {
    return await window.electronAPI.getRandomGallery({ cookies, apiKey });
  }
  try {
    const res = await fetch("http://127.0.0.1:8787/api/galleries/random");
    if (res.ok) {
      return await res.json();
    }
  } catch {}
  throw new Error("Impossible de charger une galerie aléatoire");
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
  const artist = (gallery?.tags || []).find((t) => t.type === "artist")?.name || "Unknown";
  const lang = (gallery?.tags || []).find((t) => t.type === "language" && t.name !== "translated")?.name || "japanese";
  return pattern
    .replace("{id}", (gallery?.id || "").toString())
    .replace("{title}", gallery?.title?.pretty || gallery?.title?.english || "Title")
    .replace("{artist}", artist)
    .replace("{language}", lang)
    .replace("{pages}", (gallery?.num_pages || "").toString());
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

export function onSecretsUpdated(
  callback: (status: { hasCookies: boolean; hasApiKey: boolean; encrypted: boolean }) => void
): () => void {
  if (isElectron() && window.electronAPI?.onSecretsUpdated) {
    return window.electronAPI.onSecretsUpdated(callback);
  }
  return () => {};
}

export async function getSecretStatus(): Promise<{ hasCookies: boolean; hasApiKey: boolean; encrypted: boolean }> {
  if (isElectron() && window.electronAPI?.getSecretStatus) {
    return await window.electronAPI.getSecretStatus();
  }
  return { hasCookies: false, hasApiKey: false, encrypted: false };
}

export async function setSecrets(params: {
  cookies?: string;
  apiKey?: string;
}): Promise<{ hasCookies: boolean; hasApiKey: boolean; encrypted: boolean }> {
  if (isElectron() && window.electronAPI?.setSecrets) {
    return await window.electronAPI.setSecrets(params);
  }
  return { hasCookies: Boolean(params.cookies), hasApiKey: Boolean(params.apiKey), encrypted: false };
}

export async function migrateSecrets(params: {
  cookies?: string;
  apiKey?: string;
}): Promise<{ hasCookies: boolean; hasApiKey: boolean; encrypted: boolean }> {
  if (isElectron() && window.electronAPI?.migrateSecrets) {
    return await window.electronAPI.migrateSecrets(params);
  }
  return { hasCookies: Boolean(params.cookies), hasApiKey: Boolean(params.apiKey), encrypted: false };
}

export function onCloudflareChallengeNeeded(
  callback: () => void
): () => void {
  if (isElectron() && window.electronAPI?.onCloudflareChallengeNeeded) {
    return window.electronAPI.onCloudflareChallengeNeeded(callback);
  }
  return () => {};
}

// Normalization helper from NHApp: collapses duplicate chained extensions (e.g. cover.webp.webp -> cover.webp)
export function normalizeV2MediaPath(path?: string): string {
  if (!path) return "";
  let p = path.trim();
  if (/^https?:\/\//i.test(p)) {
    try {
      const u = new URL(p);
      let pathname = u.pathname;
      while (/\.webp\.webp$/i.test(pathname)) {
        pathname = pathname.replace(/\.webp\.webp$/i, ".webp");
      }
      while (/\.jpg\.jpg$/i.test(pathname)) {
        pathname = pathname.replace(/\.jpg\.jpg$/i, ".jpg");
      }
      while (/\.png\.png$/i.test(pathname)) {
        pathname = pathname.replace(/\.png\.png$/i, ".png");
      }
      u.pathname = pathname;
      return u.toString();
    } catch {
      let s = p;
      while (/\.webp\.webp$/i.test(s)) {
        s = s.replace(/\.webp\.webp$/i, ".webp");
      }
      return s;
    }
  }
  while (/\.webp\.webp$/i.test(p)) {
    p = p.replace(/\.webp\.webp$/i, ".webp");
  }
  while (/\.jpg\.jpg$/i.test(p)) {
    p = p.replace(/\.jpg\.jpg$/i, ".jpg");
  }
  while (/\.png\.png$/i.test(p)) {
    p = p.replace(/\.png\.png$/i, ".png");
  }
  return p.replace(/^\//, "");
}

export function cleanCdnPath(rawPath?: string): string {
  return normalizeV2MediaPath(rawPath);
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
    return `https://t3.nhentai.net/${cleanCdnPath(gallery.images.cover.path)}`;
  }
  const mid = gallery.media_id || String(gallery.id);
  const ext = getExtension(gallery.images?.cover?.t || "w");
  return `https://t3.nhentai.net/galleries/${mid}/thumb.${ext}`;
}

export function getThumbnailUrl(gallery: Gallery): string {
  if (gallery.images?.thumbnail?.path) {
    return `https://t3.nhentai.net/${cleanCdnPath(gallery.images.thumbnail.path)}`;
  }
  const mid = gallery.media_id || String(gallery.id);
  const ext = getExtension(gallery.images?.thumbnail?.t || "w");
  return `https://t3.nhentai.net/galleries/${mid}/thumb.${ext}`;
}

export function getPageThumbnailUrl(mediaId: string, pageIndex: number, extType: string): string {
  const ext = getExtension(extType || "w");
  return `https://t3.nhentai.net/galleries/${mediaId}/${pageIndex + 1}t.${ext}`;
}

export function getPageFullUrl(
  mediaId: string,
  pageIndex: number,
  extType?: string,
  path?: string
): string {
  if (path) {
    return `https://i3.nhentai.net/${cleanCdnPath(path)}`;
  }
  const ext = getExtension(extType || "w");
  return `https://i3.nhentai.net/galleries/${mediaId}/${pageIndex + 1}.${ext}`;
}

export function extractArtistFromTitle(title: string): string | null {
  if (!title) return null;
  const match = title.match(/^\s*(?:\([^)]+\)\s*)?\[([^\]]+)\]/);
  return match ? match[1].trim() : null;
}

export function getGalleryDisplayTitle(gallery?: Gallery | null): string {
  if (!gallery) return "Gallery";
  return gallery.title?.pretty || gallery.title?.english || gallery.title?.japanese || `Gallery #${gallery.id || ""}`;
}

export function getGalleryLanguage(gallery?: Gallery | null): string {
  if (!gallery) return "japanese";
  const langTag = (gallery.tags || []).find((t) => t.type === "language" && t.name !== "translated");
  if (langTag && langTag.name) return langTag.name;
  const raw = (gallery.title?.english || gallery.title?.pretty || "").toLowerCase();
  if (raw.includes("[english]") || raw.includes("(english)")) return "english";
  if (raw.includes("[chinese]") || raw.includes("(chinese)")) return "chinese";
  if (raw.includes("[french]") || raw.includes("(french)")) return "french";
  if (raw.includes("[spanish]") || raw.includes("(spanish)")) return "spanish";
  return "japanese";
}

export function getGalleryArtist(gallery?: Gallery | null): string {
  if (!gallery) return "Unknown Artist";
  const artistTag = (gallery.tags || []).find((t) => t.type === "artist");
  if (artistTag && artistTag.name) return artistTag.name;
  const fromTitle = extractArtistFromTitle(gallery.title?.english || gallery.title?.pretty || "");
  return fromTitle || "Unknown Artist";
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

export async function getCdnConfig(): Promise<import("../types").CdnConfig> {
  if (isElectron() && window.electronAPI?.getCdnConfig) {
    return await window.electronAPI.getCdnConfig();
  }
  return {
    image_servers: ["https://i1.nhentai.net", "https://i2.nhentai.net", "https://i3.nhentai.net", "https://i4.nhentai.net"],
    thumb_servers: ["https://t1.nhentai.net", "https://t2.nhentai.net", "https://t3.nhentai.net", "https://t4.nhentai.net"],
  };
}

export async function getGalleryComments(
  galleryId: number,
  cookies?: string,
  apiKey?: string
): Promise<import("../types").GalleryComment[]> {
  if (isElectron() && window.electronAPI?.getGalleryComments) {
    return await window.electronAPI.getGalleryComments({ galleryId, cookies, apiKey });
  }
  return [];
}

export async function updateDnsSettings(params: {
  dns_provider: string;
  enable_custom_dns: boolean;
  enable_doh: boolean;
}): Promise<void> {
  if (isElectron() && window.electronAPI?.updateDnsSettings) {
    await window.electronAPI.updateDnsSettings(params);
  }
}

/**
 * Universal Multi-Server & Edge CDN Matrix Fallback Resolver (inspired by NHApp's buildImageFallbacks)
 * Generates valid candidate URLs prioritizing ultra-fast Photon Edge mirrors (0-100ms) that bypass ISP blocks,
 * followed by DuckDuckGo edge proxy and direct numbered CDN mirrors.
 */
export function buildImageFallbacks(
  rawPathOrUrl: string,
  kind: "thumb" | "page" = "thumb",
  mediaId?: string,
  pageNum?: number
): string[] {
  if (!rawPathOrUrl) {
    if (!mediaId) return [];
  }

  // Handle local books, data URLs, blobs directly
  if (
    rawPathOrUrl &&
    (rawPathOrUrl.startsWith("data:") ||
      rawPathOrUrl.startsWith("blob:") ||
      rawPathOrUrl.startsWith("file:") ||
      rawPathOrUrl.startsWith("local:"))
  ) {
    return [rawPathOrUrl];
  }

  const list: string[] = [];
  const seen = new Set<string>();
  const add = (u: string) => {
    const trimmed = (u || "").trim();
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    list.push(trimmed);
  };

  // Clean and normalize the path
  let path = cleanCdnPath(rawPathOrUrl);
  if (/^https?:\/\//i.test(path)) {
    try {
      const u = new URL(path);
      path = u.pathname.replace(/^\//, "");
    } catch {}
  }
  path = normalizeV2MediaPath(path);

  if (!path && mediaId) {
    const baseName = kind === "thumb" ? (pageNum ? `${pageNum}t` : "thumb") : `${pageNum || 1}`;
    path = `galleries/${mediaId}/${baseName}.webp`;
  }

  const thumbNumHosts = ["t3.nhentai.net", "t2.nhentai.net", "t1.nhentai.net", "t4.nhentai.net"];
  const pageNumHosts = ["i3.nhentai.net", "i2.nhentai.net", "i1.nhentai.net", "i4.nhentai.net"];
  const directHosts = kind === "thumb" ? thumbNumHosts : pageNumHosts;

  // 1. High-Speed WordPress Jetpack Photon CDN Edge Mirrors (Unblocked worldwide, HTTP 200, <100ms response time)
  if (path) {
    add(`https://i0.wp.com/${directHosts[0]}/${path}`);
    add(`https://i1.wp.com/${directHosts[1]}/${path}`);
    add(`https://i2.wp.com/${directHosts[2]}/${path}`);
    add(`https://i3.wp.com/${directHosts[3]}/${path}`);
    if (kind === "thumb") {
      add(`https://i0.wp.com/t.nhentai.net/${path}`);
      add(`https://i1.wp.com/t.nhentai.net/${path}`);
    } else {
      add(`https://i0.wp.com/i.nhentai.net/${path}`);
      add(`https://i1.wp.com/i.nhentai.net/${path}`);
    }
  }

  // 2. Direct Numbered CDN Hosts (when Custom DNS or VPN is active)
  if (path) {
    for (const h of directHosts) {
      add(`https://${h}/${path}`);
    }
    if (kind === "thumb") {
      add(`https://t.nhentai.net/${path}`);
    } else {
      add(`https://i.nhentai.net/${path}`);
    }
  }

  // 3. Extension Variant Fallbacks (.jpg, .png, .webp, .jpg.webp, .png.webp)
  if (path) {
    const extMatch = path.match(/\.([a-z0-9]+)$/i);
    const currentExt = extMatch ? extMatch[1].toLowerCase() : "webp";
    const alternateExts = ["webp", "jpg", "png", "jpg.webp", "png.webp"].filter((e) => e !== currentExt);

    for (const ext of alternateExts) {
      const altPath = path.replace(/\.([a-z0-9.]+)$/i, `.${ext}`);
      add(`https://i0.wp.com/${directHosts[0]}/${altPath}`);
      add(`https://i1.wp.com/${directHosts[1]}/${altPath}`);
      add(`https://${directHosts[0]}/${altPath}`);
    }
  }

  // 4. If mediaId is provided, generate thumb/cover matrix
  if (mediaId && kind === "thumb" && !pageNum) {
    add(`https://i0.wp.com/t3.nhentai.net/galleries/${mediaId}/thumb.webp`);
    add(`https://i1.wp.com/t2.nhentai.net/galleries/${mediaId}/thumb.jpg`);
    add(`https://i2.wp.com/t3.nhentai.net/galleries/${mediaId}/cover.webp`);
    add(`https://i3.wp.com/t3.nhentai.net/galleries/${mediaId}/cover.jpg`);
    add(`https://i0.wp.com/i3.nhentai.net/galleries/${mediaId}/1.webp`);
  }

  return list;
}

export async function logToTerminal(text: string): Promise<void> {
  if (isElectron() && window.electronAPI?.logTerminal) {
    await window.electronAPI.logTerminal(text);
  } else {
    console.log(text);
  }
}

export async function startQuickShareServer(
  port?: number,
  directoryPath?: string
): Promise<{ active: boolean; port: number; ip: string; url: string }> {
  if (isElectron() && window.electronAPI?.startQuickShareServer) {
    return await window.electronAPI.startQuickShareServer({ port, directoryPath });
  }
  return { active: true, port: 45678, ip: "127.0.0.1", url: "http://127.0.0.1:45678/" };
}

export async function stopQuickShareServer(): Promise<{ active: boolean }> {
  if (isElectron() && window.electronAPI?.stopQuickShareServer) {
    return await window.electronAPI.stopQuickShareServer();
  }
  return { active: false };
}

export async function getQuickShareStatus(): Promise<{ active: boolean; port: number; ip: string; url: string; filesCount: number; activeTransfers: number; uptime: number }> {
  if (isElectron() && window.electronAPI?.getQuickShareStatus) {
    return await window.electronAPI.getQuickShareStatus();
  }
  return { active: false, port: 45678, ip: "127.0.0.1", url: "http://127.0.0.1:45678/", filesCount: 0, activeTransfers: 0, uptime: 0 };
}

export async function getLocalDownloadedFiles(directoryPath?: string): Promise<Array<{ id?: number; filename: string; title: string; artist?: string; size: number; sizeFormatted: string; pagesCount: number; format: string; mtime: number }>> {
  if (isElectron() && window.electronAPI?.getLocalDownloadedFiles) {
    return await window.electronAPI.getLocalDownloadedFiles({ directoryPath });
  }
  return [];
}



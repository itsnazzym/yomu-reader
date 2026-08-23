/**
 * Adaptateur doujins.com (scraping HTML + listing JSON /folders).
 *
 * Structure cartographiée le 2026-08-23 :
 * - Browse  : GET /folders?start=<unix>&end=<unix> → { premium: FolderItem[] }
 *             (~1 mois, id + link + title + thumbnails signées + tags)
 * - Recherche: /list?search=<q>&sort=newest — PAS de pagination côté site
 *             (?page=2 renvoie les mêmes résultats), ~16-25 résultats max.
 * - Carte    : <a href="/<series>/<slug>-<id>"><img src="…f2-…jpg?st=&e=">
 * - Galerie  : /<series>/<slug>-<id>. Le serveur sert la galerie d'après le
 *              SUFFIXE -<id>, quel que soit le slug : on résout donc tout par
 *              l'URL directe /hentai-manga/x-<id> (pas besoin de listing).
 * - Pages    : data-file signées si accessibles ; sinon aperçu n-<hash>.jpg.
 */

import { Platform } from "react-native";
import {
  extractMatches,
  stripTags,
  decodeEntities,
  sanitizeMediaUrl,
  stripNhentaiOperators,
} from "./html";
import {
  makeGlobalId,
  type SourceAdapter,
  type SourceGallery,
  type SourceGalleryCard,
  type SourceMeta,
  type SourceSearchOptions,
  type SourceTag,
} from "./types";

const BASE = "https://doujins.com";
const TIMEOUT_MS = 12000;

const HEADERS: Record<string, string> = {
  "User-Agent":
    Platform.OS === "android"
      ? "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36"
      : "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  Referer: `${BASE}/`,
  Accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
};

interface FolderTag {
  tag?: string;
}

interface FolderItem {
  id: number;
  name: string;
  link?: string;
  thumbnail?: string;
  thumbnail2?: string;
  objects_count?: number;
  date?: string | number;
  created_at?: string;
  artistList?: string;
  artists?: string[];
  tags?: FolderTag[];
  series?: string;
  free?: number;
  hidden?: number;
  private?: number;
}

interface CachedGallery {
  path: string;
  title: string;
  coverUrl: string;
  numPages?: number;
  tags: SourceTag[];
  uploadDate?: number;
}

const galleryCache = new Map<string, CachedGallery>();

async function fetchHtml(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: HEADERS, signal: controller.signal });
    if (!res.ok) throw new Error(`Doujins HTTP ${res.status} sur ${url}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { ...HEADERS, Accept: "application/json" },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Doujins HTTP ${res.status} sur ${url}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

function remember(nativeId: string, entry: CachedGallery): void {
  galleryCache.set(nativeId, entry);
}

function folderDateMs(it: FolderItem): number | undefined {
  if (typeof it.date === "number" && Number.isFinite(it.date)) {
    return it.date > 1e12 ? it.date : it.date * 1000;
  }
  if (it.created_at) {
    const parsed = Date.parse(it.created_at);
    if (Number.isFinite(parsed)) return parsed;
  }
  if (typeof it.date === "string") {
    const parsed = Date.parse(it.date);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function folderTags(it: FolderItem): SourceTag[] {
  const tags: SourceTag[] = [];
  const seen = new Set<string>();
  const push = (name: string, type: string): void => {
    const clean = name.trim();
    if (!clean) return;
    const key = `${type}:${clean.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    tags.push({ name: clean, type });
  };
  if (it.artistList) {
    for (const artist of it.artistList.split(",")) push(artist, "artist");
  }
  if (Array.isArray(it.artists)) {
    for (const artist of it.artists) push(artist, "artist");
  }
  if (it.series) push(it.series, "parody");
  if (Array.isArray(it.tags)) {
    for (const tag of it.tags) {
      if (tag?.tag) push(tag.tag, "tag");
    }
  }
  return tags;
}

function folderCover(it: FolderItem): string {
  return sanitizeMediaUrl(it.thumbnail2 || it.thumbnail || "");
}

function folderToCard(it: FolderItem): SourceGalleryCard | null {
  if (!it.id || !it.link || it.hidden || it.private) return null;
  const nativeId = String(it.id);
  const title = decodeEntities(it.name || `Doujins #${nativeId}`);
  const coverUrl = folderCover(it);
  const tags = folderTags(it);
  remember(nativeId, {
    path: it.link.startsWith("/") ? it.link : `/${it.link}`,
    title,
    coverUrl,
    numPages: it.objects_count || undefined,
    tags,
    uploadDate: folderDateMs(it),
  });
  return {
    globalId: makeGlobalId("doujins", nativeId),
    title,
    coverUrl,
    numPages: it.objects_count || undefined,
    uploadDate: folderDateMs(it),
    tags,
  };
}

/** Parse les cartes HTML /list (href + img + titre, wrappers internes OK). */
export function parseDoujinsListCards(html: string): SourceGalleryCard[] {
  const seen = new Set<string>();
  const cards: SourceGalleryCard[] = [];
  const hrefRe = /<a href="(\/[^"]+-(\d+))"[^>]*>/g;
  let match: RegExpExecArray | null = hrefRe.exec(html);
  while (match) {
    const path = decodeEntities(match[1]);
    const nativeId = match[2];
    const start = match.index + match[0].length;
    match = hrefRe.exec(html);
    if (!nativeId || seen.has(nativeId) || !/-\d+$/.test(path)) continue;
    seen.add(nativeId);
    const window = html.slice(start, start + 1800);
    const imgM = window.match(/<img[^>]+src="([^"]+)"/i);
    const titleM = window.match(/<div class="text">([\s\S]*?)<\/div>/);
    const title = titleM
      ? stripTags(titleM[1])
      : `Doujins #${nativeId}`;
    const coverUrl = imgM ? sanitizeMediaUrl(imgM[1]) : "";
    remember(nativeId, { path, title, coverUrl, tags: [] });
    cards.push({
      globalId: makeGlobalId("doujins", nativeId),
      title,
      coverUrl,
    });
  }
  return cards;
}

function extractPageUrls(html: string): string[] {
  const fromDataFile = extractMatches(
    html,
    /<img\s+class="doujin[^"]*"[\s\S]{0,400}?data-file="(https:\/\/static\.doujins\.com\/[^"]+)"/g
  )
    .map((m) => sanitizeMediaUrl(m[1]))
    .filter((url) => url && !url.includes("/f2-") && !url.includes("/t-") && !url.includes("/t2-"));

  if (fromDataFile.length > 0) return fromDataFile;

  const previews = extractMatches(
    html,
    /https:\/\/static\.doujins\.com\/n-[^"\s]+/g
  )
    .map((m) => sanitizeMediaUrl(m[0]))
    .filter((url, index, all) => url && all.indexOf(url) === index);
  return previews;
}

export class DoujinsSource implements SourceAdapter {
  meta: SourceMeta = {
    id: "doujins",
    label: "Doujins",
    baseUrl: BASE,
    accentColor: "#4fc3f7",
    supportsLogin: false,
    supportsComments: false,
  };

  async search(opts: SourceSearchOptions): Promise<{
    cards: SourceGalleryCard[];
    hasMore: boolean;
  }> {
    const query = stripNhentaiOperators(opts.query);
    if (query) {
      const url = `${BASE}/list?search=${encodeURIComponent(query)}&sort=newest`;
      const html = await fetchHtml(url);
      return { cards: parseDoujinsListCards(html), hasMore: false };
    }

    const now = new Date();
    const back = Math.max(0, (opts.page || 1) - 1);
    const month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1));
    const startSec = Math.floor(month.getTime() / 1000);
    const endSec = Math.floor(
      Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1) / 1000
    );

    const json = await fetchJson<{ premium?: FolderItem[] }>(
      `${BASE}/folders?start=${startSec}&end=${endSec}`
    );
    const cards = (json.premium || [])
      .map((item) => folderToCard(item))
      .filter((card): card is SourceGalleryCard => card !== null);
    return { cards, hasMore: true };
  }

  async getGallery(nativeId: string, knownTitle?: string): Promise<SourceGallery> {
    const cached = galleryCache.get(nativeId);

    let html = "";
    try {
      html = await this.fetchGalleryHtml(nativeId, cached?.path);
    } catch {
      html = "";
    }

    const pageUrls = html ? extractPageUrls(html) : [];
    const titleFromHtml =
      html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) ||
      html.match(/<title>[^<]*?-\s*([^<]+?)\s+by\s+[^<]+<\/title>/) ||
      html.match(/<title>([^<]+)<\/title>/);
    const title = cached?.title
      || (titleFromHtml ? stripTags(titleFromHtml[1]) : "")
      || `Doujins #${nativeId}`;

    const tags: SourceTag[] = cached?.tags ? [...cached.tags] : [];
    if (html && tags.length === 0) {
      const tagsBlockM = html.match(
        /fa-tags[\s\S]*?Tag<\/div>\s*<hr\s*\/?>\s*([\s\S]*?)<\/li>/
      );
      if (tagsBlockM) {
        for (const t of extractMatches(tagsBlockM[1], /<a href="[^"]*"[^>]*>([^<]+)<\/a>/g)) {
          const name = stripTags(t[1]);
          if (name) tags.push({ name, type: "tag" });
        }
      }
      const artistBlock = html.match(/gallery-artist"\s*>([\s\S]*?)<\/div>/);
      if (artistBlock) {
        for (const a of extractMatches(artistBlock[1], /<a href=\/artists\/[^>]*>([^<]+)<\/a>/g)) {
          tags.push({ name: stripTags(a[1]), type: "artist" });
        }
      }
    }

    const coverUrl =
      pageUrls[0] ||
      cached?.coverUrl ||
      (html.match(/https:\/\/static\.doujins\.com\/f2?-[^"\s]+/)
        ? sanitizeMediaUrl((html.match(/https:\/\/static\.doujins\.com\/f2?-[^"\s]+/) || [""])[0])
        : "");

    // Le site sert la home page (HTTP 200) pour les IDs inexistants : une
    // galerie valide expose toujours au moins une image extractible.
    if (!cached && pageUrls.length === 0) {
      throw new Error(`Doujins: galerie ${nativeId} introuvable`);
    }

    return {
      globalId: makeGlobalId("doujins", nativeId),
      nativeId,
      title,
      coverUrl,
      numPages: pageUrls.length || cached?.numPages || 0,
      uploadDate: cached?.uploadDate,
      tags,
      pageUrls: pageUrls.map((url) => ({ url })),
    };
  }

  /**
   * Récupère le HTML de la galerie. Le serveur sert la galerie d'après le
   * suffixe -<id> de l'URL, quel que soit le slug : on tente le chemin exact
   * en cache puis l'URL directe /hentai-manga/x-<id>. Plus de cascade
   * recherche-titre / listings (limités au récent et coûteux en requêtes).
   */
  private async fetchGalleryHtml(
    nativeId: string,
    knownPath?: string
  ): Promise<string> {
    const candidates: string[] = [];
    if (knownPath) candidates.push(knownPath);
    candidates.push(`/hentai-manga/x-${nativeId}`);
    for (const path of candidates) {
      try {
        return await fetchHtml(`${BASE}${path}`);
      } catch {
        // candidat suivant
      }
    }
    throw new Error(`Doujins: chemin HTML introuvable pour ${nativeId}`);
  }

  async getRandomNativeId(): Promise<string> {
    const html = await fetchHtml(`${BASE}/list?sort=random`);
    const cards = parseDoujinsListCards(html);
    if (cards.length === 0) throw new Error("Doujins random: liste vide");
    return splitNative(cards[Math.floor(Math.random() * cards.length)].globalId);
  }
}

function splitNative(globalId: string): string {
  return globalId.split(":")[1] ?? "";
}

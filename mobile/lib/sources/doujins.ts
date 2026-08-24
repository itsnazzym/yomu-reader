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
  extractAttribute,
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
  type SourceTaxonomyItem,
} from "./types";
import { recordObservedTags } from "../sourceTaxonomyStore";
import { probeAdapterHealth } from "./probeHealth";

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
  // Enrichissement cumulatif : les tags rencontrés dans les listings
  // complètent la liste officielle (36) de /tags. Fire-and-forget.
  recordObservedTags([
    ...tags.map((t) => t.name),
    ...folderTagsArtists(it),
  ]).catch(() => {});
  return {
    globalId: makeGlobalId("doujins", nativeId),
    title,
    coverUrl,
    numPages: it.objects_count || undefined,
    uploadDate: folderDateMs(it),
    tags,
  };
}

/** Artistes + série d'un item folder, pour le cumul taxonomie. */
function folderTagsArtists(it: FolderItem): string[] {
  const out: string[] = [];
  if (Array.isArray(it.artists)) out.push(...it.artists);
  else if (it.artistList) out.push(...it.artistList.split(","));
  if (it.series) out.push(it.series);
  return out.filter((s): s is string => Boolean(s && s.trim()));
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
    // Taxonomie (/tags/, /artists/…) n'est pas une galerie.
    if (/^\/(tags|artists|series|groups|characters)\//i.test(path)) continue;
    seen.add(nativeId);
    const window = html.slice(start, start + 1800);
    const imgM = window.match(/<img[^>]+src="([^"]+)"/i);
    const textM = window.match(/<div class="text">([\s\S]*?)<\/div>/);
    const titleBlockM = window.match(/<div class="title">([\s\S]*?)<\/div>/);
    let title = textM ? stripTags(textM[1]) : "";
    if (!title && titleBlockM) {
      title = stripTags(titleBlockM[1]);
    }
    if (!title) {
      title = humanizeDoujinsSlug(path, nativeId);
    }
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

/** Titre lisible depuis le slug d'URL si le HTML n'en fournit pas. */
function humanizeDoujinsSlug(path: string, nativeId: string): string {
  const segment = path.split("/").pop() || "";
  const withoutId = segment.replace(new RegExp(`-${nativeId}$`), "");
  const humanized = withoutId
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!humanized) return `Doujins #${nativeId}`;
  return humanized.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Item de la page /tags : href="/tags/<Nom>-<tag_id>" (+ query ?x=N). */
const TAGS_PAGE_ITEM_RE = /<a href="(\/tags\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/g;

/** Parse la page /tags (tags populaires officiels, avec leur id natif). */
export function parseDoujinsTagsPage(html: string): SourceTaxonomyItem[] {
  const out: SourceTaxonomyItem[] = [];
  const seen = new Set<string>();
  for (const m of extractMatches(html, TAGS_PAGE_ITEM_RE)) {
    const href = decodeEntities(m[1]);
    const name = stripTags(m[2]).trim();
    // L'id est le dernier segment numérique du href ("Bakunyuu-14?x=13").
    const idMatch = href.match(/-([0-9]+)(?:[?#]|$)/);
    if (!name || seen.has(name.toLowerCase()) || !idMatch) continue;
    seen.add(name.toLowerCase());
    out.push({ name, id: idMatch[1] });
  }
  return out;
}

function extractPageUrls(html: string): string[] {
  // Nouveau DOM : <img class="doujin" data-file="…" data-thumb2="…">.
  // Sans abonnement, data-file est vide et data-link="/subscribe".
  const fromDoujinImgs = extractMatches(
    html,
    /<img\b[^>]*class="[^"]*doujin[^"]*"[^>]*>/gi
  )
    .map((m) => {
      const tag = m[0];
      const dataFile = extractAttribute(tag, "data-file");
      if (dataFile && dataFile.trim()) {
        return sanitizeMediaUrl(dataFile);
      }
      const thumb2 = extractAttribute(tag, "data-thumb2");
      const thumb = extractAttribute(tag, "data-thumb");
      const raw = thumb2 || thumb || "";
      if (!raw) return "";
      // t- / t2- = miniatures ; f- = image pleine (même token + signature).
      return sanitizeMediaUrl(raw.replace(/\/t2?-/, "/f-"));
    })
    .filter((url): url is string => Boolean(url));

  if (fromDoujinImgs.length > 0) {
    return [...new Set(fromDoujinImgs)];
  }

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

function isDoujinsPaywalled(html: string): boolean {
  return (
    /data-link\s*=\s*["']\/subscribe["']/i.test(html) ||
    (/class="[^"]*doujin[^"]*"/i.test(html) &&
      /data-file\s*=\s*["']\s*["']/i.test(html) &&
      !/data-file\s*=\s*["']https?:\/\//i.test(html))
  );
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
    const sort = (opts.sort || "recent").toLowerCase();
    const wantPopular =
      sort === "popular" ||
      sort === "popular-today" ||
      sort === "popular-week" ||
      sort === "popular-month";

    // Popularité : /list?sort=popular|views (pas de pagination fiable).
    if (wantPopular && !query) {
      const sortParam = sort === "popular-today" ? "views" : "popular";
      const url = `${BASE}/list?sort=${sortParam}`;
      const html = await fetchHtml(url);
      return { cards: parseDoujinsListCards(html), hasMore: false };
    }

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
    const paywalled = html ? isDoujinsPaywalled(html) : false;
    const expectedPages = cached?.numPages || 0;

    // Sans abonnement Doujins ne sert qu'un aperçu (1 vignette) alors que
    // objects_count peut afficher 20–50+ pages sur la carte.
    if (paywalled && expectedPages > pageUrls.length) {
      throw new Error(
        "Doujins: lecture réservée aux abonnés (aperçu uniquement). Ouvre le titre sur doujins.com ou choisis une autre source."
      );
    }
    if (!paywalled && expectedPages > 3 && pageUrls.length <= 1) {
      throw new Error(
        `Doujins: seulement ${pageUrls.length} page(s) extraite(s) sur ${expectedPages} attendues. Réessaie ou change de source.`
      );
    }

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

  /**
   * Tags officiels de la page /tags (~36, avec id natif). La liste complète
   * affichée par l'app y ajoute le cumul local des tags observés dans les
   * listings (voir sourceTaxonomyStore.mergeDoujins).
   */
  async getTags(): Promise<SourceTaxonomyItem[]> {
    const html = await fetchHtml(`${BASE}/tags`);
    const tags = parseDoujinsTagsPage(html);
    if (tags.length === 0) throw new Error("Doujins /tags: aucun tag parsé");
    return tags;
  }

  async healthCheck() {
    return probeAdapterHealth(this);
  }
}

function splitNative(globalId: string): string {
  return globalId.split(":")[1] ?? "";
}

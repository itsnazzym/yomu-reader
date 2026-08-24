/**
 * Adaptateur hitomi.la — URLs images fraîches via gg.js (jamais persistées).
 *
 * Listing    : ltn…/index-{lang}.nozomi (IDs uint32 BE, Range HTTP)
 * Métadonnées : ltn…/galleries/{id}.js
 * Images CDN  : {w1|w2}.gold-usergeneratedcontent.net/{b}{s(hash)}/{hash}.webp
 */

import { Platform } from "react-native";
import { probeAdapterHealth } from "./probeHealth";
import {
  makeGlobalId,
  type SourceAdapter,
  type SourceGallery,
  type SourceGalleryCard,
  type SourceMeta,
  type SourceSearchOptions,
  type SourceTag,
} from "./types";

const SITE = "https://hitomi.la";
const LTN = "https://ltn.gold-usergeneratedcontent.net";
const CDN = "gold-usergeneratedcontent.net";
const TIMEOUT_MS = 12000;
const GG_TTL_MS = 10 * 60 * 1000;

const HEADERS: Record<string, string> = {
  "User-Agent":
    Platform.OS === "android"
      ? "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36"
      : "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  Referer: `${SITE}/`,
  Accept: "*/*",
};

interface GgTable {
  /** g → m(g) ; true = cases où m retourne 0 */
  zeroSet: Set<number>;
  b: string;
  fetchedAt: number;
}

interface HitomiFile {
  hash: string;
  name?: string;
  width?: number;
  height?: number;
  haswebp?: number;
  hasavif?: number;
}

interface GalleryInfo {
  id: string;
  title?: string;
  japanese_title?: string | null;
  language?: string;
  files?: HitomiFile[];
  artists?: { artist?: string }[];
  tags?: { tag?: string; female?: string; male?: string }[];
  date?: string;
}

let ggCache: GgTable | null = null;

async function fetchText(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: HEADERS,
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`Hitomi HTTP ${res.status} sur ${url}`);
    }
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

/** Fetch binaire (nozomi) avec Range optionnel — Hitomi pagine en 25 IDs × 4 octets. */
async function fetchBinary(
  url: string,
  range?: { start: number; end: number }
): Promise<{ buffer: ArrayBuffer; totalBytes: number | null }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const headers: Record<string, string> = { ...HEADERS };
    if (range) {
      headers.Range = `bytes=${range.start}-${range.end}`;
    }
    const res = await fetch(url, {
      headers,
      signal: controller.signal,
    });
    if (!(res.ok || res.status === 206)) {
      throw new Error(`Hitomi HTTP ${res.status} sur ${url}`);
    }
    const buffer = await res.arrayBuffer();
    const contentRange = res.headers.get("content-range");
    const totalMatch = contentRange?.match(/\/(\d+)\s*$/);
    const totalBytes = totalMatch ? Number(totalMatch[1]) : null;
    return { buffer, totalBytes };
  } finally {
    clearTimeout(timer);
  }
}

/** Fichier nozomi = tableau d'IDs uint32 big-endian. */
export function parseNozomiIds(buffer: ArrayBuffer): string[] {
  const view = new DataView(buffer);
  const count = Math.floor(view.byteLength / 4);
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    ids.push(String(view.getUint32(i * 4, false)));
  }
  return ids;
}

const PAGE_SIZE = 25;

function nozomiFileForLanguage(
  language: string | undefined,
  sort?: string
): string {
  const lang = (language || "english").toLowerCase().trim();
  const sortKey = (sort || "recent").toLowerCase();
  const langSuffix = lang === "all" ? "english" : lang;

  // Fichiers popular/*-{lang}.nozomi (pas de index.nozomi pour "all").
  if (sortKey === "popular-today") {
    return `popular/today-${langSuffix}.nozomi`;
  }
  if (sortKey === "popular-week") {
    return `popular/week-${langSuffix}.nozomi`;
  }
  if (sortKey === "popular" || sortKey === "popular-month") {
    return `popular-${langSuffix}.nozomi`;
  }

  if (lang === "all") return "index-all.nozomi";
  return `index-${lang}.nozomi`;
}

function parseGg(js: string): GgTable {
  const zeroSet = new Set<number>();
  const caseRe = /case\s+(\d+)\s*:/g;
  let m: RegExpExecArray | null = caseRe.exec(js);
  while (m) {
    zeroSet.add(Number(m[1]));
    m = caseRe.exec(js);
  }
  const bMatch = js.match(/b:\s*'([^']+)'/);
  if (!bMatch?.[1]) {
    throw new Error("Hitomi gg.js: champ b introuvable");
  }
  return { zeroSet, b: bMatch[1], fetchedAt: Date.now() };
}

async function loadGg(force = false): Promise<GgTable> {
  if (
    !force &&
    ggCache &&
    Date.now() - ggCache.fetchedAt < GG_TTL_MS
  ) {
    return ggCache;
  }
  const js = await fetchText(`${LTN}/gg.js`);
  ggCache = parseGg(js);
  return ggCache;
}

function ggM(table: GgTable, g: number): number {
  return table.zeroSet.has(g) ? 0 : 1;
}

function ggS(hash: string): string {
  const m = /(..)(.)$/.exec(hash);
  if (!m?.[1] || !m[2]) {
    throw new Error(`Hitomi hash invalide: ${hash}`);
  }
  return parseInt(`${m[2]}${m[1]}`, 16).toString(10);
}

function imageUrl(table: GgTable, hash: string): string {
  const g = parseInt(hash.slice(-1) + hash.slice(-3, -1), 16);
  const subdomain = `w${1 + ggM(table, g)}`;
  return `https://${subdomain}.${CDN}/${table.b}${ggS(hash)}/${hash}.webp`;
}

/**
 * Miniature catalogue Hitomi (common.js url_from_url_from_hash base=tn).
 * Chemin real_full_path = last1/last2/hash ; sous-domaine atn|btn.
 */
export function thumbUrl(
  table: GgTable,
  hash: string,
  dir: "webpsmalltn" | "webpbigtn" = "webpsmalltn"
): string {
  const path = hash.replace(/^.*(..)(.)$/, `$2/$1/${hash}`);
  const g = parseInt(hash.slice(-1) + hash.slice(-3, -1), 16);
  const subdomain = `${String.fromCharCode(97 + ggM(table, g))}tn`;
  return `https://${subdomain}.${CDN}/${dir}/${path}.webp`;
}

function parseGalleryInfo(js: string): GalleryInfo {
  const jsonPart = js.replace(/^[^{]*/, "").trim();
  // galleries/{id}.js = `var galleryinfo = {...}`
  const start = js.indexOf("{");
  const end = js.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("Hitomi galleryinfo: JSON introuvable");
  }
  const parsed: unknown = JSON.parse(js.slice(start, end + 1));
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Hitomi galleryinfo: objet invalide");
  }
  void jsonPart;
  return parsed as GalleryInfo;
}

function tagsFromInfo(info: GalleryInfo): SourceTag[] {
  const tags: SourceTag[] = [];
  for (const a of info.artists || []) {
    if (a.artist) tags.push({ name: a.artist, type: "artist" });
  }
  for (const t of info.tags || []) {
    if (!t.tag) continue;
    let type = "tag";
    if (t.female === "1") type = "tag";
    if (t.male === "1") type = "tag";
    tags.push({ name: t.tag.replace(/_/g, " "), type });
  }
  if (info.language) {
    tags.push({ name: info.language, type: "language" });
  }
  return tags;
}

async function cardFromGalleryId(
  nativeId: string,
  gg: GgTable
): Promise<SourceGalleryCard | null> {
  try {
    const js = await fetchText(`${LTN}/galleries/${nativeId}.js`);
    const info = parseGalleryInfo(js);
    const hash = info.files?.[0]?.hash;
    const coverUrl = hash ? thumbUrl(gg, hash, "webpsmalltn") : "";
    let uploadDate: number | undefined;
    if (info.date) {
      const ts = Date.parse(info.date);
      if (Number.isFinite(ts)) uploadDate = Math.floor(ts / 1000);
    }
    return {
      globalId: makeGlobalId("hitomi", nativeId),
      title:
        info.title ||
        info.japanese_title ||
        `Hitomi #${nativeId}`,
      coverUrl,
      numPages: info.files?.length,
      uploadDate,
      tags: tagsFromInfo(info),
    };
  } catch (err) {
    console.warn(`[hitomi] gallery ${nativeId} skip:`, err);
    return null;
  }
}

export class HitomiSource implements SourceAdapter {
  meta: SourceMeta = {
    id: "hitomi",
    label: "Hitomi",
    baseUrl: SITE,
    accentColor: "#3d85c6",
    supportsLogin: false,
    supportsComments: false,
  };

  async search(opts: SourceSearchOptions): Promise<{
    cards: SourceGalleryCard[];
    hasMore: boolean;
  }> {
    const page = Math.max(1, opts.page || 1);
    // Les pages HTML Hitomi sont des coques JS (pas de galleryblock SSR).
    // Listing = fichier nozomi (IDs) + galleries/{id}.js (titre / cover).
    const nozomiName = nozomiFileForLanguage(opts.language, opts.sort);
    const nozomiUrl = `${LTN}/${nozomiName}`;
    const start = (page - 1) * PAGE_SIZE * 4;
    const end = start + PAGE_SIZE * 4 - 1;

    const [{ buffer, totalBytes }, gg] = await Promise.all([
      fetchBinary(nozomiUrl, { start, end }),
      loadGg(),
    ]);
    const ids = parseNozomiIds(buffer);
    if (ids.length === 0) {
      return { cards: [], hasMore: false };
    }

    const settled = await Promise.all(
      ids.map((id) => cardFromGalleryId(id, gg))
    );
    const cards = settled.filter(
      (card): card is SourceGalleryCard => card !== null
    );

    const totalIds =
      totalBytes !== null && Number.isFinite(totalBytes)
        ? Math.floor(totalBytes / 4)
        : null;
    const hasMore =
      totalIds !== null
        ? page * PAGE_SIZE < totalIds
        : ids.length >= PAGE_SIZE;

    return { cards, hasMore };
  }

  async getGallery(nativeId: string): Promise<SourceGallery> {
    const [gg, js] = await Promise.all([
      loadGg(),
      fetchText(`${LTN}/galleries/${nativeId}.js`),
    ]);
    const info = parseGalleryInfo(js);
    const files = info.files || [];
    if (files.length === 0) {
      throw new Error(`Hitomi: galerie ${nativeId} sans pages`);
    }
    const pageUrls = files.map((f) => {
      if (!f.hash) {
        throw new Error(`Hitomi: fichier sans hash (${nativeId})`);
      }
      return {
        url: imageUrl(gg, f.hash),
        width: f.width,
        height: f.height,
      };
    });
    const title =
      info.title ||
      info.japanese_title ||
      `Hitomi #${nativeId}`;
    let uploadDate: number | undefined;
    if (info.date) {
      const ts = Date.parse(info.date);
      if (Number.isFinite(ts)) uploadDate = Math.floor(ts / 1000);
    }
    return {
      globalId: makeGlobalId("hitomi", nativeId),
      nativeId,
      title,
      coverUrl: files[0]?.hash
        ? thumbUrl(gg, files[0].hash, "webpbigtn")
        : pageUrls[0]?.url || "",
      numPages: pageUrls.length,
      uploadDate,
      tags: tagsFromInfo(info),
      pageUrls,
    };
  }

  async healthCheck() {
    try {
      await loadGg(true);
      return probeAdapterHealth(this, { timeoutMs: 10000, query: "" });
    } catch (err) {
      return {
        ok: false,
        latencyMs: 0,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}

/**
 * Adaptateur doujins.com (scraping HTML, pas d'API publique).
 *
 * Structure cartographiée le 2026-08-23 :
 * - Listing  : /list?sort=newest (pagination par bouton "Load more" avec
 *              data-ts=<timestamp> → /list?sort=newest&ts=<ts>)
 * - Recherche: /list?search=<q>&sort=newest
 * - Carte    : <a href="/<series-slug>/<gallery-slug>-<id>" class="">
 *                <img src="https://static.doujins.com/f2-<hash>.jpg?st=..&e=..">
 *                <div class="title"><div class="text">Titre</div></div></a>
 * - Galerie  : /<series>/<slug>-<id> — toutes les pages sont dans la page,
 *              en data-src signées (?st=..&e=<expiry>) sur static.doujins.com
 *              (pattern n-<hash>.jpg). Les signatures EXPIRENT : toujours
 *              re-scraping avant lecture, jamais de cache long.
 * - Tags     : bloc "fa-tags" → <a href="/searches?tag_id=N">Nom</a>
 * - Artiste  : div.gallery-artist → <a href=/artists/slug>Nom</a>
 */

import { Platform } from "react-native";
import { extractMatches, stripTags, decodeEntities } from "./html";
import {
  makeGlobalId,
  type SourceAdapter,
  type SourceGallery,
  type SourceGalleryCard,
  type SourceMeta,
  type SourceSearchOptions,
} from "./types";

const BASE = "https://doujins.com";
const TIMEOUT_MS = 12000;

const HEADERS: Record<string, string> = {
  "User-Agent":
    Platform.OS === "android"
      ? "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36"
      : "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
};

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

/** GET JSON (endpoint interne /folders). */
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

/** Item du endpoint /folders?start&end (listing mensuel JSON). */
interface FolderItem {
  id: number;
  name: string;
  link?: string;
  thumbnail?: string;
  thumbnail2?: string;
  objects_count?: number;
  date?: number;
  artists?: string[];
  free?: number;
  hidden?: number;
  private?: number;
}

/** Carte du listing : href relative (/series/slug-id), cover signée, titre. */
const CARD_RE =
  /<a href="(\/[a-z0-9-]+\/[a-z0-9-]+-(\d+))"[^>]*>\s*<img src="([^"]+)"[\s\S]*?<div class="text">([\s\S]*?)<\/div>/g;

/** Extrait l'id natif depuis un chemin "/series/gallery-slug-12345". */
function nativeIdFromPath(path: string): string | null {
  const m = path.match(/-(\d+)$/);
  return m ? m[1] : null;
}

function parseCards(html: string): SourceGalleryCard[] {
  const seen = new Set<string>();
  const cards: SourceGalleryCard[] = [];
  for (const m of extractMatches(html, CARD_RE)) {
    const nativeId = m[2];
    if (!nativeId || seen.has(nativeId)) continue;
    seen.add(nativeId);
    cards.push({
      globalId: makeGlobalId("doujins", nativeId),
      title: decodeEntities(m[4]),
      // Les covers de listing sont signées mais à longue durée ; on les garde telles quelles.
      coverUrl: decodeEntities(m[3]),
    });
  }
  return cards;
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
    // Recherche texte : listing HTML filtré par le serveur.
    if (opts.query) {
      const url = `${BASE}/list?search=${encodeURIComponent(opts.query)}&sort=newest`;
      const html = await fetchHtml(url);
      return { cards: parseCards(html), hasMore: false };
    }

    // Listing sans requête : endpoint JSON interne du site (celui que le
    // bouton "Load more months" appelle). Une requête = un mois complet
    // (~100-190 galeries) avec titre, slug, thumbnail et date propres.
    const now = new Date();
    let back = Math.max(0, (opts.page || 1) - 1);
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1));
    const startSec = Math.floor(d.getTime() / 1000);
    const endSec = Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) / 1000);

    const j = await fetchJson<{ premium?: FolderItem[] }>(
      `${BASE}/folders?start=${startSec}&end=${endSec}`
    );
    const items = (j.premium || []).filter(
      (x) => x.link && !x.hidden && !x.private && !x.free
    );
    const cards: SourceGalleryCard[] = items.map((it) => ({
      globalId: makeGlobalId("doujins", String(it.id)),
      nativeId: String(it.id),
      title: decodeEntities(it.name || `Doujins #${it.id}`),
      coverUrl: decodeEntities(it.thumbnail2 || it.thumbnail || ""),
      uploadDate: it.date ? it.date * 1000 : undefined,
      numPages: it.objects_count || undefined,
      tags: (it.artists || []).map((a) => ({ name: a, type: "artist" })),
    })) as unknown as SourceGalleryCard[];
    return { cards, hasMore: true }; // mois précédents disponibles
  }

  async getGallery(nativeId: string, knownTitle?: string): Promise<SourceGallery> {
    // L'URL de galerie exige le slug complet /series/slug-<id>. Résolution :
    // recherche par titre (rapide) puis fallback listings récents.
    const html = await this.fetchGalleryHtml(nativeId, knownTitle);

    const titleM =
      html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) ||
      // Fallback : <title> "Série - Titre by Artiste"
      html.match(/<title>[^<]*?-\s*([^<]+?)\s+by\s+[^<]+<\/title>/) ||
      html.match(/<title>([^<]+)<\/title>/);
    const title = titleM ? stripTags(titleM[1]) : `Doujins #${nativeId}`;

    // Pages : le lecteur embarque TOUTES les pages dans le HTML initial en
    // <img class="doujin" data-file="https://static.doujins.com/n-<hash>.jpg
    // ?st=..&e=<expiry>"> (aucune pagination AJAX). Signatures EXPIRENT :
    // toujours re-scraping avant lecture, jamais de cache long.
    const pageUrlsRaw = extractMatches(
      html,
      /<img\s+class="doujin[^"]*"[\s\S]*?data-file="(https:\/\/static\.doujins\.com\/[^"]+)"/g
    )
      .map((m) => decodeEntities(m[1]))
      .filter((u) => !u.includes("/f2-")); // f2-* = thumbnails de listing

    if (pageUrlsRaw.length === 0) {
      throw new Error(`Doujins: aucune page trouvée pour ${nativeId}`);
    }

    // Couverture : première image du lecteur (signée).
    const coverUrl = pageUrlsRaw[0];

    // Tags : bloc "fa-tags". Tolérant aux retours ligne CRLF du HTML réel :
    // <li class="tag-area"><div><i class="fa fa-tags"></i> Tag</div><hr />
    //   <a href="/searches?tag_id=N" ...>Nom</a> ... </li>
    const tagsBlockM = html.match(
      /fa-tags[\s\S]*?Tag<\/div>\s*<hr\s*\/?>\s*([\s\S]*?)<\/li>/
    );
    const tags: { name: string; type?: string }[] = [];
    if (tagsBlockM) {
      for (const t of extractMatches(tagsBlockM[1], /<a href="[^"]*"[^>]*>([^<]+)<\/a>/g)) {
        const name = stripTags(t[1]);
        if (name) tags.push({ name, type: "tag" });
      }
    }
    // Artistes.
    const artistBlock = html.match(/gallery-artist"\s*>([\s\S]*?)<\/div>/);
    if (artistBlock) {
      for (const a of extractMatches(artistBlock[1], /<a href=\/artists\/[^>]*>([^<]+)<\/a>/g)) {
        tags.push({ name: stripTags(a[1]), type: "artist" });
      }
    }

    return {
      globalId: makeGlobalId("doujins", nativeId),
      nativeId,
      title,
      coverUrl,
      numPages: pageUrlsRaw.length,
      tags,
      pageUrls: pageUrlsRaw.map((url) => ({ url })),
    };
  }

  /**
   * Résout le HTML de la galerie depuis son id natif. Deux stratégies :
   * 1. Recherche par titre si connu (résolution rapide, ~1 req) — les
   *    favoris/historique stockent le titre.
   * 2. Fallback : scan des listings récents.
   */
  private async fetchGalleryHtml(nativeId: string, title?: string): Promise<string> {
    // 1. Résolution par titre via la recherche du site.
    if (title && title.length > 3) {
      try {
        const q = encodeURIComponent(title);
        const html = await fetchHtml(`${BASE}/searches?q=${q}`);
        const m = html.match(new RegExp(`href="(/[^"]*-${nativeId})"`));
        if (m) return await fetchHtml(`${BASE}${decodeEntities(m[1])}`);
      } catch {}
    }
    // 2. Fallback : listings récents.
    const candidates = [
      `${BASE}/list?sort=newest`,
      `${BASE}/list?sort=alphabetical`,
    ];
    for (const url of candidates) {
      try {
        const list = await fetchHtml(url);
        const anchorM = list.match(new RegExp(`href="([^\"]*-${nativeId})"`));
        if (anchorM) {
          return await fetchHtml(`${BASE}${decodeEntities(anchorM[1])}`);
        }
      } catch {}
    }
    throw new Error(
      `Doujins: galerie ${nativeId} introuvable (titre inconnu et absente des listings)`
    );
  }

  async getRandomNativeId(): Promise<string> {
    const html = await fetchHtml(`${BASE}/list?sort=random`);
    const cards = parseCards(html);
    if (cards.length === 0) throw new Error("Doujins random: liste vide");
    return splitNative(cards[Math.floor(Math.random() * cards.length)].globalId);
  }
}

function splitNative(globalId: string): string {
  return globalId.split(":")[1] ?? "";
}

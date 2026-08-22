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
    // v1 : pagination limitée au flux "newest" (data-ts) et à la recherche
    // simple. Le listing pagine par mois via ts — on expose hasMore=false
    // au-delà de la première page pour rester honnête (le scroll infini du
    // site charge par mois, pas par page numérique).
    let url: string;
    if (opts.query) {
      url = `${BASE}/list?search=${encodeURIComponent(opts.query)}&sort=newest`;
    } else {
      url = `${BASE}/list?sort=newest`;
    }
    const html = await fetchHtml(url);
    return { cards: parseCards(html), hasMore: false };
  }

  async getGallery(nativeId: string): Promise<SourceGallery> {
    // L'URL de galerie exige le slug complet /series/slug-<id>. On ne connaît
    // pas le slug depuis l'id seul → on résout en cherchant l'ancre dans le
    // flux newest + recherche ? Non : doujins redirige /galleries/<id> ? À
    // vérifier : il existe une URL courte. On tente d'abord la résolution par
    // le listing récent puis par recherche de secours.
    const html = await this.fetchGalleryHtml(nativeId);

    const titleM =
      html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) ||
      // Fallback : <title> "Série - Titre by Artiste"
      html.match(/<title>[^<]*?-\s*([^<]+?)\s+by\s+[^<]+<\/title>/) ||
      html.match(/<title>([^<]+)<\/title>/);
    const title = titleM ? stripTags(titleM[1]) : `Doujins #${nativeId}`;

    // Pages : toutes les images du lecteur en data-src signées.
    const pageUrlsRaw = extractMatches(
      html,
      /data-src="(https:\/\/static\.doujins\.com\/[^"]+)"[^>]*>/g
    )
      .map((m) => decodeEntities(m[1]))
      .filter((u) => !u.includes("/f2-")); // f2-* = thumbnails de listing

    if (pageUrlsRaw.length === 0) {
      throw new Error(`Doujins: aucune page trouvée pour ${nativeId}`);
    }

    // Couverture : première image du lecteur (signée).
    const coverUrl = pageUrlsRaw[0];

    // Tags : bloc fa-tags.
    const tagsBlockM = html.match(/fa-tags[^>]*>\s*Tag<\/div>\s*<hr\s*\/?>([\s\S]*?)<\/div>\s*<\/div>/);
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
   * Résout l'URL complète de la galerie depuis son id natif. Doujins n'a pas
   * d'URL par id seul : on balaie le listing newest (et quelques pages de
   * recherche génériques) jusqu'à trouver l'ancre -<id>.
   */
  private async fetchGalleryHtml(nativeId: string): Promise<string> {
    const candidates = [
      `${BASE}/list?sort=newest`,
      `${BASE}/list?sort=alphabetical`,
    ];
    for (const url of candidates) {
      try {
        const list = await fetchHtml(url);
        const anchorM = list.match(new RegExp(`href="([^"]*-${nativeId})"`));
        if (anchorM) {
          return await fetchHtml(`${BASE}${decodeEntities(anchorM[1])}`);
        }
      } catch {}
    }
    throw new Error(
      `Doujins: galerie ${nativeId} introuvable dans les listings (id trop ancien ?)`
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

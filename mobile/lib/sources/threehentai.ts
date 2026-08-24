/**
 * Adaptateur fr.3hentai.net (3Hentai FR).
 *
 * Structure HTML server-rendered (cartographiée le 2026-08-23) :
 * - Listing  : /language/french/<page>   | recherche : /search?q=<query>
 * - Carte    : <a href="https://fr.3hentai.net/d/<id>" class="cover">
 *                <img data-src="https://s1.3hentai.xyz/d<mediaId>/thumb.jpg">
 *                <div class="title ...">Titre</div></a>
 * - Galerie  : /d/<id> — titre en <h1>, tags dans .tag-container.field-name,
 *              thumbnails /d<mediaId>/<n>t.jpg, date en <time datetime=...>
 * - Pages    : /d/<id>/<n> → <img src="https://sN.3hentai.xyz/d<mediaId>/<n>.jpg"
 *              class="js-main-img">. Le pattern d'URL est prévisible :
 *              on construit directement depuis mediaId + numPages sans
 *              re-scraping par page.
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
  type SourceTaxonomyItem,
} from "./types";

const BASE = "https://fr.3hentai.net";
const TIMEOUT_MS = 12000;

const HEADERS: Record<string, string> = {
  "User-Agent":
    Platform.OS === "android"
      ? "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36"
      : "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.7",
};

async function fetchHtml(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: HEADERS,
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`3Hentai HTTP ${res.status} sur ${url}`);
    }
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

/** Carte d'un listing : href, mediaId (cover), titre. */
const CARD_RE =
  /<a href="https?:\/\/(?:fr\.)?3hentai\.net\/d\/(\d+)"[^>]*class="cover"[^>]*>\s*<img[^>]*data-src="([^"]+)"[\s\S]*?<div class="title[^"]*">\s*([\s\S]*?)\s*<\/div>/g;

/** Bloc tag de la page galerie : libellé de section + liens. */
const TAG_BLOCK_RE =
  /tag-container field-name">\s*([A-Za-zÀ-ÿéèêàçûôî]+s? :)\s*<span class="filter-elem">([\s\S]*?)<\/span><\/div>/g;

/**
 * Item de la liste /tags?letter=<x> : nom + compteur réel (data-qty).
 * Les href sont absolus sur ce site, d'où le domaine dans le motif.
 */
const TAXONOMY_ITEM_RE =
  /<span class="filter-elem">\s*<a class="name" href="https?:\/\/(?:fr\.)?3hentai\.net\/tags\/([a-z0-9-]+)"[^>]*data-qty="(\d+)"[^>]*>([\s\S]*?)<\/a>\s*<\/span>/g;

const TAG_LINK_RE =
  /<a class="name" href="[^"]*(?:\/tags|\/series|\/artists|\/characters|\/groups|\/language|\/category)?[^"]*"[^>]*>\s*([\s\S]*?)\s*<\/a>/g;

function parseCards(html: string): SourceGalleryCard[] {
  return extractMatches(html, CARD_RE).map((m) => ({
    globalId: makeGlobalId("3hentai", m[1]),
    nativeId: m[1],
    title: decodeEntities(m[3]),
    coverUrl: m[2],
  })) as unknown as SourceGalleryCard[];
}

/** Section FR du label ("Tags :", "Artistes :"...) -> type normalisé. */
function sectionToType(label: string): string {
  const l = label.toLowerCase();
  if (l.startsWith("tags")) return "tag";
  if (l.startsWith("artist")) return "artist";
  if (l.startsWith("personnages") || l.startsWith("character")) return "character";
  if (l.startsWith("parodies") || l.startsWith("séries") || l.startsWith("series")) return "parody";
  if (l.startsWith("groupes") || l.startsWith("group")) return "group";
  if (l.startsWith("langues") || l.startsWith("language")) return "language";
  if (l.startsWith("catégories") || l.startsWith("categor")) return "category";
  return "tag";
}

function parseTags(galleryHtml: string): { name: string; type?: string }[] {
  const out: { name: string; type?: string }[] = [];
  for (const block of extractMatches(galleryHtml, TAG_BLOCK_RE)) {
    const type = sectionToType(stripTags(block[1]));
    for (const tagMatch of extractMatches(block[2], TAG_LINK_RE)) {
      const name = decodeEntities(tagMatch[1]);
      if (name && !out.some((t) => t.name === name)) {
        out.push({ name, type });
      }
    }
  }
  return out;
}

/** Parse une page /tags?letter=<x> : nom + compteur réel (data-qty). */
export function parseThreeHentaiTagsPage(html: string): SourceTaxonomyItem[] {
  const out: SourceTaxonomyItem[] = [];
  for (const m of extractMatches(html, TAXONOMY_ITEM_RE)) {
    const name = decodeEntities(m[3]).trim();
    if (!name) continue;
    out.push({ name, count: parseInt(m[2], 10) || 0 });
  }
  return out;
}

export class ThreeHentaiSource implements SourceAdapter {
  meta: SourceMeta = {
    id: "3hentai",
    label: "3Hentai FR",
    baseUrl: BASE,
    accentColor: "#f5b841",
    supportsLogin: false,
    supportsComments: false,
  };

  async search(opts: SourceSearchOptions): Promise<{
    cards: SourceGalleryCard[];
    hasMore: boolean;
  }> {
    const page = opts.page || 1;
    let url: string;
    if (opts.query) {
      url = `${BASE}/search?q=${encodeURIComponent(opts.query)}`;
      // La recherche pagine via ?page=N (visible sur les listings).
      url += `&page=${page}`;
    } else {
      url = `${BASE}/language/french`;
      if (page > 1) url += `/${page}`;
    }
    const html = await fetchHtml(url);
    const cards = parseCards(html);
    return { cards, hasMore: cards.length >= 20 };
  }

  async getGallery(nativeId: string): Promise<SourceGallery> {
    const html = await fetchHtml(`${BASE}/d/${nativeId}`);

    const titleM = html.match(/<h1 class="text-left font-weight-bold">([\s\S]*?)<\/h1>/);
    if (!titleM) {
      throw new Error(`3Hentai: galerie ${nativeId} introuvable ou format inattendu`);
    }
    // Le titre contient parfois un <span class="middle-title"> pour la suite.
    const title = stripTags(titleM[1]);

    const coverM = html.match(/<img[^>]*data-src="(https:\/\/s[0-9]+\.3hentai\.xyz\/d(\d+)\/cover\.jpg)"/);
    const mediaDir = coverM ? `d${coverM[2]}` : null;
    if (!mediaDir) {
      throw new Error(`3Hentai: couverture/mediaId introuvable pour ${nativeId}`);
    }

    // Nombre de pages : dernier lien de pagination /d/<id>/<n> du bloc thumbnails.
    const pageLinks = extractMatches(
      html,
      /href="https?:\/\/(?:fr\.)?3hentai\.net\/d\/\d+\/(\d+)"[^>]*rel="nofollow"/g
    );
    const numPages = pageLinks.reduce((max, p) => Math.max(max, parseInt(p[1], 10)), 0);

    const dateM = html.match(/<time datetime="([^"]+)"/);
    const uploadDate = dateM ? Date.parse(dateM[1]) || undefined : undefined;

    // CDN observé : s1.3hentai.xyz (on réutilise celui de la couverture).
    const cdn = coverM[1].match(/https:\/\/(s[0-9]+\.3hentai\.xyz)/)?.[1] || "s1.3hentai.xyz";

    const extForFirst = await this.probeFirstPageExtension(cdn, mediaDir);

    const pageUrls = Array.from({ length: numPages }, (_, i) => ({
      url:
        i === 0
          ? `https://${cdn}/${mediaDir}/1${extForFirst}`
          : `https://${cdn}/${mediaDir}/${i + 1}.jpg`,
    }));

    return {
      globalId: makeGlobalId("3hentai", nativeId),
      nativeId,
      title,
      coverUrl: `https://${cdn}/${mediaDir}/cover.jpg`,
      numPages,
      uploadDate,
      tags: parseTags(html),
      pageUrls,
    };
  }

  /**
   * Certaines pages peuvent être en .png/.webp ; on sonde la première page
   * pour connaître l'extension réelle et on l'applique à toute la galerie
   * (les galeries 3Hentai sont homogènes). Économique : une requête HEAD.
   */
  private async probeFirstPageExtension(cdn: string, mediaDir: string): Promise<string> {
    for (const ext of [".jpg", ".png", ".webp", ".gif"]) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 6000);
        const res = await fetch(`https://${cdn}/${mediaDir}/1${ext}`, {
          method: "HEAD",
          headers: HEADERS,
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (res.ok) return ext;
      } catch {}
    }
    return ".jpg"; // défaut le plus courant
  }

  async getRandomNativeId(): Promise<string> {
    // /random redirige vers https://3hentai.net/random puis vers /d/<id> :
    // on suit toute la chaîne de redirections (redirect: "follow") et on
    // lit l'id dans l'URL finale.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(`${BASE}/random`, {
        headers: HEADERS,
        redirect: "follow",
        signal: controller.signal,
      });
      const m = res.url.match(/\/d\/(\d+)/);
      if (m) return m[1];
      throw new Error("3Hentai random: URL finale sans id (" + res.url + ")");
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Liste réelle des tags du site : une requête par lettre (#, a…z), en lots
   * parallèles. Chaque item porte son compteur (data-qty). Une lettre en
   * échec est ignorée : le reste de la liste reste exploitable.
   */
  async getTags(): Promise<SourceTaxonomyItem[]> {
    const letters = ["%23", ..."abcdefghijklmnopqrstuvwxyz"];
    const results: SourceTaxonomyItem[] = [];
    const BATCH = 6;
    for (let i = 0; i < letters.length; i += BATCH) {
      const batch = letters.slice(i, i + BATCH);
      const settled = await Promise.allSettled(
        batch.map((l) => fetchHtml(`${BASE}/tags?letter=${l}`))
      );
      for (const outcome of settled) {
        if (outcome.status !== "fulfilled") continue;
        results.push(...parseThreeHentaiTagsPage(outcome.value));
      }
    }
    return results;
  }
}

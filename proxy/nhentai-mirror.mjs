#!/usr/bin/env node
/**
 * nhentai-mirror.mjs — Passerelle locale vers des miroirs nhentai.
 *
 * nhentai.net étant injoignable depuis certains réseaux (blocage SSL/TLS),
 * ce proxy scrape l'HTML server-rendered de miroirs complets et expose une
 * API JSON au format nhentai (v1/v2) que l'app mobile sait consommer.
 *
 * Bascule automatique : les miroirs sont essayés dans l'ordre ; en cas
 * d'échec (réseau, HTTP 429/5xx, page shell JS ou challenge Cloudflare),
 * le miroir est mis en quarantaine temporaire et le suivant est utilisé.
 * Affinité de miroir : un miroir qui vient de réussir reste préféré tant
 * qu'il est sain - pas de va-et-vient entre les miroirs (leurs IDs
 * diffèrent, la navigation doit rester sur un seul).
 *
 * Sécurité : /img n'accepte que les CDN d'images des miroirs (allowlist),
 * résolus exclusivement vers des adresses IP publiques (anti-SSRF et
 * anti-DNS-rebinding), et le cache d'images est un LRU borné (256 Mo).
 *
 * Endpoints :
 *   GET /api/galleries/search?query=&page=&sort=
 *   GET /api/galleries/all?page=&sort=
 *   GET /api/gallery/{id}
 *   GET /api/gallery/{id}/comments   -> []
 *   GET /random/                     -> { id }
 *   GET /api/favorites?page=         -> favoris (X-Refresh-Token | X-Api-Key | X-Sessionid)
 *   GET/POST /api/keys               -> lister / créer une clé API (X-Refresh-Token ou X-Access-Token)
 *   DELETE /api/keys/{id}            -> supprimer une clé API
 *   GET /img?u=<url>                 -> pass-through d'image (cache)
 *   GET /healthz
 *
 * Lancement : npm run proxy  (ou : node proxy/nhentai-mirror.mjs)
 * Adresse : 127.0.0.1:8787 par défaut. PROXY_HOST=0.0.0.0 active
 * explicitement l'accès LAN ; PROXY_PORT surcharge le port.
 * CORS : origines locales de l'app uniquement, remplaçables via
 * PROXY_CORS_ORIGINS (liste séparée par des virgules).
 */

import http from "node:http";
import dns from "node:dns/promises";
import net from "node:net";
import { createHash } from "node:crypto";
import * as cheerio from "cheerio";

function readBoundedIntegerEnv(name, fallback, min, max) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new Error(`${name} doit être un entier entre ${min} et ${max}`);
  }
  return value;
}

const PORT = readBoundedIntegerEnv("PROXY_PORT", 8787, 1, 65_535);
const HOST = String(process.env.PROXY_HOST || "127.0.0.1").trim() || "127.0.0.1";
const DEFAULT_CORS_ORIGINS = [
  "http://localhost:1420",
  "http://127.0.0.1:1420",
  "http://localhost:8081",
  "http://127.0.0.1:8081",
  "tauri://localhost",
  "http://tauri.localhost",
  "https://tauri.localhost",
];
const configuredCorsOrigins = String(process.env.PROXY_CORS_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean);
const ALLOWED_CORS_ORIGINS = new Set(
  configuredCorsOrigins.length ? configuredCorsOrigins : DEFAULT_CORS_ORIGINS
);

const HTML_CACHE_MAX_ENTRIES = 300;
const REQUEST_BODY_MAX_BYTES = 1_000_000;
const IMAGE_RESPONSE_MAX_BYTES = readBoundedIntegerEnv(
  "PROXY_IMAGE_MAX_BYTES",
  25 * 1024 * 1024,
  1,
  256 * 1024 * 1024
);
const POW_MAX_CONCURRENCY = readBoundedIntegerEnv(
  "PROXY_POW_CONCURRENCY",
  2,
  1,
  4
);
const POW_MAX_ITERATIONS = 20_000_000;
const POW_MAX_RUNTIME_MS = 30_000;
const POW_CHUNK_ITERATIONS = 2_000;

function publicError(status, message, extra = {}) {
  return Object.assign(new Error(message), { status, expose: true, ...extra });
}

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

// ---------------------------------------------------------------------------
// Miroirs & santé
// ---------------------------------------------------------------------------

const MIRRORS = [
  {
    base: "https://nhentai.to",
    searchPath: (term, page) => `/search?q=${term}&page=${page}`,
    popularPath: (page) => `/popular/?page=${page}`,
    galleryPath: (id) => `/g/${id}/`,
    randomPath: () => "/random/",
    // Marqueurs de contenu server-rendered (pour détecter les shells JS / blocages)
    listMarkers: ['class="gallery"'],
    galleryMarkers: ["thumbnail-container", 'class="thumb"', 'id="info"'],
    // nhentai.to n'expose pas le compte de pages dans un input caché
    pagesInput: null,
  },
  {
    base: "https://nhentai.xxx",
    searchPath: (term, page) => `/search?q=${term}&page=${page}`,
    // Pas de /popular/ server-rendered sur nhentai.xxx -> repli sur la recherche
    popularPath: null,
    galleryPath: (id) => `/g/${id}/`,
    randomPath: () => "/random/",
    listMarkers: ["gallery_item"],
    galleryMarkers: ['id="load_pages"', "tag_btn"],
    pagesInput: "load_pages",
  },
];

// Hôtes CDN d'images des miroirs (réécrits vers /img, qui fonctionne aussi
// quand l'émulateur ne peut pas les joindre directement). Cette liste sert
// aussi d'ALLOWLIST stricte pour /img (anti-SSRF) : seul un hôte égal à un
// suffixe, ou sous-domaine exact de celui-ci, est joignable.
const IMAGE_HOST_SUFFIXES = ["zrocdn.xyz", "nhentaimg.com"];

// Santé : quarantaine temporaire après échec, avec backoff.
const mirrorHealth = new Map(); // base -> { fails, until }
const COOLDOWN_BASE_MS = 30_000;
const COOLDOWN_MAX_MS = 120_000;

function isMirrorDown(base) {
  const h = mirrorHealth.get(base);
  return !!h && Date.now() < h.until;
}
function markMirrorDown(base, reason) {
  const h = mirrorHealth.get(base) || { fails: 0, until: 0 };
  h.fails += 1;
  h.until = Date.now() + Math.min(COOLDOWN_BASE_MS * h.fails, COOLDOWN_MAX_MS);
  mirrorHealth.set(base, h);
  console.warn(`[proxy] ${base} indisponible (${reason}) — quarantaine ${Math.round((h.until - Date.now()) / 1000)}s`);
}
function markMirrorUp(base) {
  if (mirrorHealth.delete(base)) {
    console.log(`[proxy] ${base} de nouveau opérationnel`);
  }
}

// Affinité de miroir : un miroir qui vient de servir une requête avec succès
// reste préféré tant qu'il est sain. Sans cela, chaque requête repartait du
// premier miroir et, après une quarantaine passagère, le trafic basculerait
// en permanence entre les deux - or les IDs diffèrent entre miroirs et la
// navigation liste -> détail doit rester cohérente.
let preferredMirrorBase = null;

function candidateMirrors() {
  const healthy = MIRRORS.filter((m) => !isMirrorDown(m.base));
  const order = healthy.length ? healthy : [MIRRORS[0]]; // dernier recours
  if (preferredMirrorBase) {
    const i = order.findIndex((m) => m.base === preferredMirrorBase);
    if (i > 0) {
      const [pref] = order.splice(i, 1);
      order.unshift(pref);
    }
  }
  return order;
}

// ---------------------------------------------------------------------------
// Cache mémoire simple (TTL)
// ---------------------------------------------------------------------------
const cache = new Map();
function cacheGet(key) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < hit.ttl) {
    cache.delete(key);
    cache.set(key, hit);
    return hit.data;
  }
  if (hit) {
    cache.delete(key);
  }
  return null;
}
function cacheSet(key, data, ttlMs) {
  cache.delete(key);
  cache.set(key, { data, ts: Date.now(), ttl: ttlMs });
  const now = Date.now();
  for (const [cachedKey, value] of cache) {
    if (now - value.ts >= value.ttl) {
      cache.delete(cachedKey);
    }
  }
  while (cache.size > HTML_CACHE_MAX_ENTRIES) {
    cache.delete(cache.keys().next().value);
  }
}

// ---------------------------------------------------------------------------
// Récupération HTML avec timeout, User-Agent et validation
// ---------------------------------------------------------------------------
async function fetchHtml(url, { ttl = 0, validate = null } = {}) {
  const cached = ttl > 0 ? cacheGet(`html:${url}`) : null;
  if (cached) {
    if (validate && !validate(cached)) {
      throw new Error(`Réponse en cache inutilisable pour ${url}`);
    }
    return cached;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  let res;
  try {
    res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html,*/*" },
      redirect: "follow",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status} pour ${url}`);
    err.status = res.status;
    throw err;
  }
  const text = await res.text();
  if (validate && !validate(text)) {
    throw new Error(`Réponse inutilisable (shell JS / challenge) pour ${url}`);
  }
  if (ttl > 0) cacheSet(`html:${url}`, text, ttl);
  return text;
}

/** Détecte une page de challenge Cloudflare / coquille JS. */
function buildValidator(markers) {
  return (html) => {
    if (!html || html.length < 200) return false;
    const low = html.toLowerCase();
    // Vraies pages de challenge Cloudflare. Attention : "challenge-platform"
    // est injecté par Cloudflare sur TOUTES les pages (même valides), il ne
    // faut donc pas s'y fier seul.
    if (
      low.includes("just a moment") ||
      low.includes("verify you are human") ||
      low.includes("challenge-form") ||
      low.includes("cf_chl_opt") ||
      low.includes("challenge-running")
    ) {
      return false;
    }
    return markers.some((mk) => html.includes(mk));
  };
}

/** Page "introuvable" (miroir qui renvoie 200 avec un body 404). */
function looksLikeNotFound(html) {
  const low = (html || "").toLowerCase();
  return (
    low.includes("404") &&
    (low.includes("not found") ||
      low.includes("introuvable") ||
      low.includes("n'existe") ||
      low.includes("doesn"))
  );
}

/**
 * Scrape en essayant chaque miroir sain dans l'ordre.
 * La validation utilise les marqueurs du miroir courant (kind : "list" | "gallery").
 * Un 404 n'entraîne PAS de bascule : les IDs diffèrent entre miroirs,
 * renvoyer un autre contenu pour le même ID serait trompeur.
 */
async function scrapeWithFailover(buildUrl, { ttl = 0, kind = "list" } = {}) {
  const candidates = candidateMirrors();

  let lastErr = null;
  for (const mirror of candidates) {
    try {
      const url = buildUrl(mirror);
      const markers = kind === "gallery" ? mirror.galleryMarkers : mirror.listMarkers;
      const validate = markers.length ? buildValidator(markers) : null;
      const html = await fetchHtml(url, { ttl });
      if (validate && !validate(html)) {
        if (looksLikeNotFound(html)) {
          const err = new Error("Galerie introuvable");
          err.status = 404;
          throw err;
        }
        throw new Error(`Réponse inutilisable (shell JS / challenge) pour ${url}`);
      }
      markMirrorUp(mirror.base);
      if (mirror.base !== preferredMirrorBase) {
        console.log(
          `[proxy] affinité de miroir : ${preferredMirrorBase || "(aucun)"} -> ${mirror.base}`
        );
        preferredMirrorBase = mirror.base;
      }
      return { html, mirror };
    } catch (err) {
      lastErr = err;
      if (err.status === 404) throw err; // ne pas basculer sur 404
      markMirrorDown(mirror.base, err.message);
    }
  }
  throw lastErr || new Error("Tous les miroirs sont indisponibles");
}

// ---------------------------------------------------------------------------
// Parsing (commun aux deux miroirs)
// ---------------------------------------------------------------------------

/** Extrait le media_id d'une URL d'image nhentai.to (/galleries/{id}/...). */
function mediaIdFromImageUrl(url) {
  const m = String(url || "").match(/\/galleries\/(\d+)\//);
  return m ? m[1] : "";
}

function buildListGallery(card, $) {
  const link = $(card).find("a[href*='/g/']").first();
  const href = link.attr("href") || "";
  const id = parseInt((href.match(/\/g\/(\d+)\/?/) || [])[1] || "0", 10);
  const img = $(card).find("img").first();
  const cover = img.attr("data-src") || img.attr("src") || "";
  const title =
    $(card).find(".caption").first().text().trim() || img.attr("alt") || "";
  const media_id = mediaIdFromImageUrl(cover);

  const thumbnailUrl = String(cover)
    .replace(/cover\.(jpg|png|webp|gif)$/i, "thumb.$1")
    .replace(/thumb\.(jpg|png|webp|gif)$/i, "thumb.$1");

  return {
    id,
    media_id,
    title: { english: title, japanese: "", pretty: title },
    cover,
    images: {
      cover: { t: "w", w: 350, h: 500, url: cover },
      thumbnail: { t: "w", w: 250, h: 350, url: thumbnailUrl },
      pages: [],
    },
    tags: [],
    num_pages: 0,
    num_favorites: 0,
    upload_date: 0,
  };
}

/** Parse une page de liste (recherche / popular). */
async function parseListPage(html) {
  const $ = cheerio.load(html);
  const result = [];
  $(".gallery, .gallery_item").each((_, card) => {
    const g = buildListGallery(card, $);
    if (g.id) result.push(g);
  });

  // Nombre de pages depuis la pagination (?page=N / &page=N / /page/N)
  let numPages = 1;
  $("a").each((_, a) => {
    const m = ($(a).attr("href") || "").match(/[?&/]page=(\d+)/);
    if (m) numPages = Math.max(numPages, parseInt(m[1], 10));
  });

  return { result, num_pages: numPages, per_page: 25 };
}

function normalizeSearchSort(sort) {
  if (!sort || sort === "recent" || sort === "date") return "date";
  if (sort === "popular-all") return "popular";
  return sort;
}

/**
 * Recherche et navigation via l'API v2 officielle nHentai (avec toutes les taxonomies,
 * tags, langues, et pagination exacte jusqu'à 25 000+ pages).
 */
async function handleOfficialSearch(query, page, sort) {
  const q = (query || "").trim();
  const normalizedSort = normalizeSearchSort(sort);

  let endpoint;
  if (!q) {
    if (normalizedSort === "date") {
      endpoint = `https://nhentai.net/api/v2/galleries?page=${page}`;
    } else {
      endpoint = `https://nhentai.net/api/v2/search?query=*&page=${page}&sort=${encodeURIComponent(normalizedSort)}`;
    }
  } else {
    endpoint = `https://nhentai.net/api/v2/search?query=${encodeURIComponent(q)}&page=${page}&sort=${encodeURIComponent(normalizedSort)}`;
  }

  const cacheKey = `official-search:${q}:${page}:${normalizedSort}`;
  const cached = cacheGet(cacheKey);
  if (cached) return cached;

  const data = await apiFetchJson(endpoint, { timeoutMs: 8000 });
  const rawList = Array.isArray(data?.result) ? data.result : (Array.isArray(data?.galleries) ? data.galleries : []);
  if (rawList.length === 0 && !q) {
    throw new Error(`API officielle vide pour ${endpoint}`);
  }

  const result = rawList.map((g) => {
    const coverUrl = g.images?.cover?.url || (g.media_id ? `https://t3.nhentai.net/galleries/${g.media_id}/cover.jpg` : "");
    const thumbUrl = g.images?.thumbnail?.url || (g.media_id ? `https://t3.nhentai.net/galleries/${g.media_id}/thumb.jpg` : "");
    return {
      id: g.id,
      media_id: String(g.media_id || ""),
      title: g.title || { english: `Gallery #${g.id}`, japanese: "", pretty: `Gallery #${g.id}` },
      cover: coverUrl,
      images: {
        cover: { t: "j", w: 350, h: 500, url: coverUrl },
        thumbnail: { t: "j", w: 250, h: 350, url: thumbUrl },
        pages: g.images?.pages || [],
      },
      tags: g.tags || [],
      tag_ids: g.tag_ids || [],
      num_pages: g.num_pages || g.images?.pages?.length || 0,
      num_favorites: g.num_favorites || 0,
      upload_date: g.upload_date || 0,
    };
  });

  const parsed = {
    result,
    num_pages: Number(data?.num_pages || data?.total_pages || 1),
    per_page: Number(data?.per_page || 25),
  };
  cacheSet(cacheKey, parsed, 60 * 1000);
  return parsed;
}

/** Parse une page détail de galerie (structure commune aux deux miroirs). */
async function parseGalleryPage(html, id, mirror) {
  const $ = cheerio.load(html);

  // nhentai.xxx a un <h1> de modal ("Report gallery") avant le titre réel
  const title =
    $("h1").not("#report_modal_title").first().text().trim() || `Gallery #${id}`;

  // Couverture
  const cover =
    $("#cover img").first().attr("data-src") ||
    $("#cover img").first().attr("src") ||
    $("img[src*='zrocdn'], img[data-src*='zrocdn'], img[src*='nhentaimg'], img[data-src*='nhentaimg']")
      .first()
      .attr("src") ||
    $("img[src*='zrocdn'], img[data-src*='zrocdn'], img[src*='nhentaimg'], img[data-src*='nhentaimg']")
      .first()
      .attr("data-src") ||
    "";
  const media_id = mediaIdFromImageUrl(cover) || "";

  // Pages
  const pages = [];
  const countInput = mirror.pagesInput ? $(`#${mirror.pagesInput}`).attr("value") : null;

  if (countInput) {
    // nhentai.xxx : seules ~15 vignettes sont inline, mais le compte est connu.
    // Le dossier des pages est le même que celui de la couverture.
    const total = parseInt(countInput, 10) || 0;
    // Dossier des pages = hôte + 2 segments (ex: https://i3.nhentaimg.com/007/6bedcf5741/)
    const dirMatch = cover.match(/^(https?:\/\/[^/]+\/[^/]+\/[^/]+\/)/);
    const dir = dirMatch ? dirMatch[1] : "";
    const ext = (cover.match(/\.(jpg|png|webp|gif)$/i) || [])[1] || "jpg";
    for (let n = 1; n <= total; n++) {
      pages.push({
        t: "j",
        w: 850,
        h: 1200,
        url: `${dir}${n}.${ext}`,
        urlThumb: `${dir}${n}t.${ext}`,
      });
    }
  } else {
    // nhentai.to : toutes les vignettes sont dans #thumbnail-container
    $("#thumbnail-container img").each((_, imgEl) => {
      const thumb =
        $(imgEl).attr("data-src") ||
        $(imgEl).attr("src") ||
        $(imgEl).attr("data-lazy-src") ||
        "";
      if (!thumb) return;
      const full = thumb.replace(/\/\d+t\.(jpg|png|webp|gif)$/i, (m) =>
        m.replace(/t\.(jpg|png|webp|gif)$/i, ".$1")
      );
      pages.push({
        t: "j",
        w: 850,
        h: 1200,
        url: full,
        urlThumb: thumb,
      });
    });
  }

  // Tags (nhentai.to : .name/.count + id tag-N ; nhentai.xxx : .tag_name/.tag_count)
  const tags = [];
  $("a[href^='/tag/']").each((_, aEl) => {
    const el = $(aEl);
    const href = el.attr("href") || "";
    const idMatch = (el.attr("class") || "").match(/tag-(\d+)/);
    const name = el.find(".name, .tag_name").first().text().trim();
    if (!name) return;
    const countText = el.find(".count, .tag_count").first().text().trim();
    tags.push({
      id: idMatch ? parseInt(idMatch[1], 10) : 0,
      type: "tag",
      name,
      url: href,
      count: parseInt(String(countText).replace(/\D/g, "") || "0", 10),
    });
  });

  const thumb = String(cover).replace(/cover\.(jpg|png|webp|gif)$/i, "thumb.$1");
  return {
    id,
    media_id,
    title: { english: title, japanese: "", pretty: title },
    cover,
    images: {
      cover: { t: "w", w: 350, h: 500, url: cover },
      thumbnail: { t: "w", w: 250, h: 350, url: thumb },
      pages,
    },
    tags,
    num_pages: pages.length,
    num_favorites: 0,
    upload_date: 0,
  };
}

// ---------------------------------------------------------------------------
// Logique des routes
// ---------------------------------------------------------------------------

async function handleSearch(query, page, sort) {
  try {
    return await handleOfficialSearch(query, page, sort);
  } catch (err) {
    console.warn(`[proxy] API officielle indisponible pour "${query}" (tri: ${sort}) : ${err?.message}`);
  }

  const q = (query || "").trim();
  const term = q ? encodeURIComponent(q) : "*";
  const isPopular = !!sort && sort.startsWith("popular");

  const { html, mirror } = await scrapeWithFailover(
    (m) => (isPopular && m.popularPath ? m.popularPath(page) : m.searchPath(term, page)).replace(/^\//, `${m.base}/`),
    { ttl: 3 * 60 * 1000, kind: "list" }
  );
  let parsed = await parseListPage(html);

  // /popular/ peut être une coquille JS sur certains miroirs -> repli sur la recherche
  if (isPopular && parsed.result.length === 0) {
    const { html: html2, mirror: m2 } = await scrapeWithFailover(
      (m) => m.searchPath(term, page).replace(/^\//, `${m.base}/`),
      { ttl: 3 * 60 * 1000, kind: "list" }
    );
    parsed = await parseListPage(html2);
    console.log(`[proxy] /popular/ vide sur ${mirror.base} — repli sur la recherche`);
  }
  return parsed;
}

async function handleGallery(id) {
  const numId = parseInt(String(id), 10);
  if (!numId) throw new Error("ID de galerie invalide");

  const { html, mirror } = await scrapeWithFailover(
    (m) => m.galleryPath(numId).replace(/^\//, `${m.base}/`),
    { ttl: 10 * 60 * 1000, kind: "gallery" }
  );
  return parseGalleryPage(html, numId, mirror);
}

async function handleRandom() {
  const { html } = await scrapeWithFailover(
    (m) => m.randomPath().replace(/^\//, `${m.base}/`),
    { ttl: 0, kind: "gallery" }
  );
  const m = html.match(/\/g\/(\d+)\/?/);
  if (!m) throw new Error("Impossible de résoudre une galerie aléatoire");
  return { id: parseInt(m[1], 10) };
}

// ---------------------------------------------------------------------------
// Favoris du compte (synchro cloud) : nhentai.net lui-même, pas les miroirs
// (les clones n'hébergent pas les favoris du compte). L'auth moderne du site
// est par jeton (Authorization: `User <access_token>` ou `Key <api_key>`) ;
// le legacy sessionid (cookie) reste supporté. L'app passe son credential
// dans un header dédié : X-Refresh-Token, X-Api-Key ou X-Sessionid.
// ---------------------------------------------------------------------------

/** Échange un refresh_token contre un access_token (auth moderne du site). */
async function exchangeRefreshToken(refreshToken) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch("https://nhentai.net/api/v2/auth/refresh", {
      method: "POST",
      headers: {
        "User-Agent": UA,
        Accept: "application/json, text/plain, */*",
        "Content-Type": "application/json",
        Referer: "https://nhentai.net/",
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
      redirect: "follow",
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.access_token) {
      const err = new Error(data.error || `HTTP ${res.status} pour /api/v2/auth/refresh`);
      err.status = res.status || 401;
      throw err;
    }
    return data.access_token;
  } finally {
    clearTimeout(timer);
  }
}

/** Appelle l'API v2 des favoris avec l'auth choisie (header ou cookie).
 *  Remonte les infos de rate limit officielles (x-ratelimit-*, retry-after)
 *  pour que l'app puisse espacer ses pages en conséquence. */
async function fetchFavoritesApi(page, auth) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const headers = {
      "User-Agent": UA,
      Accept: "application/json, text/plain, */*",
      Referer: "https://nhentai.net/favorites/",
    };
    if (auth.type === "header") headers["Authorization"] = auth.value;
    else headers["Cookie"] = `sessionid=${auth.value}`;
    const res = await fetch(`https://nhentai.net/api/v2/favorites?page=${page}`, {
      headers,
      redirect: "follow",
      signal: controller.signal,
    });
    const rateLimit = {
      remaining: Number(res.headers.get("x-ratelimit-remaining") ?? -1),
      limit: Number(res.headers.get("x-ratelimit-limit") ?? -1),
      retryAfter: Number(res.headers.get("retry-after") ?? 0),
    };
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const err = new Error(body?.error ? `${body.error} (HTTP ${res.status})` : `HTTP ${res.status} pour /api/v2/favorites`);
      err.status = res.status;
      err.rateLimit = rateLimit;
      throw err;
    }
    const data = await res.json();
    return { data, rateLimit };
  } finally {
    clearTimeout(timer);
  }
}

/** Scrape la page HTML des favoris officiels (repli legacy, cookie seulement). */
async function fetchFavoritesHtml(page, sessionid) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  let html = "";
  try {
    const res = await fetch(`https://nhentai.net/favorites/?page=${page}`, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html,*/*",
        Referer: "https://nhentai.net/",
        Cookie: `sessionid=${sessionid}`,
      },
      redirect: "follow",
      signal: controller.signal,
    });
    html = await res.text();
    const landedOnLogin =
      !res.ok ||
      /nhentai\.net\/login/i.test(res.url || "") ||
      html.includes('name="password"') ||
      html.includes("Sign in");
    if (landedOnLogin) {
      const err = new Error("Session invalide : cookie de session refusé (redirigé vers la connexion)");
      err.status = 401;
      throw err;
    }
  } finally {
    clearTimeout(timer);
  }
  return html;
}

function mapFavoriteGalleries(data) {
  const raw = data.result || data.galleries || [];
  return {
    result: raw.map((g) => {
      const mediaId = String(g.media_id || "");
      // L'API v2 des favoris renvoie les titres en champs TOP-LEVEL
      // (english_title / japanese_title), PAS sous g.title — sans ça tout
      // s'affichait « Gallery #id ». Les tags arrivent en tag_ids numériques,
      // résolus en objets nommés côté app via /api/tags/ids (cache proxy).
      const englishTitle =
        g.english_title || g.title?.english || g.title?.pretty || `Gallery #${g.id}`;
      const thumbPath = g.thumbnail
        ? String(g.thumbnail).replace(/^\//, "")
        : mediaId
        ? `galleries/${mediaId}/thumb.webp`
        : "";
      const thumbUrl = thumbPath ? `https://t3.nhentai.net/${thumbPath}` : "";
      return {
        id: g.id,
        media_id: mediaId,
        title: {
          english: englishTitle,
          japanese: g.japanese_title || g.title?.japanese || "",
          pretty: englishTitle,
        },
        cover: thumbUrl,
        images: {
          cover: thumbUrl ? { t: "w", w: 350, h: 500, url: thumbUrl } : null,
          thumbnail: thumbUrl ? { t: "w", w: 250, h: 350, url: thumbUrl } : null,
          pages: [],
        },
        // tag_ids bruts (v2) — l'app les résout en tags nommés avant l'import.
        tag_ids: g.tag_ids || [],
        tags: g.tags || [],
        num_pages: g.num_pages || 0,
        num_favorites: g.num_favorites || 0,
        upload_date: g.upload_date || 0,
      };
    }),
    num_pages: data.num_pages || Math.max(1, Math.ceil((data.total || raw.length) / 25)),
  };
}

/**
 * Récupère les favoris du compte selon le type de credential fourni :
 *  - "refresh"   : échange refresh_token → access_token → Authorization: User
 *  - "apiKey"    : Authorization: Key <api_key>
 *  - "sessionid" : cookie legacy sessionid (avec repli scraping HTML)
 * Renvoie un objet { result, num_pages } au format des listes, prêt pour
 * proxyImageUrls. Une session invalide (401) remonte telle quelle : l'app
 * affiche un message guidant vers le bon credential.
 */
async function handleFavorites(page, credential, credentialType) {
  if (!credential) {
    const err = new Error("Credential manquant (header X-Refresh-Token, X-Api-Key ou X-Sessionid)");
    err.status = 401;
    throw err;
  }

  let auth;
  if (credentialType === "refresh") {
    const accessToken = await exchangeRefreshToken(credential);
    auth = { type: "header", value: `User ${accessToken}` };
  } else if (credentialType === "apiKey") {
    auth = { type: "header", value: `Key ${credential}` };
  } else {
    auth = { type: "cookie", value: credential };
  }

  // 1) API v2 officielle
  try {
    const { data, rateLimit } = await fetchFavoritesApi(page, auth);
    return { ...mapFavoriteGalleries(data), rateLimit };
  } catch (apiErr) {
    if (apiErr.status === 401) throw apiErr; // credential invalide : ne pas basculer
    // 2) Repli : page HTML des favoris (cookie seulement)
    if (credentialType === "sessionid") {
      const html = await fetchFavoritesHtml(page, credential);
      return await parseListPage(html);
    }
    throw apiErr;
  }
}

// ---------------------------------------------------------------------------
// Gestion des clés API du compte (écran mobile) : /api/v2/user/keys, auth
// User Token (refresh_token échangé via X-Refresh-Token, ou access_token via
// X-Access-Token). La création exige un PoW (GET /api/v2/pow) résolu ici.
// ---------------------------------------------------------------------------

let activePowJobs = 0;

/** Résout un challenge PoW sans monopoliser la boucle d'événements.
 * Le travail est découpé en tranches bornées et la concurrence globale est limitée. */
async function solvePow(challenge, difficulty) {
  const numericDifficulty = Number(difficulty);
  const challengeText = String(challenge || "");
  if (
    !Number.isFinite(numericDifficulty) ||
    numericDifficulty < 0 ||
    numericDifficulty > 256 ||
    !challengeText ||
    challengeText.length > 1024
  ) {
    throw publicError(502, "Challenge de sécurité distant invalide");
  }
  const need = Math.max(0, Math.ceil(numericDifficulty / 4));
  if (need === 0) return "";
  if (activePowJobs >= POW_MAX_CONCURRENCY) {
    throw publicError(429, "Trop de calculs de sécurité en cours", {
      retryAfter: 5,
    });
  }

  activePowJobs += 1;
  const prefix = "0".repeat(need);
  const deadline = Date.now() + POW_MAX_RUNTIME_MS;
  try {
    for (let nonce = 0; nonce < POW_MAX_ITERATIONS; nonce++) {
      const hash = createHash("sha256")
        .update(`${challengeText}${nonce}`)
        .digest("hex");
      if (hash.startsWith(prefix)) return String(nonce);
      if ((nonce + 1) % POW_CHUNK_ITERATIONS === 0) {
        if (Date.now() >= deadline) {
          throw publicError(429, "Calcul de sécurité expiré", {
            retryAfter: 10,
          });
        }
        await new Promise((resolve) => setImmediate(resolve));
      }
    }
  } finally {
    activePowJobs -= 1;
  }
  throw publicError(429, "Calcul de sécurité non résolu", {
    retryAfter: 10,
  });
}

/** Auth User Token à partir des headers de l'app. */
async function resolveUserAuth(req) {
  const refreshToken = (req.headers["x-refresh-token"] || "").trim();
  const accessToken = (req.headers["x-access-token"] || "").trim();
  const apiKey = (req.headers["x-api-key"] || "").trim();
  const sessionid = (req.headers["x-sessionid"] || "").trim();

  if (refreshToken) {
    const tok = await exchangeRefreshToken(refreshToken);
    return `User ${tok}`;
  }
  if (accessToken) return `User ${accessToken}`;
  if (apiKey) return `Key ${apiKey}`;
  if (sessionid) return `User ${sessionid}`;

  const err = new Error("Jeton utilisateur manquant (header X-Refresh-Token, X-Access-Token, X-Api-Key ou X-Sessionid)");
  err.status = 401;
  throw err;
}

/** Requête JSON vers l'API officielle avec timeout (auth optionnelle). */
async function apiFetchJson(url, { method = "GET", auth, body, timeoutMs = 20000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers = {
      "User-Agent": UA,
      Accept: "application/json, text/plain, */*",
      Referer: "https://nhentai.net/",
    };
    if (auth) headers["Authorization"] = auth;
    if (body) headers["Content-Type"] = "application/json";
    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      redirect: "follow",
      signal: controller.signal,
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const err = new Error(data?.error ? `${data.error} (HTTP ${res.status})` : `HTTP ${res.status} pour ${url}`);
      err.status = res.status;
      throw err;
    }
    if (res.status === 204) return null;
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/** GET /api/v2/user/keys -> liste des clés (ApiKeyListItem[]). */
async function listUserKeys(auth) {
  return apiFetchJson("https://nhentai.net/api/v2/user/keys", { auth });
}

/** POST /api/v2/user/keys avec PoW résolu -> { id, key, name } (clé complète, une seule fois). */
async function createUserKey(auth, name, purpose) {
  const pow = await apiFetchJson("https://nhentai.net/api/v2/pow?action=create_api_key");
  const nonce = pow?.difficulty > 0 ? await solvePow(pow.challenge, pow.difficulty) : "";
  return apiFetchJson("https://nhentai.net/api/v2/user/keys", {
    method: "POST",
    auth,
    body: {
      name,
      purpose: purpose || "",
      pow_challenge: pow?.challenge || "",
      pow_nonce: nonce,
      captcha_response: "",
    },
  });
}

/** DELETE /api/v2/user/keys/{id} -> { ok: true }. */
async function deleteUserKey(auth, keyId) {
  return apiFetchJson(`https://nhentai.net/api/v2/user/keys/${encodeURIComponent(keyId)}`, {
    method: "DELETE",
    auth,
  });
}

/** POST /api/v2/auth/login avec PoW résolu -> { success, refresh_token, access_token, username } */
async function loginNativeUser(username, password) {
  let pow;
  try {
    pow = await apiFetchJson("https://nhentai.net/api/v2/pow?action=login");
  } catch (err) {
    try {
      pow = await apiFetchJson("https://nhentai.net/api/v2/pow");
    } catch {}
  }
  const nonce = pow?.difficulty > 0 ? await solvePow(pow.challenge, pow.difficulty) : "";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch("https://nhentai.net/api/v2/auth/login", {
      method: "POST",
      headers: {
        "User-Agent": UA,
        Accept: "application/json, text/plain, */*",
        "Content-Type": "application/json",
        Referer: "https://nhentai.net/login/",
      },
      body: JSON.stringify({
        username,
        password,
        pow_challenge: pow?.challenge || "",
        pow_nonce: nonce,
        captcha_response: "",
      }),
      redirect: "follow",
      signal: controller.signal,
    });

    const rawCookies = typeof res.headers.getSetCookie === "function"
      ? res.headers.getSetCookie()
      : [res.headers.get("set-cookie") || ""];
    const allCookies = rawCookies.filter(Boolean).join("; ");
    let refreshTokenFromCookie = "";
    let sessionIdFromCookie = "";
    const rtMatch = allCookies.match(/refresh_token=([^;]+)/);
    if (rtMatch) refreshTokenFromCookie = decodeURIComponent(rtMatch[1]);
    const sidMatch = allCookies.match(/sessionid=([^;]+)/);
    if (sidMatch) sessionIdFromCookie = decodeURIComponent(sidMatch[1]);

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const errMsg = String(data?.error || data?.message || data?.details || "");
      const isCaptcha =
        res.status === 403 ||
        Boolean(data?.captcha_required) ||
        /captcha|turnstile|challenge|verification/i.test(errMsg);

      if (isCaptcha) {
        const err = new Error("Vérification de sécurité (Captcha) requise. Utilisez la fenêtre de sécurité.");
        err.status = 403;
        err.captchaRequired = true;
        throw err;
      }
      const err = new Error(errMsg || `Identifiants invalides (HTTP ${res.status})`);
      err.status = res.status || 401;
      throw err;
    }

    const refreshToken = data.refresh_token || refreshTokenFromCookie || sessionIdFromCookie;
    const accessToken = data.access_token || "";
    const user = data.user?.username || username;

    return {
      success: true,
      refresh_token: refreshToken,
      access_token: accessToken,
      username: user,
    };
  } finally {
    clearTimeout(timer);
  }
}

/** GET /api/v2/user/me -> Profil complet (username, avatar, email...) */
async function fetchUserProfileData(auth) {
  try {
    const data = await apiFetchJson("https://nhentai.net/api/v2/user/me", { auth });
    if (data) {
      return {
        id: data.id || 0,
        username: data.username || "",
        email: data.email || "",
        avatar_url: data.avatar_url || data.avatar || "",
        num_favorites: Number(data.num_favorites || data.favorites_count || 0),
        num_comments: Number(data.num_comments || 0),
        joined_at: data.joined_at || data.created_at || "",
      };
    }
  } catch (e) {
    console.warn("[proxy] user/me v2 non joignable, fallback profil:", e?.message);
  }
  return {
    id: 0,
    username: "",
    email: "",
    avatar_url: "",
    num_favorites: 0,
    num_comments: 0,
  };
}

/** GET /api/v2/user/comments -> Liste des commentaires de l'utilisateur */
async function fetchUserCommentsList(auth) {
  try {
    const data = await apiFetchJson("https://nhentai.net/api/v2/user/comments", { auth });
    const rawList = Array.isArray(data) ? data : Array.isArray(data?.result) ? data.result : Array.isArray(data?.comments) ? data.comments : [];
    return rawList.map((c) => {
      const gId = Number(c.gallery_id || c.gallery?.id || 0);
      const mediaId = String(c.gallery?.media_id || c.media_id || "");
      const thumbUrl = mediaId
        ? `https://t3.nhentai.net/galleries/${mediaId}/thumb.webp`
        : c.gallery?.cover || "";

      return {
        id: String(c.id || Math.random().toString(36).slice(2)),
        gallery_id: gId,
        gallery_title: c.gallery?.title?.pretty || c.gallery_title || (gId ? `Gallery #${gId}` : "Manga"),
        gallery_cover: thumbUrl,
        post_date: Number(c.post_date || c.created_at || Math.floor(Date.now() / 1000)),
        body: String(c.body || c.comment || c.text || "").trim(),
      };
    });
  } catch (e) {
    console.warn("[proxy] user/comments non joignable:", e?.message);
    return [];
  }
}

/** POST /api/v2/user/password -> Changer le mot de passe utilisateur */
async function changeUserPasswordApi(auth, currentPassword, newPassword) {
  let pow;
  try {
    pow = await apiFetchJson("https://nhentai.net/api/v2/pow?action=change_password");
  } catch {
    try {
      pow = await apiFetchJson("https://nhentai.net/api/v2/pow");
    } catch {}
  }
  const nonce = pow?.difficulty > 0 ? await solvePow(pow.challenge, pow.difficulty) : "";

  return apiFetchJson("https://nhentai.net/api/v2/user/password", {
    method: "POST",
    auth,
    body: {
      current_password: currentPassword,
      new_password: newPassword,
      pow_challenge: pow?.challenge || "",
      pow_nonce: nonce,
      captcha_response: "",
    },
  });
}

/** Lit un corps JSON (POST) avec une borne de taille. */
function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let size = 0;
    let chunks = [];

    const rejectOnce = (error) => {
      if (settled) return;
      settled = true;
      chunks = [];
      reject(error);
    };

    const contentLength = Number(req.headers["content-length"] || 0);
    if (Number.isFinite(contentLength) && contentLength > REQUEST_BODY_MAX_BYTES) {
      rejectOnce(publicError(413, "Corps de requête trop grand"));
      req.resume();
      return;
    }

    req.on("data", (chunk) => {
      if (settled) return;
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += buffer.length;
      if (size > REQUEST_BODY_MAX_BYTES) {
        rejectOnce(publicError(413, "Corps de requête trop grand"));
        req.resume();
        return;
      }
      chunks.push(buffer);
    });
    req.on("end", () => {
      if (settled) return;
      settled = true;
      try {
        const data = Buffer.concat(chunks, size).toString("utf8");
        resolve(data ? JSON.parse(data) : {});
      } catch {
        reject(publicError(400, "JSON invalide"));
      }
    });
    req.on("error", (error) => rejectOnce(error));
    req.on("aborted", () => rejectOnce(new Error("Requête interrompue")));
  });
}

// ---------------------------------------------------------------------------
// Pass-through d'images : l'émulateur ne peut pas joindre les CDN (TLS
// Cloudflare), mais l'hôte si. On sert donc les images via ce proxy.
// ---------------------------------------------------------------------------
// Cache d'images : LRU borné. L'ordre d'une Map est l'ordre d'insertion ; un
// accès réinsère la clé à la fin, donc les premières clés sont TOUJOURS les
// moins récemment utilisées et l'éviction se fait par le début.
const imageCache = new Map(); // url -> { buf, type, lastUsed }
let imageCacheBytes = 0;
const IMAGE_CACHE_MAX_BYTES = 256 * 1024 * 1024;
const IMAGE_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

function touchImageCache(url) {
  const v = imageCache.get(url);
  if (!v) return;
  v.lastUsed = Date.now();
  imageCache.delete(url);
  imageCache.set(url, v);
}

/** Évince les entrées les moins récemment utilisées jusqu'à pouvoir insérer `needed` octets. */
function evictImageCache(needed) {
  while (imageCacheBytes + needed > IMAGE_CACHE_MAX_BYTES && imageCache.size > 0) {
    const oldestUrl = imageCache.keys().next().value; // Map itère dans l'ordre d'insertion
    const v = imageCache.get(oldestUrl);
    imageCacheBytes -= v.buf.length;
    imageCache.delete(oldestUrl);
  }
}

// ---------------------------------------------------------------------------
// SSRF : /img ne doit pouvoir joindre QUE les CDN d'images des miroirs.
// Chaque destination (y compris chaque saut de redirection) doit matcher la
// allowlist ET ne résoudre que vers des adresses IP publiques (anti loopback,
// RFC 1918, link-local, ULA, anti-DNS-rebinding).
// ---------------------------------------------------------------------------
const HOST_IP_CHECK_TTL_MS = 5 * 60 * 1000;
const hostIpCache = new Map(); // hostname -> { ts }

function isHostnameAllowed(hostname) {
  const h = String(hostname || "").toLowerCase().replace(/\.$/, "");
  return IMAGE_HOST_SUFFIXES.some((s) => h === s || h.endsWith(`.${s}`));
}

/** Interdit loopback, RFC 1918, link-local, ULA, multicast et adresses réservées. */
function isPrivateAddress(addr) {
  const ip = String(addr);
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    if (a === 0 || a === 10) return true; // 0.0.0.0 + RFC 1918
    if (a === 127) return true; // loopback
    if (a === 169 && b === 254) return true; // link-local
    if (a === 172 && b >= 16 && b <= 31) return true; // RFC 1918
    if (a === 192 && b === 168) return true; // RFC 1918
    return a >= 224; // multicast + réservé
  }
  if (net.isIPv6(ip)) {
    const low = ip.toLowerCase();
    if (low.startsWith("::ffff:")) return isPrivateAddress(low.slice(7)); // IPv4-mappée
    if (low === "::" || low === "::1") return true; // non spécifiée / loopback
    if (low.startsWith("fc") || low.startsWith("fd")) return true; // ULA
    if (low.startsWith("fe8") || low.startsWith("fe9") || low.startsWith("fea") || low.startsWith("feb")) return true; // link-local
    return false;
  }
  return true; // adresse inconnue : refus
}

async function assertImageTargetAllowed(targetUrl) {
  let u;
  try {
    u = new URL(targetUrl);
  } catch {
    throw Object.assign(new Error("URL invalide"), { status: 400 });
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") {
    throw Object.assign(new Error(`Protocole non autorisé : ${u.protocol}`), { status: 400 });
  }
  const host = u.hostname.toLowerCase().replace(/\.$/, "");
  if (!isHostnameAllowed(host)) {
    throw Object.assign(new Error(`Hôte non autorisé : ${host}`), { status: 403 });
  }
  const checked = hostIpCache.get(host);
  if (checked && Date.now() - checked.ts < HOST_IP_CHECK_TTL_MS) return;

  let addrs;
  try {
    addrs = await dns.lookup(host, { all: true });
  } catch {
    throw Object.assign(new Error(`Résolution DNS impossible pour ${host}`), { status: 502 });
  }
  for (const { address } of addrs) {
    if (isPrivateAddress(address)) {
      throw Object.assign(
        new Error(`Hôte ${host} résolu vers une adresse privée (${address})`),
        { status: 403 }
      );
    }
  }
  hostIpCache.set(host, { ts: Date.now() });
}

/** Récupère une image en suivant les redirections manuellement (chaque saut est revalidé). */
async function fetchImageRaw(url, hops = 0, signal) {
  if (hops > 5) throw new Error("Trop de redirections");
  await assertImageTargetAllowed(url);
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: "image/avif,image/webp,image/*,*/*;q=0.8",
      Referer: "https://nhentai.net/",
    },
    redirect: "manual", // on valide chaque saut soi-même (anti-SSRF)
    signal,
  });
  if (res.status >= 300 && res.status < 400) {
    const loc = res.headers.get("location");
    if (!loc) throw new Error(`Redirection ${res.status} sans en-tête Location`);
    await res.body?.cancel().catch(() => {});
    return fetchImageRaw(new URL(loc, url).href, hops + 1, signal);
  }
  if (!res.ok) throw new Error(`Image HTTP ${res.status}`);
  return res;
}

async function fetchImageBuffer(targetUrl) {
  const cached = imageCache.get(targetUrl);
  if (cached && Date.now() - cached.lastUsed < IMAGE_CACHE_TTL_MS) {
    touchImageCache(targetUrl); // marque comme récemment utilisé (LRU)
    return cached;
  }
  if (cached) {
    imageCacheBytes -= cached.buf.length;
    imageCache.delete(targetUrl);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  let buf;
  let type;
  try {
    const res = await fetchImageRaw(targetUrl, 0, controller.signal);
    const declaredLength = Number(res.headers.get("content-length") || 0);
    if (
      Number.isFinite(declaredLength) &&
      declaredLength > IMAGE_RESPONSE_MAX_BYTES
    ) {
      await res.body?.cancel().catch(() => {});
      throw publicError(413, "Image distante trop volumineuse");
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error("Flux d'image distant indisponible");
    const chunks = [];
    let received = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > IMAGE_RESPONSE_MAX_BYTES) {
        controller.abort();
        await reader.cancel().catch(() => {});
        throw publicError(413, "Image distante trop volumineuse");
      }
      chunks.push(Buffer.from(value));
    }
    buf = Buffer.concat(chunks, received);
    type = res.headers.get("content-type") || "image/jpeg";
  } finally {
    clearTimeout(timer);
  }

  if (buf.length <= IMAGE_CACHE_MAX_BYTES) {
    evictImageCache(buf.length); // borne : éviction LRU jusqu'à tenir sous le plafond
    imageCacheBytes += buf.length;
    imageCache.set(targetUrl, { buf, type, lastUsed: Date.now() });
  }
  return { buf, type };
}

/** Remplace les URLs des CDN d'images par le pass-through du proxy. */
function proxyImageUrls(value, host) {
  if (typeof value === "string") {
    const m = value.match(/^https:\/\/([^/]+)\//);
    if (m && IMAGE_HOST_SUFFIXES.some((s) => m[1].endsWith(s))) {
      return `http://${host}/img?u=${encodeURIComponent(value)}`;
    }
    return value;
  }
  if (Array.isArray(value)) return value.map((v) => proxyImageUrls(v, host));
  if (value && typeof value === "object") {
    for (const k of Object.keys(value)) value[k] = proxyImageUrls(value[k], host);
    return value;
  }
  return value;
}

// ---------------------------------------------------------------------------
// Résolution des tags par ID (favoris v2 : tag_ids numériques -> objets tags).
// Endpoint officiel public GET /api/v2/tags/ids?ids=a,b,c (max 100/requête,
// quota 15/min/IP). Cache en mémoire : le premier passage paie l'API, les
// suivants sont gratuits. Espacement ~4 s et backoff sur 429.
// ---------------------------------------------------------------------------
const tagIdCache = new Map();
let lastTagFetchAt = 0;

async function resolveTagsByIds(ids) {
  const unique = [...new Set(ids.map(Number).filter((n) => Number.isFinite(n) && n > 0))];
  const missing = unique.filter((id) => !tagIdCache.has(id));

  for (let i = 0; i < missing.length; i += 100) {
    const chunk = missing.slice(i, i + 100).join(",");
    const wait = 4000 - (Date.now() - lastTagFetchAt);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    for (let attempt = 1; attempt <= 4; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20000);
      try {
        const res = await fetch(`https://nhentai.net/api/v2/tags/ids?ids=${chunk}`, {
          headers: { "User-Agent": UA, Accept: "application/json" },
          signal: controller.signal,
        });
        lastTagFetchAt = Date.now();
        if (res.status === 429) {
          const body = await res.json().catch(() => ({}));
          const retry = Math.max(Number(body?.retry_after ?? body?.retryAfter ?? 60), 30);
          await new Promise((r) => setTimeout(r, retry * 1000));
          continue;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status} pour /api/v2/tags/ids`);
        const tags = await res.json();
        for (const t of tags) tagIdCache.set(Number(t.id), t);
        break;
      } catch (err) {
        if (attempt >= 4) console.warn("[proxy] tags/ids échec:", err?.message);
        else await new Promise((r) => setTimeout(r, 30000));
      } finally {
        clearTimeout(timer);
      }
    }
  }
  return unique.map((id) => tagIdCache.get(id)).filter(Boolean);
}

// ---------------------------------------------------------------------------
// Serveur HTTP
// ---------------------------------------------------------------------------
const rateLimitBuckets = new Map();
const RATE_LIMIT_BUCKET_MAX_ENTRIES = 2_000;
const RATE_LIMIT_WINDOW_MS = 60_000;

function sensitiveRateLimit(path, method) {
  if (path === "/api/auth/login" && method === "POST") return 5;
  if (path === "/api/user/change-password" && method === "POST") return 5;
  if (path === "/api/keys" && method === "POST") return 10;
  if (/^\/api\/keys\/[^/]+\/?$/.test(path) && method === "DELETE") return 10;
  if (
    path === "/api/favorites" ||
    path === "/api/keys" ||
    path === "/api/user/profile" ||
    path === "/api/user/comments"
  ) {
    return 60;
  }
  return 0;
}

function applySensitiveRateLimit(req, res, path) {
  const limit = sensitiveRateLimit(path, req.method);
  if (!limit) return;

  const now = Date.now();
  const client = req.socket.remoteAddress || "unknown";
  const key = `${client}:${req.method}:${path.replace(/^\/api\/keys\/[^/]+\/?$/, "/api/keys/:id")}`;
  let bucket = rateLimitBuckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    rateLimitBuckets.delete(key);
    rateLimitBuckets.set(key, bucket);
  }
  bucket.count += 1;

  const remaining = Math.max(0, limit - bucket.count);
  const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
  res.setHeader("X-RateLimit-Limit", limit);
  res.setHeader("X-RateLimit-Remaining", remaining);
  res.setHeader("X-RateLimit-Reset", Math.ceil(bucket.resetAt / 1000));

  for (const [bucketKey, value] of rateLimitBuckets) {
    if (now >= value.resetAt) rateLimitBuckets.delete(bucketKey);
  }
  while (rateLimitBuckets.size > RATE_LIMIT_BUCKET_MAX_ENTRIES) {
    rateLimitBuckets.delete(rateLimitBuckets.keys().next().value);
  }

  if (bucket.count > limit) {
    throw publicError(429, "Trop de requêtes", { retryAfter });
  }
}

function appendVary(res, value) {
  const current = res.getHeader("Vary");
  const values = new Set(
    String(current || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  );
  values.add(value);
  res.setHeader("Vary", [...values].join(", "));
}

function applyCors(req, res) {
  const origin = String(req.headers.origin || "").replace(/\/$/, "");
  if (!origin) return true; // clients natifs : pas d'en-tête Origin
  appendVary(res, "Origin");
  if (!ALLOWED_CORS_ORIGINS.has(origin)) return false;

  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Range, X-Refresh-Token, X-Access-Token, X-Api-Key, X-Sessionid"
  );
  res.setHeader("Access-Control-Max-Age", "600");
  return true;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;

  const sendJson = (status, data) => {
    console.log(`[proxy] ${req.method} ${req.url} -> ${status}`);
    res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(data));
  };

  try {
    if (!applyCors(req, res)) {
      return sendJson(403, { error: "Origine non autorisée" });
    }
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }
    applySensitiveRateLimit(req, res, path);

    if (path === "/healthz") {
      return sendJson(200, { ok: true });
    }
    if (path === "/img") {
      const target = url.searchParams.get("u") || "";
      if (!target) {
        return sendJson(400, { error: "paramètre u manquant" });
      }
      const img = await fetchImageBuffer(target); // validation SSRF + allowlist interne

      // Support Range (206) pour les téléchargements reprenables
      // (expo-file-system createDownloadResumable envoie Range après interruption)
      const range = req.headers.range;
      let status = 200;
      let start = 0;
      let end = img.buf.length - 1;
      if (range) {
        const m = /bytes=(\d+)-(\d*)/.exec(range);
        if (m) {
          start = parseInt(m[1], 10);
          if (m[2]) end = Math.min(parseInt(m[2], 10), img.buf.length - 1);
          // Plage insatisfaisable (début hors bornes, ou fin < début) -> 416,
          // jamais un corps vide en 206 (corromprait un téléchargement reprenable).
          if (start >= img.buf.length || end < start) {
            res.writeHead(416, {
              "Content-Range": `bytes */${img.buf.length}`,
            });
            res.end();
            return;
          }
          status = 206;
        }
      }
      const chunk = img.buf.subarray(start, end + 1);
      console.log(`[proxy] GET ${req.url} -> ${status} ${img.type} ${chunk.length}B (${start}-${end}/${img.buf.length})`);
      res.writeHead(status, {
        "Content-Type": img.type,
        "Content-Length": chunk.length,
        "Content-Range": `bytes ${start}-${end}/${img.buf.length}`,
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=86400",
      });
      res.end(chunk);
      return;
    }
    if (path === "/api/auth/login" && req.method === "POST") {
      const body = await readJsonBody(req);
      const username = String(body?.username || "").trim();
      const password = String(body?.password || "").trim();
      if (!username || !password) {
        return sendJson(400, { error: "Identifiant et mot de passe requis" });
      }
      const result = await loginNativeUser(username, password);
      return sendJson(200, result);
    }
    if (path === "/api/user/profile") {
      const auth = await resolveUserAuth(req);
      const profile = await fetchUserProfileData(auth);
      return sendJson(200, profile);
    }
    if (path === "/api/user/comments") {
      const auth = await resolveUserAuth(req);
      const comments = await fetchUserCommentsList(auth);
      return sendJson(200, comments);
    }
    if (path === "/api/user/change-password" && req.method === "POST") {
      const auth = await resolveUserAuth(req);
      const body = await readJsonBody(req);
      const currentPassword = String(body?.current_password || "").trim();
      const newPassword = String(body?.new_password || "").trim();
      if (!currentPassword || !newPassword) {
        return sendJson(400, { error: "Ancien et nouveau mot de passe requis" });
      }
      const result = await changeUserPasswordApi(auth, currentPassword, newPassword);
      return sendJson(200, result || { success: true, message: "Mot de passe mis à jour" });
    }
    if (path === "/api/keys" && req.method === "POST") {
      const auth = await resolveUserAuth(req);
      const body = await readJsonBody(req);
      const name = String(body?.name || "").trim();
      if (!name) return sendJson(400, { error: "Nom de clé requis" });
      const key = await createUserKey(auth, name, String(body?.purpose || "").trim());
      return sendJson(200, key);
    }
    if (path === "/api/keys") {
      const auth = await resolveUserAuth(req);
      const keys = await listUserKeys(auth);
      return sendJson(200, keys);
    }
    const keyDeleteMatch = path.match(/^\/api\/keys\/([^/]+)\/?$/);
    if (keyDeleteMatch && req.method === "DELETE") {
      const auth = await resolveUserAuth(req);
      const result = await deleteUserKey(auth, decodeURIComponent(keyDeleteMatch[1]));
      return sendJson(200, result || { ok: true });
    }
    if (path === "/api/tags/ids") {
      const ids = (url.searchParams.get("ids") || "")
        .split(",")
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => Number.isFinite(n) && n > 0);
      if (!ids.length) return sendJson(400, { error: "paramètre ids manquant" });
      return sendJson(200, await resolveTagsByIds(ids));
    }
    if (path === "/api/favorites") {
      const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
      const refreshToken = (req.headers["x-refresh-token"] || "").trim();
      const apiKey = (req.headers["x-api-key"] || "").trim();
      const sessionid = (req.headers["x-sessionid"] || "").trim();
      const credential = refreshToken || apiKey || sessionid;
      const credentialType = refreshToken ? "refresh" : apiKey ? "apiKey" : sessionid ? "sessionid" : null;
      const data = await handleFavorites(page, credential, credentialType);
      const resp = proxyImageUrls(data, req.headers.host || "localhost:8787");
      if (data.rateLimit) {
        resp.rateLimitRemaining = data.rateLimit.remaining;
        resp.rateLimitLimit = data.rateLimit.limit;
        resp.retryAfter = data.rateLimit.retryAfter;
      }
      return sendJson(200, resp);
    }
    if (path === "/random/") {
      return sendJson(200, await handleRandom());
    }
    if (path === "/api/galleries/search" || path === "/api/galleries/all") {
      const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
      const query = url.searchParams.get("query") || "";
      const sort = url.searchParams.get("sort") || "recent";
      const data = await handleSearch(query, page, sort);
      return sendJson(200, proxyImageUrls(data, req.headers.host || "localhost:8787"));
    }
    const galleryMatch = path.match(/^\/api\/gallery\/(\d+)\/comments\/?$/);
    if (galleryMatch) {
      // Les miroirs ne remontent pas de commentaires : liste vide, comme nhentai
      return sendJson(200, []);
    }
    const galleryIdMatch = path.match(/^\/api\/gallery\/(\d+)\/?$/);
    if (galleryIdMatch) {
      const data = await handleGallery(galleryIdMatch[1]);
      return sendJson(200, proxyImageUrls(data, req.headers.host || "localhost:8787"));
    }
    return sendJson(404, { error: "Route inconnue", path });
  } catch (err) {
    console.error(`[proxy] ${req.method} ${path} ->`, err?.message);
    const requestedStatus = Number(err?.status);
    const status =
      Number.isInteger(requestedStatus) &&
      requestedStatus >= 400 &&
      requestedStatus < 500
        ? requestedStatus
        : 502;
    const defaultMessages = {
      400: "Requête invalide",
      401: "Authentification requise ou invalide",
      403: "Accès refusé",
      404: "Ressource introuvable",
      413: "Requête trop volumineuse",
      429: "Trop de requêtes",
      502: "Service distant indisponible",
    };
    const captchaRequired = Boolean(err?.captchaRequired);
    const payload = {
      error: captchaRequired
        ? "Vérification de sécurité requise"
        : err?.expose
          ? err.message
          : defaultMessages[status] || "Erreur interne",
      captchaRequired,
    };
    if (err?.retryAfter) {
      payload.retryAfter = err.retryAfter;
      res.setHeader("Retry-After", err.retryAfter);
    }
    if (err?.rateLimit) {
      payload.retryAfter = err.rateLimit.retryAfter || 60;
      payload.rateLimitRemaining = err.rateLimit.remaining;
      res.setHeader("Retry-After", payload.retryAfter);
    }
    return sendJson(status, payload);
  }
});

// L'émulateur Android redirige 10.0.2.2 vers le loopback de l'hôte :
// l'écoute 127.0.0.1 reste donc compatible sans exposer le proxy au LAN.
server.listen(PORT, HOST, () => {
  console.log(`[nhentai-mirror] en écoute sur http://${HOST}:${PORT}`);
  if (HOST !== "127.0.0.1" && HOST !== "::1" && HOST !== "localhost") {
    console.warn(
      "[nhentai-mirror] accès réseau activé explicitement via PROXY_HOST"
    );
  }
  console.log(`[nhentai-mirror] miroirs : ${MIRRORS.map((m) => m.base).join(", ")}`);
});

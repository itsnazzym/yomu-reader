const { app, BrowserWindow, ipcMain, dialog, shell, session, Notification, Menu, net } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const http = require("http");
const https = require("https");
const dns = require("dns");
const archiver = require("archiver");
const AdmZip = require("adm-zip");
const cheerio = require("cheerio");

// Persistent DNS & DoH Settings Configuration
const userDataPath = app.getPath("userData");
const settingsFilePath = path.join(userDataPath, "user_dns_settings.json");

function loadStoredDnsSettings() {
  try {
    if (fs.existsSync(settingsFilePath)) {
      const raw = fs.readFileSync(settingsFilePath, "utf8");
      return JSON.parse(raw);
    }
  } catch (e) {}
  return { enable_custom_dns: true, enable_doh: true, dns_provider: "adguard" };
}

const initialDnsConfig = loadStoredDnsSettings();

const DNS_SERVERS_MAP = {
  adguard: ["94.140.14.14", "94.140.15.15", "1.1.1.1", "1.0.0.1", "8.8.8.8"],
  cloudflare: ["1.1.1.1", "1.0.0.1", "8.8.8.8", "8.8.4.4"],
  google: ["8.8.8.8", "8.8.4.4", "1.1.1.1", "1.0.0.1"],
  quad9: ["9.9.9.9", "149.112.112.112", "1.1.1.1"],
};

const DOH_URL_MAP = {
  adguard: "https://dns.adguard-dns.com/dns-query",
  cloudflare: "https://cloudflare-dns.com/dns-query",
  google: "https://dns.google/dns-query",
  quad9: "https://dns.quad9.net/dns-query",
};

function applyNodeDns(dns_provider, enable_custom_dns) {
  if (enable_custom_dns === false || dns_provider === "system") {
    try {
      console.log("[🛡️ DNS ENGINE] DNS Personnalisé Désactivé -> Utilisation du résolveur Système / FAI");
    } catch (e) {}
    return;
  }

  const servers = DNS_SERVERS_MAP[dns_provider] || DNS_SERVERS_MAP.adguard;
  try {
    dns.setServers(servers);
    console.log(`[🛡️ DNS ENGINE] DNS Personnalisé actif (${dns_provider || "adguard"}): ${servers.join(", ")}`);
  } catch (e) {
    console.warn("[DNS Engine] notice:", e.message);
  }
}

if (initialDnsConfig.enable_custom_dns !== false && initialDnsConfig.dns_provider !== "system") {
  applyNodeDns(initialDnsConfig.dns_provider || "adguard", true);
} else {
  console.log("[🛡️ DNS ENGINE] Mode Système (DNS Personnalisé désactivé)");
}

// Enable Chromium Native DNS-over-HTTPS (DoH) only if enabled by user
if (initialDnsConfig.enable_doh !== false && initialDnsConfig.dns_provider !== "system" && initialDnsConfig.enable_custom_dns !== false) {
  const dohUrl = DOH_URL_MAP[initialDnsConfig.dns_provider] || DOH_URL_MAP.adguard;
  app.commandLine.appendSwitch("enable-features", "DnsOverHttps");
  app.commandLine.appendSwitch("dns-over-https-templates", dohUrl);
  console.log(`[🛡️ DoH ENGINE] DoH actif: ${dohUrl}`);
} else {
  console.log("[🛡️ DoH ENGINE] DoH désactivé (mode Système / Désactivé)");
}

let mainWindow = null;
let authWindow = null;
let backgroundBypassWindow = null;
const activeDownloads = new Map(); // id -> AbortController

const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36";

// Clé API de secours configurable via l'environnement (jamais codée en dur).
const DEFAULT_API_KEY = (process.env.NHENTAI_API_KEY || "").trim();

// Resilient universal zip archive constructor (compatible with archiver v5/v6/v7/v8)
function createZipArchive(options) {
  if (typeof archiver === "function") {
    return archiver("zip", options);
  }
  if (archiver && archiver.ZipArchive) {
    return new archiver.ZipArchive(options);
  }
  if (archiver && typeof archiver.create === "function") {
    return archiver.create("zip", options);
  }
  if (archiver && archiver.Archiver) {
    return new archiver.Archiver("zip", options);
  }
  throw new Error("Moteur de compression d'archive non disponible");
}

function sanitizeFilename(name) {
  if (!name) return "untitled";
  const forbidden = /[<>:"/\\|?*\x00-\x1F]/g;
  let clean = name.replace(forbidden, "_").trim().replace(/\.+$/, "");
  if (clean.length > 180) {
    clean = clean.substring(0, 180);
  }
  return clean || "untitled";
}

function cleanCdnPath(rawPath) {
  if (!rawPath) return "";
  let clean = String(rawPath).replace(/^\//, "");
  // nHentai API v2 returns paths like "galleries/123/cover.jpg.webp" - this IS the real filename.
  // Only fix truly redundant duplicate extensions (.webp.webp -> .webp, .jpg.jpg -> .jpg)
  clean = clean.replace(/\.(webp)\.webp$/i, ".webp");
  clean = clean.replace(/\.(jpg)\.jpg$/i, ".jpg");
  clean = clean.replace(/\.(jpeg)\.jpeg$/i, ".jpeg");
  clean = clean.replace(/\.(png)\.png$/i, ".png");
  return clean;
}

function normalizeGallery(g) {
  if (!g) return g;
  const titleObj = g.title || {
    english: g.english_title || "",
    japanese: g.japanese_title || "",
    pretty: g.english_title || g.japanese_title || `Gallery #${g.id}`,
  };

  let mediaId = String(g.media_id || "");
  if (!mediaId || mediaId === "undefined" || mediaId === "null" || mediaId === "0") {
    const raw = g.cover?.path || g.thumbnail?.path || (typeof g.thumbnail === "string" ? g.thumbnail : "");
    const m = String(raw).match(/galleries\/(\d+)/);
    if (m) {
      mediaId = m[1];
    } else {
      mediaId = String(g.id || "");
    }
  }

  let rawPages = [];
  if (Array.isArray(g.pages) && g.pages.length > 0) {
    rawPages = g.pages;
  } else if (g.images && Array.isArray(g.images.pages) && g.images.pages.length > 0) {
    rawPages = g.images.pages;
  }

  const pages = (rawPages.length > 0 ? rawPages : Array.from({ length: g.num_pages || 1 })).map((p, idx) => {
    const pageNum = p?.number || idx + 1;
    const isPng = p?.path?.endsWith(".png") || p?.t === "p";
    const isGif = p?.path?.endsWith(".gif") || p?.t === "g";
    const isJpg = p?.path?.endsWith(".jpg") || p?.path?.endsWith(".jpeg") || p?.t === "j";
    const t = isPng ? "p" : isGif ? "g" : isJpg ? "j" : "w";
    const ext = getExt(t);
    const pagePath = cleanCdnPath(p?.path) || `galleries/${mediaId}/${pageNum}.${ext}`;
    const thumbPath = cleanCdnPath(p?.thumbnail) || `galleries/${mediaId}/${pageNum}t.${ext}`;
    return {
      t,
      w: p?.width || p?.w || 1280,
      h: p?.height || p?.h || 1800,
      path: pagePath,
      thumbnail: thumbPath,
      number: pageNum,
    };
  });

  const rawCover = g.cover?.path || g.thumbnail?.path || (typeof g.thumbnail === "string" ? g.thumbnail : `galleries/${mediaId}/thumb.webp`);
  const coverPath = cleanCdnPath(rawCover) || `galleries/${mediaId}/thumb.webp`;
  const coverInfo = {
    t: coverPath?.endsWith(".png") ? "p" : coverPath?.endsWith(".jpg") ? "j" : "w",
    w: g.cover?.width || g.thumbnail_width || 250,
    h: g.cover?.height || g.thumbnail_height || 350,
    path: coverPath,
  };

  const images = {
    pages,
    cover: coverInfo,
    thumbnail: coverInfo,
  };

  return {
    id: g.id,
    media_id: mediaId,
    title: titleObj,
    images,
    num_pages: g.num_pages || pages.length || 1,
    num_favorites: g.num_favorites || 0,
    tags: g.tags || [],
    upload_date: g.upload_date || Math.floor(Date.now() / 1000),
    scanlator: g.scanlator || "",
  };
}

function extractArtistFromTitle(title) {
  if (!title) return null;
  const match = title.match(/^\s*(?:\([^)]+\)\s*)?\[([^\]]+)\]/);
  return match ? match[1].trim() : null;
}

function formatFilename(pattern, gallery) {
  const norm = normalizeGallery(gallery);
  const idStr = String(norm.id);
  const rawTitle = norm.title?.pretty || norm.title?.english || norm.title?.japanese || `Gallery #${norm.id}`;
  
  const artistTag = norm.tags?.find((t) => t.type === "artist");
  const extractedArtist = extractArtistFromTitle(norm.title?.english || norm.title?.pretty || rawTitle);
  const artistStr = sanitizeFilename(artistTag?.name || extractedArtist || "Unknown");

  let titleStr = sanitizeFilename(rawTitle);
  // Avoid duplicate artist prefix if pattern already puts [{artist}] in front
  if (artistStr && artistStr !== "Unknown" && pattern && pattern.includes("{artist}")) {
    if (titleStr.toLowerCase().startsWith(`[${artistStr.toLowerCase()}] `)) {
      titleStr = titleStr.substring(artistStr.length + 3).trim();
    } else if (titleStr.toLowerCase().startsWith(`[${artistStr.toLowerCase()}]`)) {
      titleStr = titleStr.substring(artistStr.length + 2).trim();
    }
  }
  
  const groupTag = norm.tags?.find((t) => t.type === "group");
  const groupStr = sanitizeFilename(groupTag?.name || "Original");
  
  const parodyTag = norm.tags?.find((t) => t.type === "parody");
  const parodyStr = sanitizeFilename(parodyTag?.name || "Original");
  
  const characterTag = norm.tags?.find((t) => t.type === "character");
  const characterStr = sanitizeFilename(characterTag?.name || "Original");
  
  const langTag = norm.tags?.find((t) => t.type === "language" && t.name !== "translated");
  let detectedLang = langTag?.name || null;
  if (!detectedLang) {
    const rawLower = (norm.title?.english || norm.title?.pretty || rawTitle).toLowerCase();
    if (rawLower.includes("[english]") || rawLower.includes("(english)")) detectedLang = "english";
    else if (rawLower.includes("[chinese]") || rawLower.includes("(chinese)")) detectedLang = "chinese";
    else if (rawLower.includes("[french]") || rawLower.includes("(french)")) detectedLang = "french";
    else if (rawLower.includes("[spanish]") || rawLower.includes("(spanish)")) detectedLang = "spanish";
    else detectedLang = "japanese";
  }
  const langStr = sanitizeFilename(detectedLang);
  
  const pagesStr = String(norm.num_pages || 1);
  const catTag = norm.tags?.find((t) => t.type === "category");
  const catStr = sanitizeFilename(catTag?.name || "doujinshi");

  let result = pattern || "[{id}] [{artist}] {title} ({language})";
  result = result
    .replace(/{id}/g, idStr)
    .replace(/{title}/g, titleStr)
    .replace(/{artist}/g, artistStr)
    .replace(/{group}/g, groupStr)
    .replace(/{parody}/g, parodyStr)
    .replace(/{character}/g, characterStr)
    .replace(/{language}/g, langStr)
    .replace(/{pages}/g, pagesStr)
    .replace(/{category}/g, catStr);

  return sanitizeFilename(result);
}

function generateComicInfoXml(gallery) {
  const norm = normalizeGallery(gallery);
  const artist = norm.tags?.find((t) => t.type === "artist")?.name || "";
  const group = norm.tags?.find((t) => t.type === "group")?.name || "";
  const parody = norm.tags?.find((t) => t.type === "parody")?.name || "";
  const characters = (norm.tags || []).filter((t) => t.type === "character").map((t) => t.name).join(", ");
  const lang = norm.tags?.find((t) => t.type === "language" && t.name !== "translated")?.name || "japanese";
  const tagsStr = (norm.tags || []).map((t) => t.name).join(", ");
  const cat = norm.tags?.find((t) => t.type === "category")?.name || "Doujinshi";
  const title = norm.title?.pretty || norm.title?.english || `Gallery #${norm.id}`;

  const uploadDate = norm.upload_date ? new Date(norm.upload_date * 1000) : new Date();
  const year = uploadDate.getFullYear();
  const month = uploadDate.getMonth() + 1;
  const day = uploadDate.getDate();

  const escapeXml = (unsafe) =>
    String(unsafe || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");

  return `<?xml version="1.0" encoding="utf-8"?>
<ComicInfo xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <Title>${escapeXml(title)}</Title>
  <Series>${escapeXml(parody || title)}</Series>
  <Number>${norm.id}</Number>
  <Summary>Source: https://nhentai.net/g/${norm.id}/&#xA;Tags: ${escapeXml(tagsStr)}</Summary>
  <Writer>${escapeXml(group || artist)}</Writer>
  <Penciller>${escapeXml(artist)}</Penciller>
  <Inker>${escapeXml(artist)}</Inker>
  <Genre>${escapeXml(cat)}</Genre>
  <Tags>${escapeXml(tagsStr)}</Tags>
  <Characters>${escapeXml(characters)}</Characters>
  <PageCount>${norm.num_pages || 1}</PageCount>
  <LanguageISO>${escapeXml(lang === "french" ? "fr" : lang === "english" ? "en" : lang === "japanese" ? "ja" : lang === "chinese" ? "zh" : lang === "spanish" ? "es" : "ja")}</LanguageISO>
  <Web>https://nhentai.net/g/${norm.id}/</Web>
  <Year>${year}</Year>
  <Month>${month}</Month>
  <Day>${day}</Day>
  <ScanInformation>nHentai Downloader #${norm.id}</ScanInformation>
  <Manga>YesAndRightToLeft</Manga>
</ComicInfo>`;
}

function getExt(t) {
  switch (t) {
    case "j": return "jpg";
    case "p": return "png";
    case "w": return "webp";
    case "g": return "gif";
    default: return "webp";
  }
}

// Background Cloudflare session warmer
async function initCloudflareSession() {
  try {
    if (backgroundBypassWindow && !backgroundBypassWindow.isDestroyed()) {
      return backgroundBypassWindow;
    }
    backgroundBypassWindow = new BrowserWindow({
      show: false,
      width: 400,
      height: 300,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    await backgroundBypassWindow.loadURL("https://nhentai.net/");
    return backgroundBypassWindow;
  } catch (e) {
    console.warn("Silent background session warmer notice:", e.message);
    return null;
  }
}

// Tier 3 Helper: Parse single Gallery from raw nHentai HTML page
function parseGalleryHtml(html, id) {
  const $ = cheerio.load(html);

  // 1. Check for embedded JSON state in scripts
  const scripts = $("script").toArray();
  for (const s of scripts) {
    const text = $(s).html() || "";
    const match = text.match(/window\._gallery\s*=\s*JSON\.parse\((["'].*?["'])\);/s);
    if (match) {
      try {
        const rawJson = JSON.parse(match[1]);
        const parsed = JSON.parse(rawJson);
        if (parsed && (parsed.id || parsed.media_id)) return parsed;
      } catch (e) {}
    }
    const matchRaw = text.match(/window\._gallery\s*=\s*(\{.*?\});/s);
    if (matchRaw) {
      try {
        const parsed = JSON.parse(matchRaw[1]);
        if (parsed && (parsed.id || parsed.media_id)) return parsed;
      } catch (e) {}
    }
  }

  // 2. DOM Parsing Fallback
  const englishTitle = $("#info h1.title").text().trim() || $(`#info .title`).first().text().trim();
  const japaneseTitle = $("#info h2.title").text().trim();
  const prettyTitle = $("#info h1.title .pretty").text().trim() || englishTitle;

  const coverImg = $("#cover img").attr("data-src") || $("#cover img").attr("src") || "";
  const mediaMatch = coverImg.match(/\/galleries\/(\d+)\//);
  const media_id = mediaMatch ? mediaMatch[1] : String(id);

  const tags = [];
  $("#tags .tag-container, #tags > div").each((_, container) => {
    const containerText = $(container).text().toLowerCase();
    let type = "tag";
    if (containerText.includes("artist")) type = "artist";
    else if (containerText.includes("group")) type = "group";
    else if (containerText.includes("language")) type = "language";
    else if (containerText.includes("category")) type = "category";
    else if (containerText.includes("parod")) type = "parody";
    else if (containerText.includes("character")) type = "character";

    $(container).find("a.tag").each((_, el) => {
      const name = $(el).find(".name").text().trim();
      const count = parseInt($(el).find(".count").text().replace(/[^0-9]/g, ""), 10) || 0;
      const classAttr = $(el).attr("class") || "";
      const idMatch = classAttr.match(/tag-(\d+)/);
      const tagId = idMatch ? parseInt(idMatch[1], 10) : 0;
      if (name) {
        tags.push({ id: tagId, type, name, count, url: $(el).attr("href") || "" });
      }
    });
  });

  const pages = [];
  $(".thumb-container").each((idx, el) => {
    const img = $(el).find("img");
    const src = img.attr("data-src") || img.attr("src") || "";
    let ext = "w";
    if (src.includes(".jpg") || src.includes(".jpeg")) ext = "j";
    else if (src.includes(".png")) ext = "p";
    else if (src.includes(".gif")) ext = "g";

    pages.push({
      t: ext,
      number: idx + 1,
      thumbnail: `galleries/${media_id}/${idx + 1}t.${ext === "j" ? "jpg" : ext === "p" ? "png" : "webp"}`,
      path: `galleries/${media_id}/${idx + 1}.${ext === "j" ? "jpg" : ext === "p" ? "png" : "webp"}`,
    });
  });

  return {
    id: Number(id),
    media_id,
    title: {
      english: englishTitle,
      japanese: japaneseTitle,
      pretty: prettyTitle,
    },
    images: {
      cover: { t: "w", path: `galleries/${media_id}/thumb.webp` },
      thumbnail: { t: "w", path: `galleries/${media_id}/thumb.webp` },
      pages,
    },
    num_pages: pages.length || 1,
    num_favorites: parseInt($("#favorite span.nobold, #favorite span").text().replace(/[^0-9]/g, ""), 10) || 0,
    tags,
    upload_date: Math.floor(Date.now() / 1000),
  };
}

// Tier 3 Helper: Parse search results & home explore from raw HTML
function parseSearchHtml(html) {
  const $ = cheerio.load(html);
  const galleries = [];

  $(".gallery, .gallery-favorite").each((_, el) => {
    const link = $(el).find("a.cover").attr("href") || $(el).attr("href") || "";
    const idMatch = link.match(/\/g\/(\d+)\//);
    const id = idMatch ? parseInt(idMatch[1], 10) : 0;
    if (!id) return;

    const title = $(el).find(".caption").text().trim();
    const img = $(el).find("a.cover img, img");
    const src = img.attr("data-src") || img.attr("src") || "";
    const mediaMatch = src.match(/\/galleries\/(\d+)\//);
    const media_id = mediaMatch ? mediaMatch[1] : String(id);

    galleries.push({
      id,
      media_id,
      title: { english: title, pretty: title, japanese: "" },
      images: {
        cover: { t: "w", path: `galleries/${media_id}/thumb.webp` },
        thumbnail: { t: "w", path: `galleries/${media_id}/thumb.webp` },
        pages: [],
      },
      num_pages: 1,
      num_favorites: 0,
      tags: [],
    });
  });

  let num_pages = 1;
  const lastLink = $(".pagination .last").attr("href") || $(".pagination a").last().attr("href") || "";
  const pageMatch = lastLink.match(/page=(\d+)/);
  if (pageMatch) {
    num_pages = parseInt(pageMatch[1], 10);
  }

  return {
    result: galleries,
    num_pages,
    per_page: 25,
    total: galleries.length * num_pages,
  };
}

// Tier 2 Helper: Headless in-browser execution fallback
async function fetchHeadlessSession(targetUrl) {
  const win = await initCloudflareSession();
  if (!win) throw new Error("Impossible d'initialiser la session headless");

  const script = `
    (async () => {
      try {
        const resp = await fetch(${JSON.stringify(targetUrl)}, {
          headers: { "Accept": "application/json, text/html, */*" }
        });
        const text = await resp.text();
        return { ok: resp.ok, status: resp.status, text };
      } catch (e) {
        return { ok: false, status: 0, error: e.message };
      }
    })()
  `;

  const res = await win.webContents.executeJavaScript(script);
  if (res && res.text) {
    try {
      return JSON.parse(res.text);
    } catch {
      return res.text;
    }
  }
  throw new Error(res?.error || "Échec session headless");
}

// 4-Tier Multi-Level Cloudflare Bypass & Fallback Fetcher
async function fetchNhentai(url, customCookies, apiKey, retryCount = 0) {
  // --- TIER 1: Native Node.js / Electron HTTPS API Request ---
  try {
    const res = await new Promise(async (resolve, reject) => {
      const u = new URL(url);
      const headers = {
        "User-Agent": DEFAULT_USER_AGENT,
        Accept: "application/json, text/html, */*",
        "Accept-Language": "en-US,en;q=0.9,ja;q=0.8,fr;q=0.7",
        Referer: "https://nhentai.net/",
      };

      const effectiveApiKey = (apiKey || DEFAULT_API_KEY || "").trim();
      if (effectiveApiKey) {
        headers["Authorization"] = `Bearer ${effectiveApiKey}`;
        headers["X-API-Key"] = effectiveApiKey;
        headers["X-Api-Key"] = effectiveApiKey;
        headers["Api-Key"] = effectiveApiKey;
      }

      if (customCookies) {
        headers["Cookie"] = customCookies;
      } else {
        try {
          const sessionCookies = await session.defaultSession.cookies.get({ domain: "nhentai.net" });
          if (sessionCookies.length > 0) {
            headers["Cookie"] = sessionCookies.map((c) => `${c.name}=${c.value}`).join("; ");
          }
        } catch (e) {}
      }

      const req = https.request(
        {
          hostname: u.hostname,
          path: u.pathname + u.search,
          method: "GET",
          agent: httpsKeepAliveAgent,
          headers,
        },
        (res) => {
          if (res.statusCode === 301 || res.statusCode === 302) {
            const loc = res.headers.location;
            if (loc) {
              return fetchNhentai(loc, customCookies, apiKey, retryCount).then(resolve, reject);
            }
          }

          if (res.statusCode === 429 && retryCount < 4) {
            const jitter = Math.floor(Math.random() * 400);
            const waitTime = Math.min(6000, 1000 * Math.pow(2, retryCount)) + jitter;
            console.warn(`[429 Rate Limit] Attente avec backoff exponentiel de ${waitTime}ms (${retryCount + 1}/4) pour ${url}`);
            return new Promise((r) => setTimeout(r, waitTime))
              .then(() => fetchNhentai(url, customCookies, apiKey, retryCount + 1))
              .then(resolve, reject);
          }

          let raw = "";
          res.on("data", (c) => (raw += c));
          res.on("end", () => {
            if (res.statusCode === 403 || res.statusCode === 503) {
              return reject(new Error("CLOUDFLARE_403_CHALLENGE"));
            }
            if (res.statusCode >= 400) {
              return reject(new Error(`Erreur HTTP ${res.statusCode} sur ${url}`));
            }
            try {
              resolve(JSON.parse(raw));
            } catch (e) {
              resolve(raw);
            }
          });
          res.on("error", reject);
        }
      );

      req.on("error", reject);
      req.setTimeout(12000, () => {
        req.destroy();
        reject(new Error(`Timeout de connexion sur ${url}`));
      });
      req.end();
    });

    if (res) return res;
  } catch (tier1Error) {
    console.warn(`[Tier 1 Direct Failed]: ${tier1Error.message} -> Basculement sur Tier 2/3...`);
  }

  // --- TIER 2: Headless Browser In-Session Evaluation ---
  try {
    console.log(`[Tier 2 Headless] Tentative de récupération via session Chromium (${url})...`);
    const tier2Data = await fetchHeadlessSession(url);
    if (tier2Data && (tier2Data.id || tier2Data.result || Array.isArray(tier2Data))) {
      return tier2Data;
    }
  } catch (tier2Error) {
    console.warn(`[Tier 2 Headless Failed]: ${tier2Error.message} -> Basculement sur Tier 3 HTML Scraping...`);
  }

  // --- TIER 3: Public HTML Scraping Fallback ---
  try {
    console.log(`[Tier 3 HTML Fallback] Extraction HTML publique pour ${url}...`);
    let htmlUrl = url;
    let isGallery = false;
    let isSearch = false;
    let galleryId = 0;

    const gMatch = url.match(/\/api\/v2\/galleries\/(\d+)/) || url.match(/\/api\/gallery\/(\d+)/);
    if (gMatch) {
      galleryId = parseInt(gMatch[1], 10);
      htmlUrl = `https://nhentai.net/g/${galleryId}/`;
      isGallery = true;
    } else if (url.includes("/api/v2/galleries/search") || url.includes("/api/galleries/search")) {
      const u = new URL(url);
      htmlUrl = `https://nhentai.net/search/${u.search}`;
      isSearch = true;
    } else if (url.includes("/api/v2/galleries") || url.includes("/api/galleries/all")) {
      const u = new URL(url);
      htmlUrl = `https://nhentai.net/${u.search || "?page=1"}`;
      isSearch = true;
    }

    const htmlRes = await net.fetch(htmlUrl, {
      headers: {
        "User-Agent": DEFAULT_USER_AGENT,
        Referer: "https://nhentai.net/",
      },
    });

    if (htmlRes.ok) {
      const htmlText = await htmlRes.text();
      if (isGallery && galleryId) {
        return parseGalleryHtml(htmlText, galleryId);
      }
      if (isSearch || htmlText.includes("class=\"gallery\"")) {
        return parseSearchHtml(htmlText);
      }
    }
  } catch (tier3Error) {
    console.warn(`[Tier 3 HTML Failed]: ${tier3Error.message}`);
  }

  // --- TIER 4: Challenge Cloudflare bloquant (Signalement UI) ---
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("cloudflare-challenge-needed");
  }
  throw new Error("Protection Cloudflare active. Cliquez sur 'Connexion' en haut à droite pour valider votre session en 1 clic.");
}

const httpsKeepAliveAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 64,
  maxFreeSockets: 32,
  timeout: 10000,
});

const httpKeepAliveAgent = new http.Agent({
  keepAlive: true,
  maxSockets: 64,
  maxFreeSockets: 32,
  timeout: 10000,
});

function fetchHttpBuffer(url, timeoutMs = 6000, abortSignal) {
  return new Promise((resolve, reject) => {
    if (abortSignal?.aborted) return reject(new Error("ABORTED"));
    let u;
    try {
      u = new URL(url);
    } catch (e) {
      return reject(e);
    }
    const client = u.protocol === "http:" ? http : https;
    const agent = u.protocol === "http:" ? httpKeepAliveAgent : httpsKeepAliveAgent;
    const req = client.get(
      url,
      {
        agent,
        headers: {
          "User-Agent": DEFAULT_USER_AGENT,
          Referer: "https://nhentai.net/",
          Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        },
      },
      (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          const loc = res.headers.location;
          if (loc) {
            return fetchHttpBuffer(loc, timeoutMs, abortSignal).then(resolve, reject);
          }
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode}`));
        }
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const buffer = Buffer.concat(chunks);
          if (buffer.length < 100) return reject(new Error("Empty/corrupted buffer"));
          resolve({ buffer, finalUrl: url });
        });
        res.on("error", reject);
      }
    );
    req.on("error", reject);
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      reject(new Error(`Timeout on ${url}`));
    });
    if (abortSignal) {
      abortSignal.addEventListener("abort", () => {
        req.destroy();
        reject(new Error("ABORTED"));
      });
    }
  });
}

// Resilient Ultra-Fast Multi-Mirror Downloader (8 MB/s - 20 MB/s direct Gigabit speed with Photon CDN fallback)
async function downloadImageBufferWithFallback(url, referer, cookies, apiKey, abortSignal) {
  if (abortSignal?.aborted) throw new Error("ABORTED");

  let path = cleanCdnPath(url);
  if (/^https?:\/\//i.test(path)) {
    try {
      const u = new URL(path);
      path = u.pathname.replace(/^\//, "");
    } catch {}
  }
  path = cleanCdnPath(path);

  const isThumb = path.includes("thumb") || path.includes("cover") || /t\.[a-z]+$/i.test(path);
  const directHosts = isThumb
    ? ["t3.nhentai.net", "t2.nhentai.net", "t1.nhentai.net", "t4.nhentai.net"]
    : ["i3.nhentai.net", "i2.nhentai.net", "i1.nhentai.net", "i4.nhentai.net"];

  const candidateUrls = [
    // 1. Direct Gigabit CDN Numbered Hosts (Ultra-Fast 8000-15000 KB/s with Keep-Alive Agent)
    `https://${directHosts[0]}/${path}`,
    `https://${directHosts[1]}/${path}`,
    `https://${directHosts[2]}/${path}`,
    `https://${directHosts[3]}/${path}`,
    url,
    // 2. Photon Edge CDN Fallback (if direct IPs are blocked without DoH)
    `https://i0.wp.com/${directHosts[0]}/${path}`,
    `https://i1.wp.com/${directHosts[1]}/${path}`,
    `https://i2.wp.com/${directHosts[2]}/${path}`,
    // 3. DuckDuckGo Proxy Fallback
    `https://external-content.duckduckgo.com/iu/?u=${encodeURIComponent(`https://${directHosts[0]}/${path}`)}`,
  ];

  for (const candidate of candidateUrls) {
    if (abortSignal?.aborted) throw new Error("ABORTED");
    try {
      const res = await fetchHttpBuffer(candidate, 5000, abortSignal);
      if (res && res.buffer && res.buffer.length > 300) {
        return res;
      }
    } catch (e) {
      if (abortSignal?.aborted) throw new Error("ABORTED");
    }
  }

  throw new Error(`Échec de récupération de l'image depuis tous les miroirs (${url})`);
}

function createMainWindow() {
  Menu.setApplicationMenu(null);

  mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 1024,
    minHeight: 680,
    title: "nHentai Launcher & Downloader",
    backgroundColor: "#0c0c10",
    icon: path.join(__dirname, "../public/tauri.svg"),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
    },
  });

  const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL("http://localhost:1420");
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
    if (backgroundBypassWindow) {
      try { backgroundBypassWindow.close(); } catch {}
      backgroundBypassWindow = null;
    }
  });
}

// Smart LRU Memory Cache for Search & Details (Eliminates repeated requests & rate limits)
const apiDataCache = new Map();
const API_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function getCachedApiData(key) {
  const item = apiDataCache.get(key);
  if (!item) return null;
  if (Date.now() - item.timestamp > API_CACHE_TTL_MS) {
    apiDataCache.delete(key);
    return null;
  }
  return item.data;
}

function setCachedApiData(key, data) {
  if (!data) return;
  // Anti-poisoning: Never cache empty results to prevent caching temporary scrape/network failures
  if (Array.isArray(data.result) && data.result.length === 0) return;
  if (apiDataCache.size > 300) {
    const oldest = apiDataCache.keys().next().value;
    apiDataCache.delete(oldest);
  }
  apiDataCache.set(key, { data, timestamp: Date.now() });
}

// Navigation Mutex Queue for Background Browser Window
let bypassQueue = Promise.resolve();

async function executeInBrowserSession(url, script) {
  return new Promise((resolve, reject) => {
    bypassQueue = bypassQueue.then(async () => {
      try {
        if (!backgroundBypassWindow || backgroundBypassWindow.isDestroyed()) {
          backgroundBypassWindow = new BrowserWindow({
            show: false,
            width: 1280,
            height: 900,
            webPreferences: {
              nodeIntegration: false,
              contextIsolation: true,
              webSecurity: false,
            },
          });
        }

        const loadPromise = backgroundBypassWindow.loadURL(url);
        const timeoutPromise = new Promise((_, rej) => setTimeout(() => rej(new Error("Navigation Timeout")), 6000));
        try {
          await Promise.race([loadPromise, timeoutPromise]);
        } catch (navErr) {
          console.warn(`[🌐 Browser Navigation] ${url}: ${navErr.message}`);
        }

        // Wait 300ms for dynamic DOM rendering
        await new Promise((r) => setTimeout(r, 300));
        const result = await backgroundBypassWindow.webContents.executeJavaScript(script);
        resolve(result);
      } catch (err) {
        reject(err);
      }
    }).catch((err) => {
      reject(err);
    });
  });
}

function formatNhentaiSearchQueryForWeb(cleanQuery) {
  if (!cleanQuery) return "";
  const tokens = cleanQuery.trim().match(/(?:[^\s"]+|"[^"]*")+/g) || [];
  return tokens
    .map((t) => {
      if (t.startsWith('"') && t.endsWith('"')) {
        return `"${encodeURIComponent(t.slice(1, -1))}"`;
      }
      return encodeURIComponent(t);
    })
    .join("+");
}

// Build standard nHentai search web URL (converts spaces outside quotes to +)
function buildNhentaiSearchWebUrl(query, sort, page) {
  const pageNum = Math.max(1, page || 1);
  let sortParam = "";
  // nHentai web search only supports popular sorting for the first 5 pages; fallback to standard date order beyond page 5
  if (pageNum <= 5) {
    if (sort === "popular-today") sortParam = "&sort=popular-today";
    else if (sort === "popular-week") sortParam = "&sort=popular-week";
    else if (sort === "popular" || sort === "popular-all") sortParam = "&sort=popular";
  }

  const cleanQuery = (query || "").trim();
  if (!cleanQuery) {
    return `https://nhentai.net/?page=${pageNum}${sortParam}`;
  }

  const queryPart = formatNhentaiSearchQueryForWeb(cleanQuery);
  return `https://nhentai.net/search/?q=${queryPart}&page=${pageNum}${sortParam}`;
}

// Scrape search result directly from HTML when API v2 is rate limited (HTTP 429)
async function scrapeSearchViaBrowser(query, sort, page) {
  const pageNum = Math.max(1, page || 1);
  let url = buildNhentaiSearchWebUrl(query, sort, pageNum);

  const script = `
    (() => {
      const items = Array.from(document.querySelectorAll(".gallery, .container .gallery, a[href^='/g/']"));
      const results = [];
      const seen = new Set();

      items.forEach(item => {
        const a = item.matches("a[href^='/g/']") ? item : item.querySelector("a.cover, a[href^='/g/']");
        if (!a) return;
        const href = a.getAttribute("href") || "";
        const match = href.match(/\\/g\\/(\\d+)\\/?/);
        const id = match ? parseInt(match[1], 10) : 0;
        if (!id || seen.has(id)) return;
        seen.add(id);

        const caption = item.querySelector(".caption, .title") || a.querySelector(".caption, .title");
        let title = caption ? caption.textContent.trim() : "";
        if (!title || title.length < 2) title = "Gallery #" + id;

        const img = item.querySelector("img") || a.querySelector("img");
        const thumbSrc = img ? (img.getAttribute("data-src") || img.getAttribute("data-original") || img.src || "") : "";
        
        let mediaId = "";
        const mediaMatch = thumbSrc.match(/\\/galleries\\/(\\d+)\\//);
        if (mediaMatch) {
          mediaId = mediaMatch[1];
        } else {
          mediaId = String(id);
        }

        let ext = "j";
        if (thumbSrc.endsWith(".png")) ext = "p";
        else if (thumbSrc.endsWith(".webp")) ext = "w";
        else if (thumbSrc.endsWith(".jpg") || thumbSrc.endsWith(".jpeg")) ext = "j";

        const coverPath = "galleries/" + mediaId + "/thumb." + (ext === "j" ? "jpg" : ext === "p" ? "png" : "webp");

        results.push({
          id,
          media_id: mediaId,
          title: {
            pretty: title,
            english: title,
            japanese: ""
          },
          thumbnail: {
            path: coverPath,
            width: 250,
            height: 350,
            t: ext
          },
          cover: {
            path: coverPath,
            width: 250,
            height: 350,
            t: ext
          },
          num_pages: 20,
          tags: []
        });
      });

      const lastPageLink = document.querySelector(".pagination a.last, .pagination a[href*='page=']:last-child");
      const pageCount = lastPageLink ? parseInt(lastPageLink.href.match(/page=(\\d+)/)?.[1] || "1", 10) : 1;

      return { results, pageCount };
    })()
  `;

  let { results, pageCount } = await executeInBrowserSession(url, script);

  // Automatic Fallback: if popular returned 0 results on page > 1, try standard date sort
  if ((!results || results.length === 0) && pageNum > 1 && url.includes("&sort=")) {
    const fallbackUrl = buildNhentaiSearchWebUrl(query, "", pageNum);
    const fallbackRes = await executeInBrowserSession(fallbackUrl, script);
    if (fallbackRes && fallbackRes.results && fallbackRes.results.length > 0) {
      results = fallbackRes.results;
      pageCount = fallbackRes.pageCount || pageCount;
    }
  }

  return {
    result: (results || []).map(normalizeGallery),
    num_pages: pageCount || 1,
    per_page: 25,
  };
}

// Scrape full gallery details directly from HTML when API v2 is rate limited (HTTP 429)
async function scrapeGalleryDetailsViaBrowser(id) {
  const url = `https://nhentai.net/g/${id}/`;
  const script = `
    (() => {
      const id = ${id};
      const titlePretty = document.querySelector("#info h1 .pretty")?.textContent?.trim() ||
                          document.querySelector("#info h1")?.textContent?.trim() || "";
      const titleEng = document.querySelector("#info h1")?.textContent?.trim() || "";
      const titleJp = document.querySelector("#info h2")?.textContent?.trim() || "";

      const coverImg = document.querySelector("#cover img");
      const coverSrc = coverImg ? (coverImg.getAttribute("data-src") || coverImg.getAttribute("data-original") || coverImg.src || "") : "";
      const mediaMatch = coverSrc.match(/\\/galleries\\/(\\d+)\\//);
      const mediaId = mediaMatch ? mediaMatch[1] : String(id);
      const coverExt = coverSrc.endsWith(".png") ? "p" : coverSrc.endsWith(".jpg") ? "j" : "w";
      const coverPath = "galleries/" + mediaId + "/thumb." + (coverExt === "j" ? "jpg" : coverExt === "p" ? "png" : "webp");

      const tags = [];
      document.querySelectorAll(".tag-container").forEach(container => {
        const typeText = container.childNodes[0]?.textContent?.trim()?.replace(":", "")?.toLowerCase() || "";
        const tagType = typeText.includes("tag") ? "tag" :
                        typeText.includes("artist") ? "artist" :
                        typeText.includes("group") ? "group" :
                        typeText.includes("language") ? "language" :
                        typeText.includes("category") ? "category" :
                        typeText.includes("parody") ? "parody" :
                        typeText.includes("character") ? "character" : "tag";

        container.querySelectorAll("a.tag, a.tagchip").forEach(a => {
          const nameSpan = a.querySelector(".name");
          const countSpan = a.querySelector(".count");
          let name = nameSpan ? nameSpan.textContent.trim() : a.textContent.trim();
          let count = countSpan ? parseInt(countSpan.textContent.replace(/[^0-9]/g, ""), 10) || 0 : 0;
          if (name) {
            tags.push({
              id: Math.floor(Math.random() * 100000),
              type: tagType,
              name,
              url: a.getAttribute("href") || "",
              count
            });
          }
        });
      });

      const thumbContainers = document.querySelectorAll(".thumb-container");
      const pages = [];
      thumbContainers.forEach((tc, idx) => {
        const img = tc.querySelector("img");
        const tSrc = img ? (img.getAttribute("data-src") || img.getAttribute("data-original") || img.src || "") : "";
        const pageNum = idx + 1;
        const ext = tSrc.endsWith(".png") ? "p" : tSrc.endsWith(".jpg") ? "j" : "w";
        pages.push({
          number: pageNum,
          t: ext,
          path: "galleries/" + mediaId + "/" + pageNum + "." + (ext === "j" ? "jpg" : ext === "p" ? "png" : "webp"),
          thumbnail: "galleries/" + mediaId + "/" + pageNum + "t." + (ext === "j" ? "jpg" : ext === "p" ? "png" : "webp"),
          width: 1280,
          height: 1800
        });
      });

      return {
        id,
        media_id: mediaId,
        title: {
          pretty: titlePretty || titleEng || "Gallery #" + id,
          english: titleEng,
          japanese: titleJp
        },
        num_pages: pages.length || 1,
        images: {
          pages,
          cover: {
            path: coverPath,
            t: coverExt,
            width: 350,
            height: 500
          },
          thumbnail: {
            path: coverPath,
            t: coverExt,
            width: 250,
            height: 350
          }
        },
        tags,
        num_favorites: 0
      };
    })()
  `;

  const rawData = await executeInBrowserSession(url, script);
  return normalizeGallery(rawData);
}

// IPC Handlers using API v2 with automatic fallback
ipcMain.handle("search-galleries", async (_event, { query, sort, page, cookies, apiKey }) => {
  const cleanQuery = (query || "").trim();
  const pageNum = Math.max(1, page || 1);
  const cacheKey = `search:${cleanQuery}:${sort}:${pageNum}`;

  const cached = getCachedApiData(cacheKey);
  if (cached) {
    console.log(`[🧠 CACHE] Recherche "${cleanQuery || '*'}" (page ${pageNum}) -> ${cached.result.length} résultats (0ms)`);
    return cached;
  }

  let sortParam = "";
  if (sort === "popular-today") sortParam = "&sort=popular-today";
  else if (sort === "popular-week") sortParam = "&sort=popular-week";
  else if (sort === "popular" || sort === "popular-all") sortParam = "&sort=popular";

  let url = "";
  if (!cleanQuery) {
    url = `https://nhentai.net/api/v2/galleries?page=${pageNum}${sortParam}`;
  } else {
    url = `https://nhentai.net/api/v2/search?query=${encodeURIComponent(cleanQuery)}&page=${pageNum}${sortParam}`;
  }

  try {
    const data = await fetchNhentai(url, cookies, apiKey);
    const rawList = data?.result || [];
    const resultObj = {
      result: rawList.map(normalizeGallery),
      num_pages: data?.num_pages || Math.ceil((data?.total || rawList.length) / 25) || 1,
      per_page: data?.per_page || 25,
    };
    setCachedApiData(cacheKey, resultObj);
    console.log(`[🔍 API v2] Recherche "${cleanQuery || '*'}" (page ${pageNum}) -> ${resultObj.result.length} résultats (${resultObj.num_pages} pages dispo)`);
    return resultObj;
  } catch (err) {
    console.warn(`[🌐 BROWSER FALLBACK] API v2 indisponible (${err.message}), bascule sur Chromium scraping...`);
    try {
      const scraped = await scrapeSearchViaBrowser(cleanQuery, sort, pageNum);
      setCachedApiData(cacheKey, scraped);
      console.log(`[🌐 BROWSER SCRAPING] Recherche "${cleanQuery || '*'}" (page ${pageNum}) -> ${scraped.result.length} résultats extraits avec succès !`);
      return scraped;
    } catch (scrapeErr) {
      console.error(`[❌ ERREUR RECHERCHE] Échec de scraping: ${scrapeErr.message}`);
      throw new Error(`Erreur nHentai: ${err.message}`);
    }
  }
});

ipcMain.handle("get-gallery", async (_event, { id, cookies, apiKey }) => {
  const cacheKey = `gallery:${id}`;
  const cached = getCachedApiData(cacheKey);
  if (cached) {
    console.log(`[🧠 CACHE] Fiche Manga #${id} -> "${cached.title?.pretty || id}" (0ms)`);
    return cached;
  }

  const url = `https://nhentai.net/api/v2/galleries/${id}`;
  try {
    const data = await fetchNhentai(url, cookies, apiKey);
    const normalized = normalizeGallery(data);
    setCachedApiData(cacheKey, normalized);
    console.log(`[📖 API v2] Manga #${id} -> "${normalized.title?.pretty || id}" (${normalized.num_pages} pages, ${normalized.tags?.length || 0} tags)`);
    return normalized;
  } catch (err) {
    console.warn(`[🌐 BROWSER FALLBACK] Fiche #${id} API v2 (${err.message}), extraction Chromium...`);
    try {
      const scraped = await scrapeGalleryDetailsViaBrowser(id);
      setCachedApiData(cacheKey, scraped);
      console.log(`[🌐 BROWSER SCRAPING] Manga #${id} -> "${scraped.title?.pretty || id}" (${scraped.num_pages} pages extraites)`);
      return scraped;
    } catch (scrapeErr) {
      console.error(`[❌ ERREUR MANGA] #${id} échec: ${scrapeErr.message}`);
      throw new Error(`Erreur nHentai: ${err.message}`);
    }
  }
});

ipcMain.handle("get-random-gallery", async (_event, { cookies, apiKey }) => {
  const randomPage = Math.floor(Math.random() * 50) + 1;
  const url = `https://nhentai.net/api/v2/galleries?page=${randomPage}&sort=popular`;
  try {
    const data = await fetchNhentai(url, cookies, apiKey);
    const list = data?.result || [];
    if (list.length > 0) {
      const randomIndex = Math.floor(Math.random() * list.length);
      const chosen = list[randomIndex];
      const fullUrl = `https://nhentai.net/api/v2/galleries/${chosen.id}`;
      const fullData = await fetchNhentai(fullUrl, cookies, apiKey);
      const norm = normalizeGallery(fullData);
      console.log(`[🎲 ALÉATOIRE] Manga #${norm.id} sélectionné -> "${norm.title?.pretty || norm.id}"`);
      return norm;
    }
  } catch (err) {
    const scraped = await scrapeSearchViaBrowser("", "popular", randomPage);
    if (scraped.result && scraped.result.length > 0) {
      const randomIndex = Math.floor(Math.random() * scraped.result.length);
      const norm = scraped.result[randomIndex];
      console.log(`[🎲 ALÉATOIRE SCRAPING] Manga #${norm.id} sélectionné -> "${norm.title?.pretty || norm.id}"`);
      return norm;
    }
  }
  throw new Error("Impossible de trouver une galerie aléatoire");
});

// Scrape tags directly from HTML when API v2 is rate limited (HTTP 429)
async function scrapeTagsViaBrowser(tagType, sort, page) {
  const urlType = tagType === "parody" ? "parodies" : tagType === "group" ? "groups" : tagType === "artist" ? "artists" : tagType === "character" ? "characters" : "tags";
  const s = sort === "name" || sort === "alpha" ? "name" : "popular";
  const url = `https://nhentai.net/${urlType}/?page=${page}&sort=${s}`;
  
  const script = `
    (() => {
      const items = Array.from(document.querySelectorAll("a")).filter(a => {
        const href = a.getAttribute("href") || "";
        return href.includes("/" + "${tagType}" + "/") || a.classList.contains("tag") || a.classList.contains("tagchip");
      });
      const result = [];
      const seen = new Set();
      items.forEach(a => {
        const fullText = a.textContent?.trim() || "";
        const href = a.getAttribute("href") || "";
        if (!href || seen.has(href)) return;
        seen.add(href);

        const nameSpan = a.querySelector(".name");
        const countSpan = a.querySelector(".count");
        let name = nameSpan ? nameSpan.textContent.trim() : "";
        let count = countSpan ? parseInt(countSpan.textContent.replace(/[^0-9]/g, ""), 10) || 0 : 0;

        if (!name) {
          const match = fullText.match(/^(.+?)(?:\\s+([\\d\\.]+[kKmM]?))?$/);
          if (match) {
            name = match[1].trim();
            const countStr = match[2] || "0";
            if (countStr.toLowerCase().endsWith("k")) {
              count = Math.round(parseFloat(countStr) * 1000);
            } else if (countStr.toLowerCase().endsWith("m")) {
              count = Math.round(parseFloat(countStr) * 1000000);
            } else {
              count = parseInt(countStr, 10) || 0;
            }
          } else {
            name = fullText;
          }
        }

        if (name && name !== "Sort by" && !name.includes("nHentai")) {
          result.push({
            id: Math.floor(Math.random() * 1000000),
            name,
            type: "${tagType}",
            url: href,
            count
          });
        }
      });
      const lastPageLink = document.querySelector(".pagination a.last, a[href*='page=']");
      const num_pages = lastPageLink ? parseInt(lastPageLink.href.match(/page=(\\d+)/)?.[1] || "1", 10) : 1;
      return { result, num_pages };
    })()
  `;
  const data = await executeInBrowserSession(url, script);
  return {
    result: data.result || [],
    num_pages: data.num_pages || 1,
    per_page: 100,
    page,
  };
}

const tagCache = new Map();
const TAG_CACHE_TTL = 3600000; // 1 hour

ipcMain.handle("get-tags", async (_event, { tagType, sort, page, cookies, apiKey }) => {
  const tType = tagType === "series" ? "parody" : tagType === "groups" ? "group" : tagType === "artists" ? "artist" : tagType === "characters" ? "character" : tagType === "tags" ? "tag" : tagType;
  const s = sort === "alpha" ? "name" : "popular";
  const p = Math.max(1, page || 1);
  const cacheKey = `${tType}_${s}_${p}`;

  const cached = tagCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < TAG_CACHE_TTL) {
    return cached.data;
  }

  const url = `https://nhentai.net/api/v2/tags/${tType}?sort=${s}&page=${p}&per_page=100`;
  try {
    const data = await fetchNhentai(url, cookies, apiKey);
    const res = {
      result: data?.result || [],
      num_pages: data?.num_pages || 1,
      per_page: data?.per_page || 100,
      page: p,
    };
    tagCache.set(cacheKey, { data: res, timestamp: Date.now() });
    console.log(`[🏷️ TAGS API] Catégorie "${tType}" (tri: ${s}, page ${p}) -> ${res.result.length} éléments chargés`);
    return res;
  } catch (err) {
    console.warn(`[🌐 BROWSER FALLBACK] Tags "${tType}" API v2 indisponible, extraction Chromium...`);
    try {
      const scraped = await scrapeTagsViaBrowser(tType, s, p);
      tagCache.set(cacheKey, { data: scraped, timestamp: Date.now() });
      console.log(`[🌐 BROWSER SCRAPING] Tags "${tType}" -> ${scraped.result.length} éléments extraits !`);
      return scraped;
    } catch (scrapeErr) {
      console.error(`[❌ ERREUR TAGS] Échec: ${scrapeErr.message}`);
      throw new Error(`Erreur nHentai: ${err.message}`);
    }
  }
});

let dynamicCdnConfig = {
  image_servers: ["https://i1.nhentai.net", "https://i2.nhentai.net", "https://i3.nhentai.net", "https://i4.nhentai.net"],
  thumb_servers: ["https://t1.nhentai.net", "https://t2.nhentai.net", "https://t3.nhentai.net", "https://t4.nhentai.net"],
};

async function fetchCdnConfig() {
  try {
    const cfg = await fetchNhentai("https://nhentai.net/api/v2/config");
    if (cfg && Array.isArray(cfg.image_servers) && cfg.image_servers.length > 0) {
      dynamicCdnConfig.image_servers = cfg.image_servers.map((s) => String(s).replace(/\/$/, ""));
    }
    if (cfg && Array.isArray(cfg.thumb_servers) && cfg.thumb_servers.length > 0) {
      dynamicCdnConfig.thumb_servers = cfg.thumb_servers.map((s) => String(s).replace(/\/$/, ""));
    }
    console.log("[🌐 CDN CONFIG] Dynamic mirrors loaded:", dynamicCdnConfig);
  } catch (e) {
    console.warn("[🌐 CDN CONFIG] Using default fallback mirrors");
  }
}

ipcMain.handle("get-cdn-config", async () => {
  return dynamicCdnConfig;
});

ipcMain.handle("get-gallery-comments", async (_event, { galleryId, cookies, apiKey }) => {
  try {
    const url = `https://nhentai.net/api/v2/galleries/${galleryId}/comments`;
    const data = await fetchNhentai(url, cookies, apiKey);
    return Array.isArray(data) ? data : data?.result || data?.comments || [];
  } catch (err) {
    console.warn(`[💬 Comments] Failed to fetch comments for #${galleryId}:`, err.message);
    return [];
  }
});

ipcMain.handle("get-default-settings", async () => {
  const downloadDir = path.join(os.homedir(), "Downloads", "nHentai Downloads");
  return {
    download_directory: downloadDir,
    naming_pattern: "[{id}] [{artist}] {title} ({language})",
    default_format: "cbz",
    concurrent_downloads: 2,
    concurrent_images_per_gallery: 4,
    blacklisted_tags: ["scat", "guro"],
    cookies: "",
    api_key: DEFAULT_API_KEY,
  };
});

ipcMain.handle("select-download-directory", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory", "createDirectory"],
  });
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

ipcMain.handle("format-filename-preview", async (_event, { pattern, gallery }) => {
  return formatFilename(pattern, gallery);
});

ipcMain.handle("log-terminal", async (_event, { text }) => {
  if (text) console.log(text);
  return true;
});

ipcMain.handle("cancel-download", async (_event, params) => {
  const targetId = params?.galleryId || params?.id || (typeof params === "number" ? params : null);
  if (targetId) {
    const controller = activeDownloads.get(targetId) || activeDownloads.get(Number(targetId));
    if (controller) {
      controller.abort();
      activeDownloads.delete(targetId);
      activeDownloads.delete(Number(targetId));
      console.log(`[🛑 TÉLÉCHARGEMENT ANNULÉ] #${targetId}`);
    }
  }
  return true;
});

ipcMain.handle("open-folder", async (_event, { targetPath }) => {
  if (!targetPath) return;
  if (fs.existsSync(targetPath)) {
    shell.showItemInFolder(targetPath);
  } else {
    const parent = path.dirname(targetPath);
    if (fs.existsSync(parent)) {
      shell.openPath(parent);
    }
  }
});

ipcMain.handle("scan-local-library", async (_event, { directoryPath }) => {
  const dir = directoryPath || path.join(os.homedir(), "Downloads", "nHentai Downloads");
  if (!fs.existsSync(dir)) return [];

  const results = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      try {
        const stats = fs.statSync(fullPath);
        const isCbz = entry.isFile() && entry.name.toLowerCase().endsWith(".cbz");
        const isZip = entry.isFile() && entry.name.toLowerCase().endsWith(".zip");
        const isDir = entry.isDirectory();

        if (isCbz || isZip || isDir) {
          const match = entry.name.match(/\[(\d{4,8})\]/) || entry.name.match(/#?(\d{5,8})/);
          const galleryId = match ? parseInt(match[1], 10) : undefined;
          const format = isCbz ? "cbz" : isZip ? "zip" : "folder";

          let rawTitle = entry.name.replace(/\.(cbz|zip)$/i, "");
          let artist = null;
          let pagesCount = 0;
          let coverDataUrl = null;
          let detectedLang = null;

          // Try reading metadata and cover directly from inside CBZ/ZIP archive
          if (isCbz || isZip) {
            try {
              const zip = new AdmZip(fullPath);
              const zipEntries = zip.getEntries();
              
              // 1. ComicInfo.xml metadata
              const comicInfoEntry = zipEntries.find((e) => e.entryName.toLowerCase() === "comicinfo.xml");
              if (comicInfoEntry) {
                const xmlStr = zip.readAsText(comicInfoEntry);
                const pencillerMatch = xmlStr.match(/<Penciller>(.*?)<\/Penciller>/);
                const writerMatch = xmlStr.match(/<Writer>(.*?)<\/Writer>/);
                const titleMatch = xmlStr.match(/<Title>(.*?)<\/Title>/);
                artist = pencillerMatch ? pencillerMatch[1].trim() : writerMatch ? writerMatch[1].trim() : null;
                if (titleMatch && titleMatch[1]) rawTitle = titleMatch[1].trim();
              }

              // 2. Extract First Image (Cover)
              const imgEntries = zipEntries
                .filter((e) => e.entryName.match(/\.(jpg|jpeg|png|webp)$/i))
                .sort((a, b) => a.entryName.localeCompare(b.entryName));
              
              pagesCount = imgEntries.length;
              if (imgEntries.length > 0) {
                const firstImg = imgEntries[0];
                const buf = zip.readFile(firstImg);
                if (buf && buf.length > 0) {
                  const mime = firstImg.entryName.endsWith(".png")
                    ? "image/png"
                    : firstImg.entryName.endsWith(".webp")
                    ? "image/webp"
                    : "image/jpeg";
                  coverDataUrl = `data:${mime};base64,${buf.toString("base64")}`;
                }
              }
            } catch (zipErr) {
              console.warn(`[Scan Library] Notice reading archive ${entry.name}:`, zipErr.message);
            }
          } else if (isDir) {
            // Folder format: inspect files inside
            try {
              const subEntries = fs.readdirSync(fullPath);
              const imgFiles = subEntries
                .filter((f) => f.match(/\.(jpg|jpeg|png|webp)$/i))
                .sort((a, b) => a.localeCompare(b));
              pagesCount = imgFiles.length;
              if (imgFiles.length > 0) {
                const firstImgPath = path.join(fullPath, imgFiles[0]);
                const buf = fs.readFileSync(firstImgPath);
                const mime = imgFiles[0].endsWith(".png")
                  ? "image/png"
                  : imgFiles[0].endsWith(".webp")
                  ? "image/webp"
                  : "image/jpeg";
                coverDataUrl = `data:${mime};base64,${buf.toString("base64")}`;
              }
            } catch (dirErr) {}
          }

          // Fallback artist extraction from title
          if (!artist || artist.toLowerCase() === "unknown" || artist.toLowerCase() === "unknown artist") {
            artist = extractArtistFromTitle(rawTitle) || extractArtistFromTitle(entry.name);
          }

          // Language deduction
          const rawLower = (rawTitle + " " + entry.name).toLowerCase();
          if (rawLower.includes("[english]") || rawLower.includes("(english)")) detectedLang = "ENGLISH";
          else if (rawLower.includes("[french]") || rawLower.includes("(french)")) detectedLang = "FRENCH";
          else if (rawLower.includes("[chinese]") || rawLower.includes("(chinese)")) detectedLang = "CHINESE";
          else if (rawLower.includes("[spanish]") || rawLower.includes("(spanish)")) detectedLang = "SPANISH";
          else detectedLang = "JAPANESE";

          results.push({
            filename: entry.name,
            filePath: fullPath,
            sizeBytes: stats.size,
            modifiedAt: Math.floor(stats.mtimeMs),
            isCbz,
            isFolder: isDir,
            galleryId,
            title: rawTitle,
            artist: artist || "Artiste Inconnu",
            language: detectedLang,
            pagesCount,
            coverDataUrl,
          });
        }
      } catch (e) {}
    }
  } catch (e) {
    console.error("Error reading library directory:", e);
  }
  return results;
});

// Read and unpack local CBZ, ZIP, or Folder for offline built-in reader
ipcMain.handle("read-local-book", async (_event, { filePath }) => {
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error("Fichier introuvable sur le disque");
  }

  const stat = fs.statSync(filePath);
  const isCbz = stat.isFile() && filePath.toLowerCase().endsWith(".cbz");
  const isZip = stat.isFile() && filePath.toLowerCase().endsWith(".zip");
  const isDir = stat.isDirectory();
  const filename = path.basename(filePath);
  let rawTitle = filename.replace(/\.(cbz|zip)$/i, "");
  let artist = null;

  const pages = [];

  if (isCbz || isZip) {
    const zip = new AdmZip(filePath);
    const zipEntries = zip.getEntries();

    // Check ComicInfo.xml metadata
    const comicInfoEntry = zipEntries.find((e) => e.entryName.toLowerCase() === "comicinfo.xml");
    if (comicInfoEntry) {
      try {
        const xmlStr = zip.readAsText(comicInfoEntry);
        const pencillerMatch = xmlStr.match(/<Penciller>(.*?)<\/Penciller>/);
        const writerMatch = xmlStr.match(/<Writer>(.*?)<\/Writer>/);
        const titleMatch = xmlStr.match(/<Title>(.*?)<\/Title>/);
        artist = pencillerMatch ? pencillerMatch[1].trim() : writerMatch ? writerMatch[1].trim() : null;
        if (titleMatch && titleMatch[1]) rawTitle = titleMatch[1].trim();
      } catch (e) {}
    }

    const imgEntries = zipEntries
      .filter((e) => e.entryName.match(/\.(jpg|jpeg|png|webp|gif)$/i))
      .sort((a, b) => a.entryName.localeCompare(b.entryName, undefined, { numeric: true, sensitivity: "base" }));

    imgEntries.forEach((entry, idx) => {
      const buf = zip.readFile(entry);
      if (buf && buf.length > 0) {
        const ext = entry.entryName.toLowerCase();
        const mime = ext.endsWith(".png")
          ? "image/png"
          : ext.endsWith(".webp")
          ? "image/webp"
          : ext.endsWith(".gif")
          ? "image/gif"
          : "image/jpeg";
        pages.push({
          number: idx + 1,
          name: path.basename(entry.entryName),
          dataUrl: `data:${mime};base64,${buf.toString("base64")}`,
        });
      }
    });
  } else if (isDir) {
    const subEntries = fs.readdirSync(filePath);
    const imgFiles = subEntries
      .filter((f) => f.match(/\.(jpg|jpeg|png|webp|gif)$/i))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));

    imgFiles.forEach((file, idx) => {
      const fullPath = path.join(filePath, file);
      const buf = fs.readFileSync(fullPath);
      const ext = file.toLowerCase();
      const mime = ext.endsWith(".png")
        ? "image/png"
        : ext.endsWith(".webp")
        ? "image/webp"
        : ext.endsWith(".gif")
        ? "image/gif"
        : "image/jpeg";
      pages.push({
        number: idx + 1,
        name: file,
        dataUrl: `data:${mime};base64,${buf.toString("base64")}`,
      });
    });
  }

  if (!artist || artist.toLowerCase() === "unknown" || artist.toLowerCase() === "unknown artist") {
    artist = extractArtistFromTitle(rawTitle) || extractArtistFromTitle(filename);
  }

  return {
    title: rawTitle,
    artist: artist || "Artiste Inconnu",
    format: isCbz ? "cbz" : isZip ? "zip" : "folder",
    filePath,
    totalPages: pages.length,
    pages,
  };
});

ipcMain.handle("get-downloaded-ids", async (_event, { directoryPath }) => {
  const dir = directoryPath || path.join(os.homedir(), "Downloads", "nHentai Downloads");
  if (!fs.existsSync(dir)) return [];
  const ids = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const isCbz = entry.isFile() && entry.name.toLowerCase().endsWith(".cbz");
      const isZip = entry.isFile() && entry.name.toLowerCase().endsWith(".zip");
      const isDir = entry.isDirectory();
      if (isCbz || isZip || isDir) {
        const match = entry.name.match(/\[(\d{4,8})\]/) || entry.name.match(/#?(\d{5,8})/);
        if (match) {
          ids.push(parseInt(match[1], 10));
        }
      }
    }
  } catch (e) {}
  return ids;
});

ipcMain.handle("open-auth-window", async () => {
  if (authWindow && !authWindow.isDestroyed()) {
    authWindow.focus();
    return;
  }

  authWindow = new BrowserWindow({
    width: 960,
    height: 760,
    title: "Guichet Cloudflare Turnstile & nHentai",
    backgroundColor: "#0c0c10",
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  authWindow.loadURL("https://nhentai.net/login/");

  const checkAndCaptureCookies = async () => {
    try {
      const cookies = await session.defaultSession.cookies.get({ domain: "nhentai.net" });
      const cookieStr = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
      if (
        cookieStr.includes("cf_clearance") ||
        cookieStr.includes("sessionid") ||
        cookieStr.includes("csrftoken") ||
        cookieStr.includes("refresh_token")
      ) {
        console.log("[🛡️ CLOUDFLARE COOKIES CAPTURED]", cookieStr);
        mainWindow?.webContents.send("cookies-captured", cookieStr);
      }
    } catch (e) {
      console.error("Error capturing cookies:", e);
    }
  };

  authWindow.webContents.on("did-navigate", checkAndCaptureCookies);
  authWindow.webContents.on("did-navigate-in-page", checkAndCaptureCookies);
  authWindow.webContents.on("did-finish-load", checkAndCaptureCookies);

  authWindow.on("closed", () => {
    authWindow = null;
  });
});

ipcMain.handle("update-dns-settings", async (_event, { dns_provider, enable_custom_dns, enable_doh }) => {
  try {
    const existing = loadStoredDnsSettings();
    const updated = {
      ...existing,
      dns_provider: dns_provider || "adguard",
      enable_custom_dns: enable_custom_dns !== false,
      enable_doh: enable_doh !== false,
    };
    fs.writeFileSync(settingsFilePath, JSON.stringify(updated, null, 2), "utf8");
    applyNodeDns(updated.dns_provider, updated.enable_custom_dns);
    console.log("[🛡️ DNS SETTINGS UPDATED]", updated);
    return { success: true };
  } catch (e) {
    console.error("[DNS SETTINGS ERROR]", e);
    return { success: false, error: e.message };
  }
});

// High-Performance In-Memory RAM Image Cache (Up to 400 pages stored in memory for 0ms access)
const imageRamCache = new Map();
const MAX_RAM_CACHE_ENTRIES = 400;

function addToRamCache(url, dataUrl) {
  if (imageRamCache.size >= MAX_RAM_CACHE_ENTRIES) {
    const oldestKey = imageRamCache.keys().next().value;
    imageRamCache.delete(oldestKey);
  }
  imageRamCache.set(url, { dataUrl, timestamp: Date.now() });
}

// Fetch single image data as base64 DataURL from RAM cache or direct HTTPS stream
ipcMain.handle("get-image-data", async (_event, { url, referer, cookies, apiKey }) => {
  if (!url) return null;
  if (imageRamCache.has(url)) {
    return imageRamCache.get(url).dataUrl;
  }
  try {
    const { buffer, finalUrl } = await downloadImageBufferWithFallback(url, referer, cookies, apiKey);
    const mime = finalUrl.endsWith(".png") ? "image/png" : finalUrl.endsWith(".jpg") || finalUrl.endsWith(".jpeg") ? "image/jpeg" : "image/webp";
    const dataUrl = `data:${mime};base64,${buffer.toString("base64")}`;
    addToRamCache(url, dataUrl);
    if (finalUrl !== url) addToRamCache(finalUrl, dataUrl);
    return dataUrl;
  } catch (err) {
    return null;
  }
});

// Preload a batch of gallery images in parallel into RAM cache in the background
ipcMain.handle("preload-gallery-images", async (_event, { urls, referer, cookies, apiKey }) => {
  if (!Array.isArray(urls) || urls.length === 0) return { preloaded: 0 };
  const uncachedUrls = urls.filter((u) => !imageRamCache.has(u));
  if (uncachedUrls.length === 0) return { preloaded: urls.length };

  const batchSize = 3;
  for (let i = 0; i < uncachedUrls.length; i += batchSize) {
    const batch = uncachedUrls.slice(i, i + batchSize);
    await Promise.allSettled(
      batch.map(async (u) => {
        try {
          const { buffer, finalUrl } = await downloadImageBufferWithFallback(u, referer, cookies, apiKey);
          const mime = finalUrl.endsWith(".png") ? "image/png" : finalUrl.endsWith(".jpg") || finalUrl.endsWith(".jpeg") ? "image/jpeg" : "image/webp";
          const dataUrl = `data:${mime};base64,${buffer.toString("base64")}`;
          addToRamCache(u, dataUrl);
          if (finalUrl !== u) addToRamCache(finalUrl, dataUrl);
        } catch (e) {}
      })
    );
    if (i + batchSize < uncachedUrls.length) {
      await new Promise((r) => setTimeout(r, 60));
    }
  }
  return { preloaded: urls.length };
});

ipcMain.handle("save-downloaded-archive", async (_event, { gallery, formatType, pattern, destDir, pagesData }) => {
  const saveStartTime = Date.now();
  const norm = normalizeGallery(gallery);
  const baseName = formatFilename(pattern, norm);
  const destination = destDir || path.join(os.homedir(), "Downloads", "nHentai Downloads");
  if (!fs.existsSync(destination)) {
    fs.mkdirSync(destination, { recursive: true });
  }

  let outputPath = "";
  if (formatType === "zip" || formatType === "cbz") {
    const ext = formatType === "cbz" ? ".cbz" : ".zip";
    outputPath = path.join(destination, `${baseName}${ext}`);
    const output = fs.createWriteStream(outputPath);
    // Use level 0 (Store) for maximum speed since images are already compressed
    const archive = createZipArchive({ zlib: { level: 0 }, store: true });

    await new Promise((resolve, reject) => {
      output.on("close", resolve);
      archive.on("error", reject);
      archive.pipe(output);

      if (formatType === "cbz") {
        const comicInfo = generateComicInfoXml(norm);
        archive.append(comicInfo, { name: "ComicInfo.xml" });
      }

      for (const img of pagesData) {
        const filename = `${String(img.pageNum).padStart(3, "0")}.${img.ext || "webp"}`;
        const buf = Buffer.from(img.bufferBase64, "base64");
        archive.append(buf, { name: filename });
      }

      archive.finalize();
    });
  } else {
    outputPath = path.join(destination, baseName);
    if (!fs.existsSync(outputPath)) {
      fs.mkdirSync(outputPath, { recursive: true });
    }
    for (const img of pagesData) {
      const filename = `${String(img.pageNum).padStart(3, "0")}.${img.ext || "webp"}`;
      const buf = Buffer.from(img.bufferBase64, "base64");
      fs.writeFileSync(path.join(outputPath, filename), buf);
    }
  }

  const durationMs = Date.now() - saveStartTime;
  console.log(`[💾 ARCHIVE ENREGISTRÉE] #${norm.id} -> ${path.basename(outputPath)} (${pagesData.length} planches, ${durationMs}ms)`);

  if (Notification.isSupported()) {
    const displayTitle = norm.title?.pretty || norm.title?.english || `Galerie #${norm.id}`;
    new Notification({
      title: "nHentai Launcher",
      body: `✅ Téléchargement terminé (${(formatType || "CBZ").toUpperCase()}) : ${displayTitle}`,
    }).show();
  }

  return outputPath;
});

// Start download engine with native Chromium streams
ipcMain.handle("start-download", async (event, { gallery, formatType, pattern, destDir, cookies, apiKey }) => {
  // If gallery doesn't have full pages details, fetch it first
  let fullGallery = gallery;
  if (!fullGallery.pages || fullGallery.pages.length === 0) {
    try {
      const url = `https://nhentai.net/api/v2/galleries/${gallery.id}`;
      const data = await fetchNhentai(url, cookies, apiKey);
      fullGallery = normalizeGallery(data);
    } catch (e) {
      console.warn("Could not fetch full gallery for download, using provided info:", e.message);
    }
  }

  const galleryId = fullGallery.id;
  const abortController = new AbortController();
  activeDownloads.set(galleryId, abortController);

  const baseName = formatFilename(pattern, fullGallery);
  const totalPages = fullGallery.num_pages || fullGallery.images?.pages?.length || 1;
  const destination = destDir || path.join(os.homedir(), "Downloads", "nHentai Downloads");

  if (!fs.existsSync(destination)) {
    fs.mkdirSync(destination, { recursive: true });
  }

  const sendProgress = (downloadedPages, speedKbS, status, error, targetPath) => {
    event.sender.send("download-progress", {
      id: galleryId,
      downloaded_pages: downloadedPages,
      total_pages: totalPages,
      progress: downloadedPages / totalPages,
      speed_kb_s: speedKbS || 0,
      status,
      error,
      target_path: targetPath,
    });
  };

  sendProgress(0, 0, "downloading", null, null);

  const startTime = Date.now();
  let downloadedBytes = 0;

  try {
    const pages = fullGallery.images?.pages || [];
    const downloadedImages = new Array(pages.length);
    let nextIdx = 0;
    let completedCount = 0;
    const concurrency = 4;

    async function downloadWorker() {
      while (nextIdx < pages.length) {
        if (abortController.signal.aborted) return;
        const i = nextIdx++;
        const pageNum = i + 1;
        const pageInfo = pages[i] || {};
        const ext = getExt(pageInfo.t);
        let imageUrl = "";

        if (pageInfo.path) {
          imageUrl = `https://i.nhentai.net/${pageInfo.path.replace(/^\//, "")}`;
        } else {
          imageUrl = `https://i.nhentai.net/galleries/${fullGallery.media_id}/${pageNum}.${ext}`;
        }

        const referer = `https://nhentai.net/g/${fullGallery.id}/`;
        const { buffer, finalUrl } = await downloadImageBufferWithFallback(imageUrl, referer, cookies, apiKey, abortController.signal);
        const resolvedExt = finalUrl.endsWith(".png") ? "png" : finalUrl.endsWith(".jpg") || finalUrl.endsWith(".jpeg") ? "jpg" : "webp";

        downloadedBytes += buffer.length;
        downloadedImages[i] = { pageNum, ext: resolvedExt, buffer };
        completedCount++;

        const elapsedSec = Math.max(0.1, (Date.now() - startTime) / 1000);
        const speedKbS = downloadedBytes / 1024 / elapsedSec;

        sendProgress(completedCount, speedKbS, "downloading", null, null);
      }
    }

    const workers = Array.from({ length: Math.min(concurrency, pages.length) }, () => downloadWorker());
    await Promise.all(workers);

    if (abortController.signal.aborted) {
      sendProgress(completedCount, 0, "cancelled", "Téléchargement annulé", null);
      activeDownloads.delete(galleryId);
      return null;
    }

    let outputPath = "";
    if (formatType === "zip" || formatType === "cbz") {
      const ext = formatType === "cbz" ? ".cbz" : ".zip";
      outputPath = path.join(destination, `${baseName}${ext}`);
      const output = fs.createWriteStream(outputPath);
      const archive = createZipArchive({ zlib: { level: 6 } });

      await new Promise((resolve, reject) => {
        output.on("close", resolve);
        archive.on("error", reject);
        archive.pipe(output);

        if (formatType === "cbz") {
          const comicInfo = generateComicInfoXml(fullGallery);
          archive.append(comicInfo, { name: "ComicInfo.xml" });
        }

        for (const img of downloadedImages) {
          if (img && img.buffer) {
            const filename = `${String(img.pageNum).padStart(3, "0")}.${img.ext}`;
            archive.append(img.buffer, { name: filename });
          }
        }

        archive.finalize();
      });
    } else {
      // Folder format
      outputPath = path.join(destination, baseName);
      if (!fs.existsSync(outputPath)) {
        fs.mkdirSync(outputPath, { recursive: true });
      }
      for (const img of downloadedImages) {
        if (img && img.buffer) {
          const filename = `${String(img.pageNum).padStart(3, "0")}.${img.ext}`;
          fs.writeFileSync(path.join(outputPath, filename), img.buffer);
        }
      }
    }

    sendProgress(totalPages, 0, "completed", null, outputPath);
    activeDownloads.delete(galleryId);

    if (Notification.isSupported()) {
      const displayTitle = fullGallery.title?.pretty || fullGallery.title?.english || `Galerie #${galleryId}`;
      new Notification({
        title: "nHentai Launcher",
        body: `✅ Téléchargement terminé (${formatType.toUpperCase()}) : ${displayTitle}`,
      }).show();
    }

    return outputPath;
  } catch (err) {
    if (abortController.signal.aborted) {
      sendProgress(0, 0, "cancelled", "Téléchargement annulé", null);
    } else {
      sendProgress(0, 0, "error", err.message || "Erreur de téléchargement", null);
    }
    activeDownloads.delete(galleryId);
    throw err;
  }
});

// =========================================================================
// ⚡ HIGH-SPEED WI-FI QUICK SHARE & ANDROID TRANSFER LOCAL HTTP SERVER
// =========================================================================
let quickShareServer = null;
let quickSharePort = 45678;
let activeClientsCount = 0;
let quickShareStartTime = null;
const quickShareCoverCache = new Map();

function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "127.0.0.1";
}

function getLocalDownloadDir(customDir) {
  return customDir || path.join(os.homedir(), "Downloads", "nHentai Downloads");
}

function getDownloadedFilesList(customDir) {
  const dir = getLocalDownloadDir(customDir);
  if (!fs.existsSync(dir)) return [];
  const list = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && (entry.name.toLowerCase().endsWith(".cbz") || entry.name.toLowerCase().endsWith(".zip"))) {
        const fullPath = path.join(dir, entry.name);
        try {
          const stats = fs.statSync(fullPath);
          const match = entry.name.match(/\[(\d{4,8})\]/) || entry.name.match(/#?(\d{5,8})/);
          const id = match ? parseInt(match[1], 10) : undefined;
          let title = entry.name.replace(/\.(cbz|zip)$/i, "");
          let artist = extractArtistFromTitle(title) || "";
          let pagesCount = 0;

          try {
            const zip = new AdmZip(fullPath);
            const zipEntries = zip.getEntries();
            const comicInfo = zipEntries.find((e) => e.entryName.toLowerCase() === "comicinfo.xml");
            if (comicInfo) {
              const xmlStr = zip.readAsText(comicInfo);
              const tMatch = xmlStr.match(/<Title>(.*?)<\/Title>/);
              const pMatch = xmlStr.match(/<Penciller>(.*?)<\/Penciller>/);
              if (tMatch && tMatch[1]) title = tMatch[1].trim();
              if (pMatch && pMatch[1]) artist = pMatch[1].trim();
            }
            const imgEntries = zipEntries.filter((e) => e.entryName.match(/\.(jpg|jpeg|png|webp)$/i));
            pagesCount = imgEntries.length;
          } catch {}

          list.push({
            id,
            filename: entry.name,
            title,
            artist,
            size: stats.size,
            sizeFormatted: `${(stats.size / (1024 * 1024)).toFixed(1)} MB`,
            pagesCount: pagesCount || 1,
            format: entry.name.toLowerCase().endsWith(".cbz") ? "cbz" : "zip",
            mtime: stats.mtimeMs,
          });
        } catch {}
      }
    }
  } catch (e) {
    console.warn("[Quick Share] Error scanning directory:", e.message);
  }
  return list.sort((a, b) => b.mtime - a.mtime);
}

function generateMobileWebClientHtml(ip, port) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>nHentai Quick Share - Transfert PC vers Android</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: #0c0c12;
      color: #e2e8f0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      padding-bottom: 60px;
      -webkit-tap-highlight-color: transparent;
    }
    header {
      position: sticky;
      top: 0;
      z-index: 100;
      background: rgba(18, 18, 28, 0.92);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid #27273a;
      padding: 12px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .logo-badge {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      background: linear-gradient(135deg, #ed2553, #f43f5e);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 900;
      font-size: 18px;
      color: #fff;
      box-shadow: 0 4px 12px rgba(237, 37, 83, 0.4);
    }
    .brand-text h1 {
      font-size: 15px;
      font-weight: 800;
      color: #ffffff;
      letter-spacing: -0.2px;
    }
    .brand-text p {
      font-size: 11px;
      color: #10b981;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .brand-text p::before {
      content: "";
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #10b981;
      display: inline-block;
      box-shadow: 0 0 6px #10b981;
    }
    .search-bar {
      padding: 12px 16px;
      background: #12121c;
      border-bottom: 1px solid #202030;
      display: flex;
      gap: 8px;
    }
    .search-input {
      flex: 1;
      background: #1a1a28;
      border: 1px solid #2d2d42;
      border-radius: 12px;
      padding: 10px 14px;
      color: #fff;
      font-size: 13px;
      outline: none;
    }
    .search-input:focus {
      border-color: #ed2553;
    }
    .batch-btn {
      background: linear-gradient(135deg, #ed2553, #e11d48);
      color: #fff;
      border: none;
      border-radius: 12px;
      padding: 10px 14px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      white-space: nowrap;
      box-shadow: 0 4px 12px rgba(237, 37, 83, 0.3);
    }
    .stats-bar {
      padding: 8px 16px;
      font-size: 11px;
      color: #94a3b8;
      display: flex;
      justify-content: space-between;
      border-bottom: 1px solid #1c1c2b;
    }
    .cards-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: 12px;
      padding: 14px 16px;
    }
    @media (min-width: 600px) {
      .cards-grid {
        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
        gap: 16px;
        padding: 20px;
      }
    }
    .card {
      background: #161622;
      border: 1px solid #242436;
      border-radius: 14px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      box-shadow: 0 4px 10px rgba(0,0,0,0.3);
      transition: transform 0.15s ease, border-color 0.15s ease;
    }
    .card:active {
      transform: scale(0.98);
      border-color: #ed2553;
    }
    .cover-wrap {
      aspect-ratio: 3/4.2;
      background: #202030;
      position: relative;
      overflow: hidden;
    }
    .cover-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .badge-pages {
      position: absolute;
      bottom: 6px;
      right: 6px;
      background: rgba(0, 0, 0, 0.8);
      color: #e2e8f0;
      font-size: 10px;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 6px;
      font-family: monospace;
    }
    .badge-id {
      position: absolute;
      top: 6px;
      left: 6px;
      background: rgba(237, 37, 83, 0.85);
      color: #ffffff;
      font-size: 9px;
      font-weight: 800;
      padding: 2px 6px;
      border-radius: 6px;
      font-family: monospace;
    }
    .card-body {
      padding: 10px;
      display: flex;
      flex-direction: column;
      flex: 1;
      justify-content: space-between;
      gap: 8px;
    }
    .card-title {
      font-size: 12px;
      font-weight: 700;
      color: #f1f5f9;
      line-height: 1.35;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .card-artist {
      font-size: 10px;
      color: #a855f7;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .card-meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 10px;
      color: #94a3b8;
      font-mono;
    }
    .btn-download {
      background: #ed2553;
      color: #fff;
      text-decoration: none;
      font-size: 11px;
      font-weight: 700;
      padding: 8px 10px;
      border-radius: 8px;
      text-align: center;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
      transition: background 0.15s;
    }
    .btn-download:active {
      background: #f43f5e;
    }
    .btn-stream {
      background: #252538;
      color: #38bdf8;
      border: 1px solid #33334d;
      font-size: 11px;
      font-weight: 700;
      padding: 6px 10px;
      border-radius: 8px;
      text-align: center;
      cursor: pointer;
    }
    .empty-state {
      text-align: center;
      padding: 60px 20px;
      color: #94a3b8;
    }
    /* Fullscreen Streaming Reader Modal */
    #readerModal {
      position: fixed;
      inset: 0;
      z-index: 1000;
      background: #08080c;
      display: none;
      flex-direction: column;
    }
    #readerHeader {
      padding: 10px 14px;
      background: rgba(15, 15, 23, 0.95);
      border-bottom: 1px solid #28283a;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    #readerTitle {
      font-size: 12px;
      font-weight: 700;
      color: #fff;
      max-width: 75%;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    #readerClose {
      background: #222232;
      color: #cbd5e1;
      border: none;
      border-radius: 8px;
      padding: 6px 12px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
    }
    #readerContent {
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
      padding: 10px 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }
    .reader-page-img {
      max-width: 100%;
      height: auto;
      display: block;
      background: #12121c;
      border-radius: 4px;
    }
  </style>
</head>
<body>
  <header>
    <div class="brand">
      <div class="logo-badge">⚡</div>
      <div class="brand-text">
        <h1>nHentai Quick Share</h1>
        <p>Wi-Fi Gigabit Local (${ip})</p>
      </div>
    </div>
    <button class="batch-btn" onclick="downloadAllZip()">
      📦 Tout Télécharger
    </button>
  </header>

  <div class="search-bar">
    <input
      type="text"
      id="searchInput"
      class="search-input"
      placeholder="Rechercher par titre, artiste, #ID..."
      oninput="filterCards()"
    />
  </div>

  <div class="stats-bar">
    <span id="filesCount">Chargement des mangas...</span>
    <span id="totalSize"></span>
  </div>

  <div id="cardsGrid" class="cards-grid"></div>
  <div id="emptyState" class="empty-state" style="display: none;">
    <h3>Aucun manga téléchargé trouvé sur le PC</h3>
    <p style="font-size: 12px; margin-top: 6px;">Téléchargez des mangas sur l'application PC puis actualisez cette page.</p>
  </div>

  <!-- In-Browser Streaming Reader Modal -->
  <div id="readerModal">
    <div id="readerHeader">
      <div id="readerTitle">Lecture en streaming</div>
      <button id="readerClose" onclick="closeReader()">Fermer ✕</button>
    </div>
    <div id="readerContent"></div>
  </div>

  <script>
    let allFiles = [];

    async function loadFiles() {
      try {
        const res = await fetch('/api/files');
        allFiles = await res.json();
        renderCards(allFiles);
      } catch (e) {
        document.getElementById('filesCount').innerText = 'Erreur de connexion avec le PC';
      }
    }

    function renderCards(files) {
      const grid = document.getElementById('cardsGrid');
      const empty = document.getElementById('emptyState');
      grid.innerHTML = '';

      if (!files || files.length === 0) {
        grid.style.display = 'none';
        empty.style.display = 'block';
        document.getElementById('filesCount').innerText = '0 manga disponible';
        document.getElementById('totalSize').innerText = '0 MB';
        return;
      }

      grid.style.display = 'grid';
      empty.style.display = 'none';

      let totalBytes = 0;
      files.forEach(f => { totalBytes += (f.size || 0); });
      document.getElementById('filesCount').innerText = files.length + ' manga' + (files.length > 1 ? 's' : '') + ' prêt' + (files.length > 1 ? 's' : '');
      document.getElementById('totalSize').innerText = (totalBytes / (1024 * 1024)).toFixed(1) + ' MB total';

      files.forEach(f => {
        const encName = encodeURIComponent(f.filename);
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = \`
          <div class="cover-wrap">
            <img class="cover-img" src="/api/cover/\${encName}" loading="lazy" alt="\${f.title}" />
            \${f.id ? \`<div class="badge-id">#d\${f.id}</div>\` : ''}
            <div class="badge-pages">\${f.pagesCount}p</div>
          </div>
          <div class="card-body">
            <div>
              <div class="card-title" title="\${f.title}">\${f.title}</div>
              \${f.artist ? \`<div class="card-artist">🎨 \${f.artist}</div>\` : ''}
            </div>
            <div class="card-meta">
              <span>\${f.format.toUpperCase()}</span>
              <span>\${f.sizeFormatted}</span>
            </div>
            <div style="display: flex; gap: 6px; flex-direction: column;">
              <a class="btn-download" href="/api/download/\${encName}" download="\${f.filename}">
                📥 Télécharger (\${f.format.toUpperCase()})
              </a>
              <button class="btn-stream" onclick="openReader('\${encName}', '\${f.title.replace(/'/g, "\\\\'")}', \${f.pagesCount})">
                📖 Lire en direct
              </button>
            </div>
          </div>
        \`;
        grid.appendChild(card);
      });
    }

    function filterCards() {
      const q = document.getElementById('searchInput').value.toLowerCase().trim();
      if (!q) {
        renderCards(allFiles);
        return;
      }
      const filtered = allFiles.filter(f => 
        (f.title && f.title.toLowerCase().includes(q)) ||
        (f.artist && f.artist.toLowerCase().includes(q)) ||
        (f.id && String(f.id).includes(q)) ||
        (f.filename && f.filename.toLowerCase().includes(q))
      );
      renderCards(filtered);
    }

    function downloadAllZip() {
      window.location.href = '/api/batch-zip';
    }

    async function openReader(encFilename, title, pagesCount) {
      const modal = document.getElementById('readerModal');
      const content = document.getElementById('readerContent');
      document.getElementById('readerTitle').innerText = title;
      content.innerHTML = '<div style="padding: 40px; color: #94a3b8; text-align: center;">Chargement des planches HD...</div>';
      modal.style.display = 'flex';

      try {
        const res = await fetch('/api/manifest/' + encFilename);
        const manifest = await res.json();
        content.innerHTML = '';
        manifest.pages.forEach((p, idx) => {
          const img = document.createElement('img');
          img.className = 'reader-page-img';
          img.loading = idx < 3 ? 'eager' : 'lazy';
          img.src = '/api/page/' + encFilename + '/' + idx;
          img.alt = 'Page ' + (idx + 1);
          content.appendChild(img);
        });
      } catch (e) {
        content.innerHTML = '<div style="padding: 40px; color: #f43f5e; text-align: center;">Erreur de lecture de l\\'archive</div>';
      }
    }

    function closeReader() {
      document.getElementById('readerModal').style.display = 'none';
      document.getElementById('readerContent').innerHTML = '';
    }

    loadFiles();
  </script>
</body>
</html>`;
}

function startQuickShareServer(customPort = 45678) {
  if (quickShareServer) {
    return {
      active: true,
      port: quickSharePort,
      ip: getLocalIpAddress(),
      url: `http://${getLocalIpAddress()}:${quickSharePort}/`,
    };
  }

  quickSharePort = customPort || 45678;
  const ip = getLocalIpAddress();

  quickShareServer = http.createServer(async (req, res) => {
    try {
      const parsedUrl = new URL(req.url, `http://${req.headers.host || "localhost"}`);
      const pathname = parsedUrl.pathname;

      // Allow CORS for mobile app fetch
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "*");

      if (req.method === "OPTIONS") {
        res.writeHead(204);
        return res.end();
      }

      // 1. Mobile Web App Home
      if (pathname === "/" || pathname === "/index.html") {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        return res.end(generateMobileWebClientHtml(ip, quickSharePort));
      }

      // 2. Status API
      if (pathname === "/api/status") {
        const files = getDownloadedFilesList();
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({
          success: true,
          server: "nHentai PC Quick Share Hub",
          ip,
          port: quickSharePort,
          url: `http://${ip}:${quickSharePort}/`,
          filesCount: files.length,
        }));
      }

      // 3. Files List API
      if (pathname === "/api/files") {
        const files = getDownloadedFilesList();
        res.writeHead(200, { "Content-Type": "application/json" });
        return res.end(JSON.stringify(files));
      }

      // 4. Single File Download (High-Speed Stream)
      if (pathname.startsWith("/api/download/")) {
        const rawFilename = decodeURIComponent(pathname.replace("/api/download/", ""));
        const downloadDir = getLocalDownloadDir();
        const fullPath = path.join(downloadDir, rawFilename);

        if (!fs.existsSync(fullPath)) {
          res.writeHead(404, { "Content-Type": "text/plain" });
          return res.end("Fichier non trouvé sur le PC");
        }

        const stat = fs.statSync(fullPath);
        const mimeType = rawFilename.endsWith(".cbz") ? "application/vnd.comicbook+zip" : "application/zip";

        res.writeHead(200, {
          "Content-Type": mimeType,
          "Content-Length": stat.size,
          "Content-Disposition": `attachment; filename="${encodeURIComponent(rawFilename)}"`,
        });

        const stream = fs.createReadStream(fullPath);
        stream.pipe(res);
        activeClientsCount++;
        stream.on("end", () => {
          activeClientsCount = Math.max(0, activeClientsCount - 1);
        });
        stream.on("error", () => {
          activeClientsCount = Math.max(0, activeClientsCount - 1);
        });
        return;
      }

      // 5. Cover Image Extractor
      if (pathname.startsWith("/api/cover/")) {
        const rawFilename = decodeURIComponent(pathname.replace("/api/cover/", ""));
        const downloadDir = getLocalDownloadDir();
        const fullPath = path.join(downloadDir, rawFilename);

        if (quickShareCoverCache.has(rawFilename)) {
          const { buffer, mime } = quickShareCoverCache.get(rawFilename);
          res.writeHead(200, {
            "Content-Type": mime,
            "Cache-Control": "public, max-age=86400",
          });
          return res.end(buffer);
        }

        if (fs.existsSync(fullPath)) {
          try {
            const zip = new AdmZip(fullPath);
            const imgEntries = zip
              .getEntries()
              .filter((e) => e.entryName.match(/\.(jpg|jpeg|png|webp)$/i))
              .sort((a, b) => a.entryName.localeCompare(b.entryName));

            if (imgEntries.length > 0) {
              const buf = zip.readFile(imgEntries[0]);
              const mime = imgEntries[0].entryName.endsWith(".png")
                ? "image/png"
                : imgEntries[0].entryName.endsWith(".webp")
                ? "image/webp"
                : "image/jpeg";
              quickShareCoverCache.set(rawFilename, { buffer: buf, mime });
              res.writeHead(200, {
                "Content-Type": mime,
                "Cache-Control": "public, max-age=86400",
              });
              return res.end(buf);
            }
          } catch (e) {}
        }

        res.writeHead(404);
        return res.end();
      }

      // 6. Streaming Manifest of Pages
      if (pathname.startsWith("/api/manifest/")) {
        const rawFilename = decodeURIComponent(pathname.replace("/api/manifest/", ""));
        const downloadDir = getLocalDownloadDir();
        const fullPath = path.join(downloadDir, rawFilename);

        if (fs.existsSync(fullPath)) {
          try {
            const zip = new AdmZip(fullPath);
            const imgEntries = zip
              .getEntries()
              .filter((e) => e.entryName.match(/\.(jpg|jpeg|png|webp)$/i))
              .sort((a, b) => a.entryName.localeCompare(b.entryName));

            const pages = imgEntries.map((e, idx) => ({ index: idx, name: e.entryName }));
            res.writeHead(200, { "Content-Type": "application/json" });
            return res.end(JSON.stringify({ pages, count: pages.length }));
          } catch (e) {}
        }
        res.writeHead(404, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ error: "Archive non lisible" }));
      }

      // 7. Streaming Individual Page for Web Reader
      if (pathname.startsWith("/api/page/")) {
        const parts = pathname.replace("/api/page/", "").split("/");
        const rawFilename = decodeURIComponent(parts[0]);
        const pageIdx = parseInt(parts[1], 10) || 0;
        const downloadDir = getLocalDownloadDir();
        const fullPath = path.join(downloadDir, rawFilename);

        if (fs.existsSync(fullPath)) {
          try {
            const zip = new AdmZip(fullPath);
            const imgEntries = zip
              .getEntries()
              .filter((e) => e.entryName.match(/\.(jpg|jpeg|png|webp)$/i))
              .sort((a, b) => a.entryName.localeCompare(b.entryName));

            if (pageIdx < imgEntries.length) {
              const entry = imgEntries[pageIdx];
              const buf = zip.readFile(entry);
              const mime = entry.entryName.endsWith(".png")
                ? "image/png"
                : entry.entryName.endsWith(".webp")
                ? "image/webp"
                : "image/jpeg";
              res.writeHead(200, {
                "Content-Type": mime,
                "Cache-Control": "public, max-age=3600",
              });
              return res.end(buf);
            }
          } catch (e) {}
        }
        res.writeHead(404);
        return res.end();
      }

      // 8. Batch Download of All CBZ files in a single zip
      if (pathname === "/api/batch-zip") {
        const downloadDir = getLocalDownloadDir();
        const files = getDownloadedFilesList();

        res.writeHead(200, {
          "Content-Type": "application/zip",
          "Content-Disposition": 'attachment; filename="nHentai_Batch_Collection.zip"',
        });

        const archive = createZipArchive({ zlib: { level: 0 } });
        archive.pipe(res);

        for (const f of files) {
          const fPath = path.join(downloadDir, f.filename);
          if (fs.existsSync(fPath)) {
            archive.file(fPath, { name: f.filename });
          }
        }
        archive.finalize();
        return;
      }

      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found");
    } catch (serverErr) {
      console.error("[Quick Share Server Error]:", serverErr);
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Server Error");
    }
  });

  quickShareServer.listen(quickSharePort, "0.0.0.0", () => {
    quickShareStartTime = Date.now();
    console.log(`[⚡ QUICK SHARE SERVER] Démarré sur http://${ip}:${quickSharePort}/ (Wi-Fi Gigabit)`);
  });

  return {
    active: true,
    port: quickSharePort,
    ip,
    url: `http://${ip}:${quickSharePort}/`,
  };
}

function stopQuickShareServer() {
  if (quickShareServer) {
    quickShareServer.close();
    quickShareServer = null;
    quickShareCoverCache.clear();
    console.log("[⚡ QUICK SHARE SERVER] Arrêté");
  }
  return { active: false };
}

ipcMain.handle("start-quick-share-server", async (_event, params) => {
  return startQuickShareServer(params?.port);
});

ipcMain.handle("stop-quick-share-server", async () => {
  return stopQuickShareServer();
});

ipcMain.handle("get-quick-share-status", async () => {
  const ip = getLocalIpAddress();
  const files = getDownloadedFilesList();
  return {
    active: !!quickShareServer,
    port: quickSharePort,
    ip,
    url: `http://${ip}:${quickSharePort}/`,
    filesCount: files.length,
    activeTransfers: activeClientsCount,
    uptime: quickShareStartTime ? Math.floor((Date.now() - quickShareStartTime) / 1000) : 0,
  };
});

ipcMain.handle("get-local-downloaded-files", async (_event, params) => {
  return getDownloadedFilesList(params?.directoryPath);
});

app.whenReady().then(async () => {
  // Auto-start Quick Share server on launch so it's always ready for instant QR scan!
  try {
    startQuickShareServer(45678);
  } catch (e) {
    console.warn("[Quick Share Server Auto-Start Notice]:", e.message);
  }
  // Block ads and heavy third-party analytics to make background Chromium navigation ultra fast (<1s)
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const u = details.url.toLowerCase();
    if (
      u.includes("google-analytics") ||
      u.includes("doubleclick") ||
      u.includes("tsyndicate") ||
      u.includes("exosrv") ||
      u.includes("adtng") ||
      u.includes("juicyads") ||
      u.includes("popads") ||
      u.includes("trafficjunky") ||
      u.includes("ad-delivery")
    ) {
      callback({ cancel: true });
    } else {
      callback({ cancel: false });
    }
  });

  // Intercept all requests to *.nhentai.net and attach proper Referer, User-Agent and X-API-Key to bypass Cloudflare CDN hotlinking blocks
  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: ["*://*.nhentai.net/*", "*://nhentai.net/*"] },
    (details, callback) => {
      details.requestHeaders["Referer"] = "https://nhentai.net/";
      details.requestHeaders["User-Agent"] = DEFAULT_USER_AGENT;
      if (!details.requestHeaders["X-API-Key"]) {
        details.requestHeaders["X-API-Key"] = DEFAULT_API_KEY;
      }
      delete details.requestHeaders["Origin"];
      delete details.requestHeaders["origin"];
      callback({ requestHeaders: details.requestHeaders });
    }
  );

  session.defaultSession.webRequest.onHeadersReceived(
    { urls: ["*://*.nhentai.net/*", "*://nhentai.net/*"] },
    (details, callback) => {
      const responseHeaders = { ...details.responseHeaders };
      responseHeaders["Access-Control-Allow-Origin"] = ["*"];
      callback({ responseHeaders });
    }
  );

  createMainWindow();
  initCloudflareSession();
  fetchCdnConfig();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});

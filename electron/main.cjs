const { app, BrowserWindow, ipcMain, dialog, shell, session, Notification, Menu, net } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const https = require("https");
const archiver = require("archiver");
const AdmZip = require("adm-zip");

let mainWindow = null;
let authWindow = null;
let backgroundBypassWindow = null;
const activeDownloads = new Map(); // id -> AbortController

const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36";

const DEFAULT_API_KEY = "nhk_76brQ5mzs90y2OdCzOA920N9m8qP1tzFjuxGAE3TdmKf_k_4";

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
  // Fix double extensions returned by nHentai API v2 like .jpg.webp -> .webp or .webp.webp -> .webp
  clean = clean.replace(/\.(jpg|jpeg|png|webp)\.webp$/i, ".webp");
  clean = clean.replace(/\.(jpg|jpeg|png|webp)\.jpg$/i, ".jpg");
  clean = clean.replace(/\.(jpg|jpeg|png|webp)\.png$/i, ".png");
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
  const lang = norm.tags?.find((t) => t.type === "language" && t.name !== "translated")?.name || "japanese";
  const tagsStr = (norm.tags || []).map((t) => t.name).join(", ");
  const cat = norm.tags?.find((t) => t.type === "category")?.name || "Doujinshi";
  const title = norm.title?.pretty || norm.title?.english || `Gallery #${norm.id}`;

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
  <Series>${escapeXml(parody)}</Series>
  <Number>${norm.id}</Number>
  <Summary>Source: https://nhentai.net/g/${norm.id}/</Summary>
  <Writer>${escapeXml(group)}</Writer>
  <Penciller>${escapeXml(artist)}</Penciller>
  <Genre>${escapeXml(cat)}</Genre>
  <Tags>${escapeXml(tagsStr)}</Tags>
  <PageCount>${norm.num_pages || 1}</PageCount>
  <LanguageISO>${escapeXml(lang)}</LanguageISO>
  <Web>https://nhentai.net/g/${norm.id}/</Web>
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
  } catch (e) {
    console.warn("Silent background session warmer notice:", e.message);
  }
}

// Native Node.js HTTPS API fetcher (Bypasses Chromium client restrictions)
function fetchNhentai(url, customCookies, apiKey) {
  return new Promise(async (resolve, reject) => {
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
        headers,
      },
      (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          const loc = res.headers.location;
          if (loc) {
            return fetchNhentai(loc, customCookies, apiKey).then(resolve, reject);
          }
        }

        let raw = "";
        res.on("data", (c) => (raw += c));
        res.on("end", () => {
          if (res.statusCode === 403 || res.statusCode === 503) {
            return reject(
              new Error("Protection Cloudflare active. Cliquez sur 'Connexion' en haut à droite pour valider votre session en 1 clic.")
            );
          }
          if (res.statusCode >= 400) {
            return reject(new Error(`Erreur HTTP ${res.statusCode} sur ${url}: ${raw.substring(0, 100)}`));
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
    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error(`Timeout de connexion sur ${url}`));
    });

    req.end();
  });
}

// Native Node.js image downloader (100% resilient, direct buffer stream, no net::ERR_BLOCKED_BY_CLIENT)
function downloadImageBuffer(url, referer, cookies, apiKey, abortSignal, retryCount = 0) {
  return new Promise((resolve, reject) => {
    if (abortSignal && abortSignal.aborted) {
      return reject(new Error("ABORTED"));
    }

    const u = new URL(url);
    const headers = {
      "User-Agent": DEFAULT_USER_AGENT,
      Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9,ja;q=0.8,fr;q=0.7",
      Referer: referer || "https://nhentai.net/",
    };

    const effectiveApiKey = (apiKey || DEFAULT_API_KEY || "").trim();
    if (effectiveApiKey) {
      headers["Authorization"] = `Bearer ${effectiveApiKey}`;
      headers["X-API-Key"] = effectiveApiKey;
      headers["X-Api-Key"] = effectiveApiKey;
    }
    if (cookies) {
      headers["Cookie"] = cookies;
    }

    const req = https.request(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
        method: "GET",
        headers,
      },
      async (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          const loc = res.headers.location;
          if (loc) {
            return downloadImageBuffer(loc, referer, cookies, apiKey, abortSignal, retryCount).then(resolve, reject);
          }
        }
        if (res.statusCode === 429 && retryCount < 3) {
          await new Promise((r) => setTimeout(r, 400 * (retryCount + 1)));
          return downloadImageBuffer(url, referer, cookies, apiKey, abortSignal, retryCount + 1).then(resolve, reject);
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`Erreur HTTP ${res.statusCode} lors du téléchargement de ${url}`));
        }

        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => resolve(Buffer.concat(chunks)));
        res.on("error", reject);
      }
    );

    if (abortSignal) {
      abortSignal.addEventListener("abort", () => {
        req.destroy();
        reject(new Error("ABORTED"));
      });
    }

    req.on("error", (err) => {
      if (abortSignal && abortSignal.aborted) {
        reject(new Error("ABORTED"));
      } else {
        reject(err);
      }
    });

    req.setTimeout(25000, () => {
      req.destroy();
      reject(new Error(`Timeout de téléchargement sur ${url}`));
    });

    req.end();
  });
}

// Auto-fallback image downloader: if primary format 404s, seamlessly tries alternative formats (.jpg/.png/.webp)
async function downloadImageBufferWithFallback(url, referer, cookies, apiKey, abortSignal) {
  try {
    const buf = await downloadImageBuffer(url, referer, cookies, apiKey, abortSignal);
    return { buffer: buf, finalUrl: url };
  } catch (err) {
    if (err.message && err.message.includes("404")) {
      const altUrls = [];
      if (url.endsWith(".webp")) {
        altUrls.push(url.replace(/\.webp$/, ".jpg"));
        altUrls.push(url.replace(/\.webp$/, ".png"));
      } else if (url.endsWith(".jpg")) {
        altUrls.push(url.replace(/\.jpg$/, ".webp"));
        altUrls.push(url.replace(/\.jpg$/, ".png"));
      } else if (url.endsWith(".png")) {
        altUrls.push(url.replace(/\.png$/, ".webp"));
        altUrls.push(url.replace(/\.png$/, ".jpg"));
      }

      for (const alt of altUrls) {
        try {
          const buf = await downloadImageBuffer(alt, referer, cookies, apiKey, abortSignal);
          return { buffer: buf, finalUrl: alt };
        } catch (e) {}
      }
    }
    throw err;
  }
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
  return cleanQuery
    .trim()
    .replace(/\s+/g, "+");
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

ipcMain.handle("cancel-download", async (_event, { galleryId }) => {
  const controller = activeDownloads.get(galleryId);
  if (controller) {
    controller.abort();
    activeDownloads.delete(galleryId);
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
  if (authWindow) {
    authWindow.focus();
    return;
  }

  authWindow = new BrowserWindow({
    width: 900,
    height: 740,
    title: "Connexion nHentai (Validation Cloudflare)",
    backgroundColor: "#0c0c10",
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  authWindow.loadURL("https://nhentai.net/login/");

  authWindow.webContents.on("did-navigate", async () => {
    try {
      const cookies = await session.defaultSession.cookies.get({ domain: "nhentai.net" });
      const cookieStr = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
      if (cookieStr.includes("sessionid") || cookieStr.includes("cf_clearance")) {
        mainWindow?.webContents.send("cookies-captured", cookieStr);
      }
    } catch (e) {
      console.error("Error capturing cookies:", e);
    }
  });

  authWindow.on("closed", () => {
    authWindow = null;
  });
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

app.whenReady().then(async () => {
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
    { urls: ["*://*.nhentai.net/*"] },
    (details, callback) => {
      details.requestHeaders["Referer"] = "https://nhentai.net/";
      details.requestHeaders["User-Agent"] = DEFAULT_USER_AGENT;
      if (!details.requestHeaders["X-API-Key"]) {
        details.requestHeaders["X-API-Key"] = DEFAULT_API_KEY;
      }
      delete details.requestHeaders["Origin"];
      callback({ requestHeaders: details.requestHeaders });
    }
  );

  session.defaultSession.webRequest.onHeadersReceived(
    { urls: ["*://*.nhentai.net/*"] },
    (details, callback) => {
      const responseHeaders = { ...details.responseHeaders };
      responseHeaders["Access-Control-Allow-Origin"] = ["*"];
      callback({ responseHeaders });
    }
  );

  createMainWindow();
  initCloudflareSession();
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

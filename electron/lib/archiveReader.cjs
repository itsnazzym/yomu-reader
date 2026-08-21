"use strict";

const fs = require("fs");
const path = require("path");
const yauzl = require("yauzl");

const LIMITS = {
  maxArchiveBytes: 800 * 1024 * 1024,
  maxEntries: 2500,
  maxEntryUncompressed: 30 * 1024 * 1024,
  maxTotalUncompressed: 1536 * 1024 * 1024,
  maxCompressionRatio: 200,
  maxCoverBytes: 8 * 1024 * 1024,
  maxXmlBytes: 1024 * 1024,
};

const IMAGE_EXT_RE = /\.(jpe?g|png|webp|gif)$/i;

function isSafeEntryName(name) {
  const normalized = String(name || "").replace(/\\/g, "/");
  if (!normalized || normalized.startsWith("/") || normalized.includes("..")) return false;
  return true;
}

function isImageEntry(name) {
  return IMAGE_EXT_RE.test(name) && !String(name).endsWith("/");
}

function assertArchiveFile(filePath) {
  const stats = fs.statSync(filePath);
  if (!stats.isFile()) throw new Error("Le chemin n'est pas un fichier");
  if (stats.size > LIMITS.maxArchiveBytes) {
    throw new Error("Archive trop volumineuse");
  }
  return stats;
}

function assertEntryLimits(entry, { allowXml = false } = {}) {
  const uncompressed = Number(entry.uncompressedSize || 0);
  const compressed = Math.max(1, Number(entry.compressedSize || 0));
  const ratio = uncompressed / compressed;
  const maxUncompressed = allowXml ? LIMITS.maxXmlBytes : LIMITS.maxEntryUncompressed;
  if (uncompressed > maxUncompressed) {
    throw new Error("Entrée d'archive trop volumineuse");
  }
  if (ratio > LIMITS.maxCompressionRatio && uncompressed > 8 * 1024 * 1024) {
    throw new Error("Ratio de compression d'archive suspect");
  }
}

function openZip(filePath) {
  assertArchiveFile(filePath);
  return new Promise((resolve, reject) => {
    yauzl.open(filePath, { lazyEntries: true, autoClose: true }, (error, zip) => {
      if (error) reject(error);
      else resolve(zip);
    });
  });
}

function collectStream(stream, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let received = 0;
    stream.on("data", (chunk) => {
      received += chunk.length;
      if (received > maxBytes) {
        stream.destroy(new Error("Entrée d'archive trop volumineuse"));
        return;
      }
      chunks.push(chunk);
    });
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

function openReadStream(zip, entry) {
  return new Promise((resolve, reject) => {
    zip.openReadStream(entry, (error, stream) => {
      if (error) reject(error);
      else resolve(stream);
    });
  });
}

async function listArchiveContents(filePath) {
  const zip = await openZip(filePath);
  return new Promise((resolve, reject) => {
    const images = [];
    let comicInfo = null;
    let totalUncompressed = 0;
    let entryCount = 0;
    let settled = false;

    const fail = (error) => {
      if (settled) return;
      settled = true;
      try {
        zip.close();
      } catch {}
      reject(error);
    };

    zip.on("entry", (entry) => {
      try {
        entryCount += 1;
        if (entryCount > LIMITS.maxEntries) {
          fail(new Error("Trop d'entrées dans l'archive"));
          return;
        }
        if (!isSafeEntryName(entry.fileName) || /\/$/.test(entry.fileName)) {
          zip.readEntry();
          return;
        }
        totalUncompressed += Number(entry.uncompressedSize || 0);
        if (totalUncompressed > LIMITS.maxTotalUncompressed) {
          fail(new Error("Archive décompressée trop volumineuse"));
          return;
        }
        const lower = entry.fileName.toLowerCase();
        if (path.basename(lower) === "comicinfo.xml") {
          assertEntryLimits(entry, { allowXml: true });
          comicInfo = entry.fileName;
        } else if (isImageEntry(entry.fileName)) {
          assertEntryLimits(entry);
          images.push({
            name: entry.fileName,
            uncompressedSize: Number(entry.uncompressedSize || 0),
          });
        }
        zip.readEntry();
      } catch (error) {
        fail(error);
      }
    });
    zip.on("end", () => {
      if (settled) return;
      settled = true;
      images.sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" })
      );
      resolve({ images, comicInfoName: comicInfo });
    });
    zip.on("error", fail);
    zip.readEntry();
  });
}

async function extractArchiveEntry(filePath, entryName, maxBytes = LIMITS.maxEntryUncompressed) {
  if (!isSafeEntryName(entryName)) throw new Error("Nom d'entrée d'archive invalide");
  const zip = await openZip(filePath);
  return new Promise((resolve, reject) => {
    let settled = false;
    const fail = (error) => {
      if (settled) return;
      settled = true;
      try {
        zip.close();
      } catch {}
      reject(error);
    };
    zip.on("entry", (entry) => {
      if (entry.fileName !== entryName) {
        zip.readEntry();
        return;
      }
      Promise.resolve()
        .then(() => {
          assertEntryLimits(entry, {
            allowXml: path.basename(entry.fileName).toLowerCase() === "comicinfo.xml",
          });
          return openReadStream(zip, entry);
        })
        .then((stream) => collectStream(stream, maxBytes))
        .then((buffer) => {
          if (settled) return;
          settled = true;
          resolve(buffer);
        })
        .catch(fail);
    });
    zip.on("end", () => fail(new Error("Entrée d'archive introuvable")));
    zip.on("error", fail);
    zip.readEntry();
  });
}

function parseComicInfo(xmlStr) {
  if (!xmlStr) return { title: null, artist: null };
  const pencillerMatch = xmlStr.match(/<Penciller>(.*?)<\/Penciller>/i);
  const writerMatch = xmlStr.match(/<Writer>(.*?)<\/Writer>/i);
  const titleMatch = xmlStr.match(/<Title>(.*?)<\/Title>/i);
  return {
    title: titleMatch ? titleMatch[1].trim() : null,
    artist: pencillerMatch
      ? pencillerMatch[1].trim()
      : writerMatch
        ? writerMatch[1].trim()
        : null,
  };
}

async function readArchiveMetadata(filePath) {
  const listed = await listArchiveContents(filePath);
  let comicInfo = { title: null, artist: null };
  if (listed.comicInfoName) {
    try {
      const xmlBuf = await extractArchiveEntry(
        filePath,
        listed.comicInfoName,
        LIMITS.maxXmlBytes
      );
      comicInfo = parseComicInfo(xmlBuf.toString("utf8"));
    } catch {}
  }
  return {
    images: listed.images,
    comicInfo,
  };
}

function listFolderImages(dirPath) {
  const stats = fs.statSync(dirPath);
  if (!stats.isDirectory()) throw new Error("Le chemin n'est pas un dossier");
  const names = fs.readdirSync(dirPath);
  return names
    .filter((name) => isImageEntry(name) && isSafeEntryName(name))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }))
    .map((name) => ({
      name,
      fullPath: path.join(dirPath, name),
    }));
}

function readFileBounded(filePath, maxBytes = LIMITS.maxEntryUncompressed) {
  const stats = fs.statSync(filePath);
  if (!stats.isFile()) throw new Error("Fichier introuvable");
  if (stats.size > maxBytes) throw new Error("Fichier trop volumineux");
  return fs.readFileSync(filePath);
}

function extToMime(name) {
  const ext = String(name || "").toLowerCase();
  if (ext.endsWith(".png")) return "image/png";
  if (ext.endsWith(".webp")) return "image/webp";
  if (ext.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

function extFromName(name) {
  const match = String(name || "").toLowerCase().match(/\.([a-z0-9]+)$/);
  return match ? match[1] : "jpg";
}

module.exports = {
  LIMITS,
  IMAGE_EXT_RE,
  isSafeEntryName,
  isImageEntry,
  listArchiveContents,
  extractArchiveEntry,
  readArchiveMetadata,
  listFolderImages,
  readFileBounded,
  extToMime,
  extFromName,
  parseComicInfo,
};

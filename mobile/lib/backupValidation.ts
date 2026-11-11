import type { BackupData } from "./backupStore";
import { splitGlobalId } from "./sources/types";
function isPlainObject(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function validGallery(value: unknown): boolean {
  if (!isPlainObject(value) || typeof value.id !== "number" || !Number.isSafeInteger(value.id) || value.id < 0 || !isPlainObject(value.title) || !isPlainObject(value.images) || !Array.isArray(value.tags)) return false;
  if (![value.title.pretty, value.title.english, value.title.japanese].some(t => typeof t === "string" && t.trim())) return false;
  if (value.tags.some(t => !isPlainObject(t) || typeof t.name !== "string" || typeof t.type !== "string")) return false;
  if (value.globalId !== undefined) {
    if (typeof value.globalId !== "string" || !value.globalId.includes(":")) return false;
    try { splitGlobalId(value.globalId); } catch { return false; }
  }
  return true;
}
function boundedTree(value: unknown, depth = 0): boolean {
  if (depth > 14) return false;
  if (typeof value === "string") return value.length <= (depth === 1 ? 12 * 1024 * 1024 : 65536);
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.length <= 50000 && value.every(v => boundedTree(v, depth + 1));
  if (isPlainObject(value)) return Object.entries(value).every(([k, v]) => !["__proto__", "constructor", "prototype"].includes(k) && boundedTree(v, depth + 1));
  return value === null || typeof value === "boolean" || value === undefined;
}
function validSettings(value: unknown): boolean {
  if (!isPlainObject(value)) return false;
  const enums: Record<string, string[]> = { defaultMode: ["webtoon", "pager"], defaultDirection: ["rtl", "ltr"], fitMode: ["width", "height", "auto"], colorFilter: ["none", "sepia", "night", "invert", "high-contrast"] };
  for (const [key, entry] of Object.entries(value)) {
    if (enums[key]) { if (typeof entry !== "string" || !enums[key].includes(entry)) return false; }
    else if (/^catalogColumns|^preload(?:Prev|Next)$/.test(key)) { if (typeof entry !== "number" || !Number.isInteger(entry) || entry < 1 || entry > 12) return false; }
    else if (key === "readerBrightness") { if (typeof entry !== "number" || entry < 0.1 || entry > 1) return false; }
    else if (key === "doubleTapZoom") { if (typeof entry !== "number" || entry < 1 || entry > 5) return false; }
    else if (key === "catalogMinCardWidth") { if (typeof entry !== "number" || entry < 40 || entry > 1000) return false; }
    else if (typeof entry !== "boolean") return false;
  }
  return true;
}
export function isValidBackupData(value: unknown): value is BackupData {
  if (!isPlainObject(value)) return false;
  if (!boundedTree(value)) return false;
  if (value.favorites !== undefined && (!Array.isArray(value.favorites) || !value.favorites.every(validGallery))) return false;
  if (value.history !== undefined && (!Array.isArray(value.history) || !value.history.every(h => isPlainObject(h) && validGallery(h.gallery) && typeof h.lastPage === "number" && Number.isInteger(h.lastPage) && h.lastPage >= 0))) return false;
  if (value.readerSettings !== undefined && !validSettings(value.readerSettings)) return false;
  if (value.privacy !== undefined && (!isPlainObject(value.privacy) || Object.values(value.privacy).some(v => typeof v !== "boolean"))) return false;
  if (value.downloadSettings !== undefined && (!isPlainObject(value.downloadSettings) || Object.entries(value.downloadSettings).some(([k, v]) => k === "mode" ? v !== "app" && v !== "saf" : k === "safDirectoryUri" ? v !== null && typeof v !== "string" : typeof v !== "boolean"))) return false;
  if (value.tagCollections !== undefined && (!Array.isArray(value.tagCollections) || value.tagCollections.some(c => !isPlainObject(c) || typeof c.id !== "string" || typeof c.name !== "string" || !Array.isArray(c.tags) || c.tags.some(t => !isPlainObject(t) || typeof t.name !== "string" || typeof t.type !== "string")))) return false;
  if (value.version !== 1 && value.version !== 2 && value.version !== 3) return false;
  if (typeof value.exportedAt !== "string" || !Number.isFinite(Date.parse(value.exportedAt))) {
    return false;
  }
  if (
    value.favorites !== undefined &&
    (!Array.isArray(value.favorites) ||
      value.favorites.some((item) => {
        if (!isPlainObject(item)) return true;
        const hasNumericId = Number.isFinite(Number(item.id));
        const hasGlobalId =
          typeof item.globalId === "string" && item.globalId.includes(":");
        return !hasNumericId && !hasGlobalId;
      }))
  ) {
    return false;
  }
  if (
    value.history !== undefined &&
    (!Array.isArray(value.history) ||
      value.history.some(
        (item) =>
          !isPlainObject(item) ||
          !isPlainObject(item.gallery) ||
          !Number.isFinite(Number(item.gallery.id)) ||
          !Number.isFinite(Number(item.lastPage))
      ))
  ) {
    return false;
  }
  if (value.tagFavorites !== undefined && !isPlainObject(value.tagFavorites)) return false;
  if (
    value.tagCollections !== undefined &&
    (!Array.isArray(value.tagCollections) ||
      value.tagCollections.some((item) => !isPlainObject(item)))
  ) {
    return false;
  }
  if (value.readerSettings !== undefined && !isPlainObject(value.readerSettings)) return false;
  if (
    value.blacklistTags !== undefined &&
    (!Array.isArray(value.blacklistTags) ||
      value.blacklistTags.some((item) => typeof item !== "string"))
  ) {
    return false;
  }
  if (value.downloadSettings !== undefined && !isPlainObject(value.downloadSettings)) return false;
  if (
    value.searchHistory !== undefined &&
    (!Array.isArray(value.searchHistory) ||
      value.searchHistory.some((item) => typeof item !== "string"))
  ) {
    return false;
  }
  if (value.privacy !== undefined && !isPlainObject(value.privacy)) return false;
  if (
    value.libraryCollections !== undefined &&
    (!Array.isArray(value.libraryCollections) ||
      value.libraryCollections.some((item) => !isPlainObject(item)))
  ) {
    return false;
  }
  if (value.followsFeed !== undefined && !isPlainObject(value.followsFeed)) return false;
  if (
    value.localAvatarBase64 !== undefined &&
    typeof value.localAvatarBase64 !== "string"
  ) {
    return false;
  }
  if (
    value.localAvatarMime !== undefined &&
    typeof value.localAvatarMime !== "string"
  ) {
    return false;
  }
  return true;
}

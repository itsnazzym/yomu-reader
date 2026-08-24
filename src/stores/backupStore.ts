/**
 * Yomu BackupData v3 — same shape as mobile/lib/backupStore.ts for round-trip.
 */
import { useFavoriteStore, type LocalFavoriteItem } from "./favoriteStore";
import { useHistoryStore, type ReadingHistoryItem } from "./historyStore";
import { useSettingsStore } from "./settingsStore";
import {
  makeGlobalId,
  splitGlobalId,
  type GlobalGalleryId,
} from "../utils/globalId";
import type { Gallery } from "../types";

export interface BackupRestoredCounts {
  favorites: number;
  history: number;
  blacklist: number;
}

export interface BackupData {
  version: number;
  exportedAt: string;
  favorites?: Record<string, unknown>[];
  history?: Record<string, unknown>[];
  tagFavorites?: Record<string, unknown>;
  tagCollections?: Record<string, unknown>[];
  readerSettings?: Record<string, unknown>;
  blacklistTags?: string[];
  downloadSettings?: Record<string, unknown>;
  searchHistory?: string[];
  privacy?: Record<string, unknown>;
  libraryCollections?: Record<string, unknown>[];
  followsFeed?: Record<string, unknown>;
  localAvatarBase64?: string;
  localAvatarMime?: string;
}

const CURRENT_BACKUP_VERSION = 3;
const READER_SETTINGS_KEY = "yomu_reader_settings_v1";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function favoriteToBackupRecord(item: LocalFavoriteItem): Record<string, unknown> {
  const { nativeId } = splitGlobalId(item.id);
  const numericId = Number.parseInt(nativeId, 10) || item.gallery.id || 0;
  return {
    ...item.gallery,
    id: numericId,
    globalId: item.id,
    tags: Array.isArray(item.gallery.tags) ? item.gallery.tags : [],
  };
}

function historyToBackupRecord(item: ReadingHistoryItem): Record<string, unknown> {
  const { source, nativeId } = splitGlobalId(item.id);
  const numericId = Number.parseInt(nativeId, 10) || 0;
  return {
    gallery: {
      id: numericId,
      media_id: item.mediaId || String(numericId),
      title: {
        english: item.title,
        japanese: "",
        pretty: item.title,
      },
      tags: [],
      num_pages: item.totalPages,
      images: {
        cover: { t: "j", w: 0, h: 0 },
        thumbnail: { t: "j", w: 0, h: 0 },
      },
      globalId: item.id,
    },
    lastPage: item.lastReadPage,
    totalPages: item.totalPages,
    readAt: item.lastReadAt,
    source,
    localId: item.isLocal ? item.filePath : undefined,
  };
}

export function createBackupPayload(): BackupData {
  const favorites = useFavoriteStore.getState().favorites.map(favoriteToBackupRecord);
  const history = useHistoryStore.getState().history.map(historyToBackupRecord);
  const blacklistTags = useSettingsStore.getState().settings.blacklisted_tags || [];
  let readerSettings: Record<string, unknown> = {};
  try {
    const raw = localStorage.getItem(READER_SETTINGS_KEY);
    if (raw) readerSettings = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    readerSettings = {};
  }

  return {
    version: CURRENT_BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    favorites,
    history,
    blacklistTags,
    readerSettings,
  };
}

function parseFavoriteFromBackup(raw: unknown): LocalFavoriteItem | null {
  if (!isPlainObject(raw)) return null;
  const globalId =
    (typeof raw.globalId === "string" && raw.globalId) ||
    (typeof raw.galleryId === "string" && raw.galleryId) ||
    (raw.id != null ? makeGlobalId("nhentai", String(raw.id)) : null);
  if (!globalId) return null;
  const { source, nativeId } = splitGlobalId(globalId);
  const numericId = Number.parseInt(nativeId, 10) || Number(raw.id) || 0;
  const emptyImages: Gallery["images"] = {
    pages: [],
    cover: { t: "j", w: 0, h: 0 },
    thumbnail: { t: "j", w: 0, h: 0 },
  };
  let images = emptyImages;
  if (isPlainObject(raw.images)) {
    const img = raw.images as {
      pages?: Gallery["images"]["pages"];
      cover?: Gallery["images"]["cover"];
      thumbnail?: Gallery["images"]["thumbnail"];
    };
    images = {
      pages: Array.isArray(img.pages) ? img.pages : [],
      cover: img.cover || emptyImages.cover,
      thumbnail: img.thumbnail || emptyImages.thumbnail,
    };
  }

  const gallery = {
    id: numericId,
    media_id: String(raw.media_id || numericId),
    title: isPlainObject(raw.title)
      ? (raw.title as Gallery["title"])
      : {
          english: `Gallery #${numericId}`,
          japanese: "",
          pretty: `Gallery #${numericId}`,
        },
    tags: Array.isArray(raw.tags) ? (raw.tags as Gallery["tags"]) : [],
    images,
    num_pages: Number(raw.num_pages) || 0,
    num_favorites: Number(raw.num_favorites) || 0,
    upload_date: Number(raw.upload_date) || 0,
    globalId,
  } as Gallery & { globalId: string };

  return {
    id: globalId as GlobalGalleryId,
    gallery,
    addedAt: Date.now(),
    sourceUnavailable: source !== "nhentai",
  };
}

function parseHistoryFromBackup(raw: unknown): ReadingHistoryItem | null {
  if (!isPlainObject(raw) || !isPlainObject(raw.gallery)) return null;
  const g = raw.gallery;
  const globalId =
    (typeof g.globalId === "string" && g.globalId) ||
    (typeof raw.source === "string" && raw.source && g.id != null
      ? makeGlobalId(raw.source as "nhentai", String(g.id))
      : null) ||
    (g.id != null ? makeGlobalId("nhentai", String(g.id)) : null);
  if (!globalId) return null;
  const titleObj = isPlainObject(g.title) ? g.title : {};
  const title =
    (typeof titleObj.pretty === "string" && titleObj.pretty) ||
    (typeof titleObj.english === "string" && titleObj.english) ||
    `Gallery #${g.id}`;
  const { source } = splitGlobalId(globalId);
  return {
    id: globalId,
    mediaId: typeof g.media_id === "string" ? g.media_id : undefined,
    title,
    lastReadPage: Number(raw.lastPage) || 0,
    totalPages: Number(raw.totalPages) || Number(g.num_pages) || 1,
    lastReadAt: Number(raw.readAt) || Date.now(),
    isLocal: Boolean(raw.localId),
    filePath: typeof raw.localId === "string" ? raw.localId : undefined,
    sourceUnavailable: source !== "nhentai",
  };
}

export function isValidBackupData(value: unknown): value is BackupData {
  if (!isPlainObject(value)) return false;
  if (value.version !== 1 && value.version !== 2 && value.version !== 3) return false;
  if (typeof value.exportedAt !== "string") return false;
  if (value.favorites !== undefined && !Array.isArray(value.favorites)) return false;
  if (value.history !== undefined && !Array.isArray(value.history)) return false;
  return true;
}

export function importBackupPayload(data: BackupData): BackupRestoredCounts {
  const counts: BackupRestoredCounts = {
    favorites: 0,
    history: 0,
    blacklist: 0,
  };

  if (Array.isArray(data.favorites)) {
    const merged = new Map<string, LocalFavoriteItem>();
    useFavoriteStore.getState().favorites.forEach((f) => merged.set(f.id, f));
    for (const raw of data.favorites) {
      const item = parseFavoriteFromBackup(raw);
      if (item) {
        merged.set(item.id, item);
        counts.favorites += 1;
      }
    }
    const next = Array.from(merged.values()).sort((a, b) => b.addedAt - a.addedAt);
    useFavoriteStore.setState({ favorites: next });
    localStorage.setItem("nhentai_local_favorites", JSON.stringify(next));
  }

  if (Array.isArray(data.history)) {
    const merged = new Map<string, ReadingHistoryItem>();
    useHistoryStore.getState().history.forEach((h) => merged.set(h.id, h));
    for (const raw of data.history) {
      const item = parseHistoryFromBackup(raw);
      if (item) {
        merged.set(item.id, item);
        counts.history += 1;
      }
    }
    const next = Array.from(merged.values())
      .sort((a, b) => b.lastReadAt - a.lastReadAt)
      .slice(0, 150);
    useHistoryStore.setState({ history: next });
    localStorage.setItem("nhentai_reading_history", JSON.stringify(next));
  }

  if (Array.isArray(data.blacklistTags)) {
    const tags = data.blacklistTags.filter((t): t is string => typeof t === "string");
    const { updateSettings } = useSettingsStore.getState();
    updateSettings({ blacklisted_tags: tags });
    counts.blacklist = tags.length;
  }

  if (isPlainObject(data.readerSettings)) {
    try {
      localStorage.setItem(READER_SETTINGS_KEY, JSON.stringify(data.readerSettings));
    } catch {
      /* ignore */
    }
  }

  return counts;
}

export function exportBackupToFile(): void {
  const payload = createBackupPayload();
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `yomu-backup_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importBackupFromFile(file: File): Promise<BackupRestoredCounts> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed: unknown = JSON.parse(String(reader.result || ""));
        if (!isValidBackupData(parsed)) {
          reject(new Error("Format de sauvegarde Yomu invalide"));
          return;
        }
        resolve(importBackupPayload(parsed));
      } catch (e) {
        reject(e instanceof Error ? e : new Error("JSON invalide"));
      }
    };
    reader.onerror = () => reject(new Error("Lecture du fichier impossible"));
    reader.readAsText(file);
  });
}

export { READER_SETTINGS_KEY };

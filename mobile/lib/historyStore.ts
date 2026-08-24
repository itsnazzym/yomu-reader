import AsyncStorage from "@react-native-async-storage/async-storage";
import { useState, useEffect } from "react";
import type { Gallery, GalleryImage, Tag } from "./api/types";
import { isIncognito } from "./privacyStore";

export const HISTORY_STORAGE_KEY = "@nhentai_reading_history_v1";
const PERSIST_DEBOUNCE_MS = 1000;

export interface HistoryGallery {
  id: number;
  media_id: string;
  title: Gallery["title"];
  tags: Tag[];
  num_pages: number;
  images: {
    cover: GalleryImage;
    thumbnail: GalleryImage;
  };
  scanlator?: string;
  upload_date?: number;
  num_favorites?: number;
  origin?: Gallery["origin"];
  tag_ids?: number[];
}

export interface HistoryEntry {
  gallery: HistoryGallery;
  lastPage: number;
  totalPages: number;
  readAt: number;
  /** Source plateforme (nhentai | 3hentai | doujins | …) pour la reprise. */
  source?: string;
  /** Dossier local NHAppAndroid/<localId>/ si lecture offline. */
  localId?: string;
}

export interface RecordProgressOptions {
  source?: string;
  localId?: string;
}

let historyList: HistoryEntry[] = [];
let historyInitPromise: Promise<void> | null = null;
let historyWritePromise: Promise<void> = Promise.resolve();
let persistTimer: ReturnType<typeof setTimeout> | null = null;
let notifyTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

function emptyImage(): GalleryImage {
  return { t: "j", w: 0, h: 0 };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseImage(raw: unknown): GalleryImage {
  if (!isRecord(raw)) return emptyImage();
  const type = raw.t;
  const imageType: GalleryImage["t"] =
    type === "p" || type === "g" || type === "w" || type === "j" ? type : "j";
  return {
    t: imageType,
    w: Number(raw.w) || 0,
    h: Number(raw.h) || 0,
    url: typeof raw.url === "string" ? raw.url : undefined,
    urlThumb: typeof raw.urlThumb === "string" ? raw.urlThumb : undefined,
  };
}

function parseTitle(raw: unknown): Gallery["title"] {
  if (!isRecord(raw)) {
    return { english: "", japanese: "", pretty: "" };
  }
  return {
    english: typeof raw.english === "string" ? raw.english : "",
    japanese: typeof raw.japanese === "string" ? raw.japanese : "",
    pretty: typeof raw.pretty === "string" ? raw.pretty : "",
  };
}

const TAG_TYPES = [
  "tag",
  "artist",
  "character",
  "parody",
  "group",
  "language",
  "category",
] as const;

function isTagType(value: unknown): value is Tag["type"] {
  return typeof value === "string" && (TAG_TYPES as readonly string[]).includes(value);
}

function parseTag(raw: unknown): Tag | null {
  if (!isRecord(raw) || typeof raw.name !== "string") return null;
  return {
    id: Number(raw.id) || 0,
    type: isTagType(raw.type) ? raw.type : "tag",
    name: raw.name,
    url: typeof raw.url === "string" ? raw.url : "",
    count: Number(raw.count) || 0,
  };
}

export function toHistoryGallery(gallery: Gallery | HistoryGallery): HistoryGallery {
  const cover = gallery.images?.cover ?? emptyImage();
  const thumbnail = gallery.images?.thumbnail ?? cover;
  return {
    id: Number(gallery.id),
    media_id: gallery.media_id ?? "",
    title: gallery.title ?? { english: "", japanese: "", pretty: "" },
    tags: Array.isArray(gallery.tags) ? gallery.tags : [],
    num_pages: gallery.num_pages || 1,
    images: { cover, thumbnail },
    scanlator: "scanlator" in gallery ? gallery.scanlator : undefined,
    upload_date: "upload_date" in gallery ? gallery.upload_date : undefined,
    num_favorites: "num_favorites" in gallery ? gallery.num_favorites : undefined,
    origin: gallery.origin,
    tag_ids: gallery.tag_ids,
  };
}

function normalizeEntry(raw: unknown): HistoryEntry | null {
  if (!isRecord(raw) || !isRecord(raw.gallery) || raw.gallery.id == null) {
    return null;
  }
  const rawGallery = raw.gallery;
  const rawImages = isRecord(rawGallery.images) ? rawGallery.images : {};
  const cover = parseImage(rawImages.cover);
  const thumbnail = parseImage(rawImages.thumbnail ?? rawImages.cover);
  const gallery: HistoryGallery = {
    id: Number(rawGallery.id),
    media_id: typeof rawGallery.media_id === "string" ? rawGallery.media_id : "",
    title: parseTitle(rawGallery.title),
    tags: Array.isArray(rawGallery.tags)
      ? rawGallery.tags.map(parseTag).filter((tag): tag is Tag => tag !== null)
      : [],
    num_pages: Number(rawGallery.num_pages) || 1,
    images: { cover, thumbnail },
    scanlator: typeof rawGallery.scanlator === "string" ? rawGallery.scanlator : undefined,
    upload_date: typeof rawGallery.upload_date === "number" ? rawGallery.upload_date : undefined,
    num_favorites: typeof rawGallery.num_favorites === "number" ? rawGallery.num_favorites : undefined,
    origin: rawGallery.origin === "cloud" || rawGallery.origin === "local" ? rawGallery.origin : undefined,
    tag_ids: Array.isArray(rawGallery.tag_ids)
      ? rawGallery.tag_ids.filter((id): id is number => typeof id === "number")
      : undefined,
  };
  return {
    gallery,
    lastPage: Math.max(0, Number(raw.lastPage) || 0),
    totalPages: Math.max(1, Number(raw.totalPages) || 1),
    readAt: Number(raw.readAt) || Date.now(),
    source: typeof raw.source === "string" && raw.source ? raw.source : undefined,
    localId: typeof raw.localId === "string" && raw.localId ? raw.localId : undefined,
  };
}

function entryMatches(
  entry: HistoryEntry,
  targetId: number,
  opts?: RecordProgressOptions
): boolean {
  if (opts?.localId) {
    return entry.localId === opts.localId;
  }
  if (opts?.source) {
    return (
      Number(entry.gallery?.id) === targetId &&
      (entry.source === opts.source || (!entry.source && opts.source === "nhentai"))
    );
  }
  return Number(entry.gallery?.id) === targetId && !entry.localId;
}

function persistHistory(): Promise<void> {
  const serialized = JSON.stringify(historyList);
  historyWritePromise = historyWritePromise
    .catch(() => {})
    .then(() => AsyncStorage.setItem(HISTORY_STORAGE_KEY, serialized));
  return historyWritePromise;
}

function schedulePersist(): void {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    void persistHistory();
  }, PERSIST_DEBOUNCE_MS);
}

function scheduleNotify(immediate: boolean): void {
  if (immediate) {
    if (notifyTimer) {
      clearTimeout(notifyTimer);
      notifyTimer = null;
    }
    notify();
    return;
  }
  if (notifyTimer) return;
  notifyTimer = setTimeout(() => {
    notifyTimer = null;
    notify();
  }, PERSIST_DEBOUNCE_MS);
}

export function flushHistoryPersist(): Promise<void> {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  if (notifyTimer) {
    clearTimeout(notifyTimer);
    notifyTimer = null;
    notify();
  }
  return persistHistory();
}

async function loadHistoryFromStorage(): Promise<void> {
  try {
    await historyWritePromise.catch(() => {});
    const raw = await AsyncStorage.getItem(HISTORY_STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      historyList = Array.isArray(parsed)
        ? parsed.map(normalizeEntry).filter((entry): entry is HistoryEntry => entry !== null)
        : [];
      notify();
    }
  } catch {}
}

export function initHistory(forceReload = false): Promise<void> {
  if (forceReload || !historyInitPromise) {
    historyInitPromise = loadHistoryFromStorage();
  }
  return historyInitPromise;
}

export function getHistory(): HistoryEntry[] {
  return historyList;
}

export async function recordReadingProgress(
  gallery: Gallery | HistoryGallery,
  page: number,
  totalPages?: number,
  opts?: RecordProgressOptions
): Promise<void> {
  if (isIncognito()) return;
  await initHistory();
  const preview = toHistoryGallery(gallery);
  const targetId = Number(preview.id);
  if (!Number.isFinite(targetId) && !opts?.localId) return;

  const lastPage = Math.max(0, page);
  const nextTotal = totalPages || preview.num_pages || 1;
  const source =
    opts?.source ||
    (typeof preview.scanlator === "string" && preview.scanlator ? preview.scanlator : undefined);
  const localId = opts?.localId;
  const matchOpts: RecordProgressOptions = { source, localId };

  const existingIndex = historyList.findIndex((entry) =>
    entryMatches(entry, targetId, matchOpts)
  );
  const isNew = existingIndex < 0;
  const existing = existingIndex >= 0 ? historyList[existingIndex] : undefined;

  if (
    existingIndex === 0 &&
    existing &&
    existing.lastPage === lastPage &&
    existing.totalPages === nextTotal &&
    existing.source === source &&
    existing.localId === localId
  ) {
    return;
  }

  const remaining = historyList.filter(
    (entry) => !entryMatches(entry, targetId, matchOpts)
  );
  const entry: HistoryEntry = {
    gallery: preview,
    lastPage,
    totalPages: nextTotal,
    readAt: Date.now(),
    source,
    localId,
  };
  historyList = [entry, ...remaining].slice(0, 200);
  schedulePersist();
  scheduleNotify(isNew);
}

/** Retrouve une entrée par localId ou (source + id). */
export function findHistoryEntry(opts: {
  id?: number | string;
  source?: string;
  localId?: string;
}): HistoryEntry | undefined {
  if (opts.localId) {
    return historyList.find((entry) => entry.localId === opts.localId);
  }
  const targetId = Number(opts.id);
  if (!Number.isFinite(targetId)) return undefined;
  return historyList.find((entry) =>
    entryMatches(entry, targetId, { source: opts.source })
  );
}

export async function clearHistory(): Promise<void> {
  await initHistory();
  historyList = [];
  await flushHistoryPersist();
}

export async function removeHistoryItem(id: number | string): Promise<void> {
  await initHistory();
  const targetId = Number(id);
  historyList = historyList.filter((entry) => Number(entry.gallery?.id) !== targetId);
  await flushHistoryPersist();
}

export function useHistory() {
  const [items, setItems] = useState<HistoryEntry[]>(historyList);

  useEffect(() => {
    const update = () => setItems([...historyList]);
    listeners.add(update);
    void initHistory();
    return () => {
      listeners.delete(update);
    };
  }, []);

  return {
    history: items,
    recordReadingProgress,
    removeHistoryItem,
    clearHistory,
  };
}

void initHistory();

import { create } from "zustand";
import {
  galleryGlobalId,
  makeGlobalId,
  type GlobalGalleryId,
} from "../utils/globalId";

export interface ReadingHistoryItem {
  /** Canonical key: nhentai:123 */
  id: GlobalGalleryId;
  mediaId?: string;
  title: string;
  coverUrl?: string;
  lastReadPage: number; // 0-indexed
  totalPages: number;
  lastReadAt: number;
  isLocal?: boolean;
  filePath?: string;
  sourceUnavailable?: boolean;
}

interface HistoryState {
  history: ReadingHistoryItem[];
  saveProgress: (
    item: Omit<ReadingHistoryItem, "lastReadAt" | "id"> & {
      id?: GlobalGalleryId | number;
      galleryId?: number;
      globalId?: GlobalGalleryId;
    }
  ) => void;
  getProgress: (id: GlobalGalleryId | number) => ReadingHistoryItem | undefined;
  getResumeCandidate: () => ReadingHistoryItem | undefined;
  removeHistoryItem: (id: GlobalGalleryId | number) => void;
  clearHistory: () => void;
}

const STORAGE_KEY = "nhentai_reading_history";

function asGlobalId(id: GlobalGalleryId | number): GlobalGalleryId {
  return typeof id === "number" ? makeGlobalId("nhentai", id) : String(id);
}

function normalizeHistoryEntry(raw: unknown): ReadingHistoryItem | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  let id: GlobalGalleryId | null = null;
  if (typeof item.id === "string" && item.id.includes(":")) {
    id = item.id;
  } else if (typeof item.id === "number" || typeof item.id === "string") {
    id = makeGlobalId("nhentai", item.id);
  } else if (typeof item.globalId === "string") {
    id = item.globalId;
  }
  if (!id || typeof item.title !== "string") return null;
  const source = id.split(":")[0];
  return {
    id,
    mediaId: typeof item.mediaId === "string" ? item.mediaId : undefined,
    title: item.title,
    coverUrl: typeof item.coverUrl === "string" ? item.coverUrl : undefined,
    lastReadPage: Number(item.lastReadPage) || 0,
    totalPages: Number(item.totalPages) || 1,
    lastReadAt: typeof item.lastReadAt === "number" ? item.lastReadAt : Date.now(),
    isLocal: Boolean(item.isLocal),
    filePath: typeof item.filePath === "string" ? item.filePath : undefined,
    sourceUnavailable: source !== "nhentai",
  };
}

const loadInitialHistory = (): ReadingHistoryItem[] => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return [];
    const next = parsed
      .map(normalizeHistoryEntry)
      .filter((item): item is ReadingHistoryItem => item !== null);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    return next;
  } catch {
    return [];
  }
};

export const useHistoryStore = create<HistoryState>((set, get) => ({
  history: loadInitialHistory(),

  saveProgress: (item) => {
    const id =
      (typeof item.globalId === "string" && item.globalId) ||
      (item.id != null ? asGlobalId(item.id) : null) ||
      (item.galleryId != null ? makeGlobalId("nhentai", item.galleryId) : null);
    if (!id) return;

    const prevList = get().history.filter((h) => h.id !== id);
    const updatedItem: ReadingHistoryItem = {
      id,
      mediaId: item.mediaId,
      title: item.title,
      coverUrl: item.coverUrl,
      lastReadPage: item.lastReadPage,
      totalPages: item.totalPages,
      isLocal: item.isLocal,
      filePath: item.filePath,
      sourceUnavailable: id.split(":")[0] !== "nhentai",
      lastReadAt: Date.now(),
    };
    const nextList = [updatedItem, ...prevList].slice(0, 150);
    set({ history: nextList });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextList));
    } catch (e) {
      console.error("Failed to persist reading history:", e);
    }
  },

  getProgress: (id) => {
    const gid = asGlobalId(id);
    return get().history.find((h) => h.id === gid);
  },

  getResumeCandidate: () => {
    return get().history.find((entry) => {
      const total = entry.totalPages || 1;
      return (
        !entry.sourceUnavailable &&
        entry.lastReadPage > 0 &&
        total > 1 &&
        entry.lastReadPage < total - 1
      );
    });
  },

  removeHistoryItem: (id) => {
    const gid = asGlobalId(id);
    const nextList = get().history.filter((h) => h.id !== gid);
    set({ history: nextList });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextList));
    } catch {
      /* ignore */
    }
  },

  clearHistory: () => {
    set({ history: [] });
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  },
}));

/** Helper for callers that still pass a Gallery object. */
export function historyIdFromGallery(gallery: {
  id: number;
  globalId?: string;
}): GlobalGalleryId {
  return galleryGlobalId(gallery);
}

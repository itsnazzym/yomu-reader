import { create } from "zustand";
import { Gallery } from "../types";
import {
  galleryGlobalId,
  makeGlobalId,
  splitGlobalId,
  type GlobalGalleryId,
} from "../utils/globalId";

export interface LocalFavoriteItem {
  /** Canonical key: nhentai:123 (or other source when imported from mobile). */
  id: GlobalGalleryId;
  gallery: Gallery & { globalId?: string };
  addedAt: number;
  customCategory?: string;
  /** When source is not nhentai, desktop cannot open the online catalog. */
  sourceUnavailable?: boolean;
}

interface FavoriteState {
  favorites: LocalFavoriteItem[];
  toggleFavorite: (gallery: Gallery, customCategory?: string) => boolean;
  isFavorite: (id: GlobalGalleryId | number) => boolean;
  removeFavorite: (id: GlobalGalleryId | number) => void;
  exportFavoritesJson: () => string;
  importFavoritesJson: (jsonStr: string) => boolean;
  clearFavorites: () => void;
}

const STORAGE_KEY = "nhentai_local_favorites";

function normalizeFavoriteEntry(raw: unknown): LocalFavoriteItem | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  const gallery = item.gallery as (Gallery & { globalId?: string }) | undefined;
  if (!gallery) return null;

  let id: GlobalGalleryId;
  if (typeof item.id === "string" && item.id.includes(":")) {
    id = item.id;
  } else if (typeof item.id === "number" || typeof item.id === "string") {
    id = makeGlobalId("nhentai", item.id);
  } else if (gallery.globalId) {
    id = gallery.globalId;
  } else if (gallery.id != null) {
    id = makeGlobalId("nhentai", gallery.id);
  } else {
    return null;
  }

  const { source } = splitGlobalId(id);
  const tags = Array.isArray(gallery.tags) ? gallery.tags : [];
  return {
    id,
    gallery: {
      ...gallery,
      id: typeof gallery.id === "number" ? gallery.id : Number.parseInt(splitGlobalId(id).nativeId, 10) || 0,
      tags,
      globalId: id,
    },
    addedAt: typeof item.addedAt === "number" ? item.addedAt : Date.now(),
    customCategory:
      typeof item.customCategory === "string" ? item.customCategory : undefined,
    sourceUnavailable: source !== "nhentai",
  };
}

const loadInitialFavorites = (): LocalFavoriteItem[] => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return [];
    const next = parsed
      .map(normalizeFavoriteEntry)
      .filter((item): item is LocalFavoriteItem => item !== null);
    // Persist migration to GlobalGalleryId keys once.
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore quota */
    }
    return next;
  } catch {
    return [];
  }
};

function asGlobalId(id: GlobalGalleryId | number): GlobalGalleryId {
  return typeof id === "number" ? makeGlobalId("nhentai", id) : String(id);
}

export const useFavoriteStore = create<FavoriteState>((set, get) => ({
  favorites: loadInitialFavorites(),

  toggleFavorite: (gallery, customCategory) => {
    const gid = galleryGlobalId(gallery);
    const exists = get().favorites.some((f) => f.id === gid);
    let nextList: LocalFavoriteItem[];
    let added = false;

    if (exists) {
      nextList = get().favorites.filter((f) => f.id !== gid);
      added = false;
    } else {
      const { source } = splitGlobalId(gid);
      nextList = [
        {
          id: gid,
          gallery: { ...gallery, globalId: gid },
          addedAt: Date.now(),
          customCategory,
          sourceUnavailable: source !== "nhentai",
        },
        ...get().favorites,
      ];
      added = true;
    }

    set({ favorites: nextList });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextList));
    } catch (e) {
      console.error("Failed to persist favorites:", e);
    }
    return added;
  },

  isFavorite: (id) => {
    const gid = asGlobalId(id);
    return get().favorites.some((f) => f.id === gid);
  },

  removeFavorite: (id) => {
    const gid = asGlobalId(id);
    const nextList = get().favorites.filter((f) => f.id !== gid);
    set({ favorites: nextList });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextList));
    } catch {
      /* ignore */
    }
  },

  exportFavoritesJson: () => {
    return JSON.stringify(get().favorites, null, 2);
  },

  importFavoritesJson: (jsonStr) => {
    try {
      const parsed = JSON.parse(jsonStr);
      if (!Array.isArray(parsed)) return false;
      const mergedMap = new Map<GlobalGalleryId, LocalFavoriteItem>();
      get().favorites.forEach((f) => mergedMap.set(f.id, f));
      parsed.forEach((item: unknown) => {
        const normalized = normalizeFavoriteEntry(item);
        if (normalized) mergedMap.set(normalized.id, normalized);
      });
      const nextList = Array.from(mergedMap.values()).sort(
        (a, b) => b.addedAt - a.addedAt
      );
      set({ favorites: nextList });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextList));
      return true;
    } catch (e) {
      console.error("Import favorites failed:", e);
    }
    return false;
  },

  clearFavorites: () => {
    set({ favorites: [] });
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  },
}));

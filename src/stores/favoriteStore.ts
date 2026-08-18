import { create } from "zustand";
import { Gallery } from "../types";

export interface LocalFavoriteItem {
  id: number;
  gallery: Gallery;
  addedAt: number;
  customCategory?: string;
}

interface FavoriteState {
  favorites: LocalFavoriteItem[];
  toggleFavorite: (gallery: Gallery, customCategory?: string) => boolean;
  isFavorite: (id: number) => boolean;
  removeFavorite: (id: number) => void;
  exportFavoritesJson: () => string;
  importFavoritesJson: (jsonStr: string) => boolean;
  clearFavorites: () => void;
}

const STORAGE_KEY = "nhentai_local_favorites";

const loadInitialFavorites = (): LocalFavoriteItem[] => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((item) => item && item.id && item.gallery)
        .map((item) => ({
          ...item,
          gallery: {
            ...item.gallery,
            tags: Array.isArray(item.gallery.tags) ? item.gallery.tags : [],
          },
        }));
    }
  } catch {
    return [];
  }
  return [];
};

export const useFavoriteStore = create<FavoriteState>((set, get) => ({
  favorites: loadInitialFavorites(),

  toggleFavorite: (gallery, customCategory) => {
    const exists = get().favorites.some((f) => f.id === gallery.id);
    let nextList: LocalFavoriteItem[];
    let added = false;

    if (exists) {
      nextList = get().favorites.filter((f) => f.id !== gallery.id);
      added = false;
    } else {
      nextList = [{ id: gallery.id, gallery, addedAt: Date.now(), customCategory }, ...get().favorites];
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
    return get().favorites.some((f) => f.id === id);
  },

  removeFavorite: (id) => {
    const nextList = get().favorites.filter((f) => f.id !== id);
    set({ favorites: nextList });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextList));
    } catch (e) {}
  },

  exportFavoritesJson: () => {
    return JSON.stringify(get().favorites, null, 2);
  },

  importFavoritesJson: (jsonStr) => {
    try {
      const parsed = JSON.parse(jsonStr);
      if (Array.isArray(parsed)) {
        const mergedMap = new Map<number, LocalFavoriteItem>();
        // Add existing
        get().favorites.forEach((f) => mergedMap.set(f.id, f));
        // Merge imported
        parsed.forEach((item: any) => {
          if (item && item.id && item.gallery) {
            mergedMap.set(item.id, {
              id: item.id,
              gallery: item.gallery,
              addedAt: item.addedAt || Date.now(),
              customCategory: item.customCategory,
            });
          }
        });
        const nextList = Array.from(mergedMap.values()).sort((a, b) => b.addedAt - a.addedAt);
        set({ favorites: nextList });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(nextList));
        return true;
      }
    } catch (e) {
      console.error("Import favorites failed:", e);
    }
    return false;
  },

  clearFavorites: () => {
    set({ favorites: [] });
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
  },
}));

import { create } from "zustand";

export interface ReadingHistoryItem {
  id: number;
  mediaId?: string;
  title: string;
  coverUrl?: string;
  lastReadPage: number; // 0-indexed
  totalPages: number;
  lastReadAt: number; // timestamp
  isLocal?: boolean;
  filePath?: string;
}

interface HistoryState {
  history: ReadingHistoryItem[];
  saveProgress: (item: Omit<ReadingHistoryItem, "lastReadAt">) => void;
  getProgress: (id: number) => ReadingHistoryItem | undefined;
  removeHistoryItem: (id: number) => void;
  clearHistory: () => void;
}

const STORAGE_KEY = "nhentai_reading_history";

const loadInitialHistory = (): ReadingHistoryItem[] => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    if (Array.isArray(parsed)) {
      return parsed.filter((item) => item && item.id && item.title);
    }
  } catch {
    return [];
  }
  return [];
};

export const useHistoryStore = create<HistoryState>((set, get) => ({
  history: loadInitialHistory(),

  saveProgress: (item) => {
    const prevList = get().history.filter((h) => h.id !== item.id);
    const updatedItem: ReadingHistoryItem = {
      ...item,
      lastReadAt: Date.now(),
    };
    const nextList = [updatedItem, ...prevList].slice(0, 150); // Keep last 150 read
    set({ history: nextList });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextList));
    } catch (e) {
      console.error("Failed to persist reading history:", e);
    }
  },

  getProgress: (id) => {
    return get().history.find((h) => h.id === id);
  },

  removeHistoryItem: (id) => {
    const nextList = get().history.filter((h) => h.id !== id);
    set({ history: nextList });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextList));
    } catch (e) {}
  },

  clearHistory: () => {
    set({ history: [] });
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
  },
}));

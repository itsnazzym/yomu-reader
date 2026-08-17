import AsyncStorage from "@react-native-async-storage/async-storage";
import { useState, useEffect } from "react";
import { Gallery } from "./api/types";

const HISTORY_KEY = "@nhentai_reading_history_v1";

export interface HistoryEntry {
  gallery: Gallery;
  lastPage: number;
  totalPages: number;
  readAt: number;
}

let historyList: HistoryEntry[] = [];
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

export async function initHistory() {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    if (raw) {
      historyList = JSON.parse(raw);
      notify();
    }
  } catch {}
}

export function getHistory(): HistoryEntry[] {
  return historyList;
}

export async function recordReadingProgress(
  gallery: Gallery,
  page: number,
  totalPages?: number
) {
  const existing = historyList.filter((h) => h.gallery.id !== gallery.id);
  const entry: HistoryEntry = {
    gallery,
    lastPage: Math.max(0, page),
    totalPages: totalPages || gallery.num_pages || gallery.images?.pages?.length || 1,
    readAt: Date.now(),
  };
  historyList = [entry, ...existing].slice(0, 200);
  await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(historyList));
  notify();
}

export async function clearHistory() {
  historyList = [];
  await AsyncStorage.removeItem(HISTORY_KEY);
  notify();
}

export async function removeHistoryItem(id: number) {
  historyList = historyList.filter((h) => h.gallery.id !== id);
  await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(historyList));
  notify();
}

export function useHistory() {
  const [items, setItems] = useState<HistoryEntry[]>(historyList);

  useEffect(() => {
    const update = () => setItems([...historyList]);
    listeners.add(update);
    initHistory();
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

initHistory();

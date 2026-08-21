import AsyncStorage from "@react-native-async-storage/async-storage";
import { useState, useEffect } from "react";
import { Gallery } from "./api/types";

export const HISTORY_STORAGE_KEY = "@nhentai_reading_history_v1";

export interface HistoryEntry {
  gallery: Gallery;
  lastPage: number;
  totalPages: number;
  readAt: number;
}

let historyList: HistoryEntry[] = [];
let historyInitPromise: Promise<void> | null = null;
let historyWritePromise: Promise<void> = Promise.resolve();
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

function persistHistory(): Promise<void> {
  const serialized = JSON.stringify(historyList);
  historyWritePromise = historyWritePromise
    .catch(() => {})
    .then(() => AsyncStorage.setItem(HISTORY_STORAGE_KEY, serialized));
  return historyWritePromise;
}

async function loadHistoryFromStorage(): Promise<void> {
  try {
    await historyWritePromise.catch(() => {});
    const raw = await AsyncStorage.getItem(HISTORY_STORAGE_KEY);
    if (raw) {
      historyList = JSON.parse(raw);
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
  gallery: Gallery,
  page: number,
  totalPages?: number
) {
  await initHistory();
  const targetId = Number(gallery?.id);
  const existing = historyList.filter((h) => Number(h.gallery?.id) !== targetId);
  const entry: HistoryEntry = {
    gallery,
    lastPage: Math.max(0, page),
    totalPages: totalPages || gallery.num_pages || gallery.images?.pages?.length || 1,
    readAt: Date.now(),
  };
  historyList = [entry, ...existing].slice(0, 200);
  await persistHistory();
  notify();
}

export async function clearHistory() {
  await initHistory();
  historyList = [];
  await persistHistory();
  notify();
}

export async function removeHistoryItem(id: number | string) {
  await initHistory();
  const targetId = Number(id);
  historyList = historyList.filter((h) => Number(h.gallery?.id) !== targetId);
  await persistHistory();
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

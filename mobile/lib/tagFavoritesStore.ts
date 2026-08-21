import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { createInitOnce, createWriteQueue } from "./persistQueue";

export const TAG_FAVORITES_STORAGE_KEY = "@nh_fav_tags_v1";

export interface FavTagItem {
  type: string;
  name: string;
  category?: string;
  count?: number;
}

let favTagsState: Record<string, FavTagItem> = {};
const listeners = new Set<() => void>();
const writes = createWriteQueue();

function notify() {
  for (const l of listeners) l();
}

function tagKey(type: string, name: string): string {
  return `${type.toLowerCase()}:${name.toLowerCase()}`;
}

async function loadFromStorage() {
  await writes.flush();
  try {
    const raw = await AsyncStorage.getItem(TAG_FAVORITES_STORAGE_KEY);
    if (raw) {
      favTagsState = JSON.parse(raw);
      notify();
    }
  } catch {}
}

export const initTagFavs = createInitOnce(loadFromStorage);

function persistTagFavs(): Promise<void> {
  const serialized = JSON.stringify(favTagsState);
  return writes.enqueue(() => AsyncStorage.setItem(TAG_FAVORITES_STORAGE_KEY, serialized));
}

export function isTagFav(type: string, name: string): boolean {
  return Boolean(favTagsState[tagKey(type, name)]);
}

export async function toggleTagFav(item: { type: string; name: string; category?: string; count?: number }) {
  await initTagFavs();
  const k = tagKey(item.type, item.name);
  if (favTagsState[k]) {
    const copy = { ...favTagsState };
    delete copy[k];
    favTagsState = copy;
  } else {
    favTagsState = {
      ...favTagsState,
      [k]: {
        type: item.type,
        name: item.name,
        category: item.category,
        count: item.count,
      },
    };
  }
  notify();
  await persistTagFavs();
}

export function getFavTagsList(): FavTagItem[] {
  return Object.values(favTagsState);
}

export function useTagFavs() {
  const [favMap, setFavMap] = useState<Record<string, FavTagItem>>(favTagsState);

  useEffect(() => {
    const update = () => setFavMap({ ...favTagsState });
    listeners.add(update);
    void initTagFavs();
    return () => {
      listeners.delete(update);
    };
  }, []);

  const isFav = (type: string, name: string) => Boolean(favMap[tagKey(type, name)]);

  const toggleFav = (item: { type: string; name: string; category?: string; count?: number }) => {
    void toggleTagFav(item);
  };

  const favoriteList = Object.values(favMap);

  return {
    isFav,
    toggleFav,
    favoriteList,
    favCount: favoriteList.length,
  };
}

void initTagFavs();

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

const TAG_FAVS_STORAGE_KEY = "@nh_fav_tags_v1";

export interface FavTagItem {
  type: string;
  name: string;
  category?: string;
  count?: number;
}

let favTagsState: Record<string, FavTagItem> = {};
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

function tagKey(type: string, name: string): string {
  return `${type.toLowerCase()}:${name.toLowerCase()}`;
}

async function loadFromStorage() {
  try {
    const raw = await AsyncStorage.getItem(TAG_FAVS_STORAGE_KEY);
    if (raw) {
      favTagsState = JSON.parse(raw);
      notify();
    }
  } catch {}
}

export async function initTagFavs() {
  await loadFromStorage();
}

loadFromStorage();

async function saveToStorage() {
  try {
    await AsyncStorage.setItem(TAG_FAVS_STORAGE_KEY, JSON.stringify(favTagsState));
  } catch {}
}

export function isTagFav(type: string, name: string): boolean {
  return Boolean(favTagsState[tagKey(type, name)]);
}

export function toggleTagFav(item: { type: string; name: string; category?: string; count?: number }) {
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
  void saveToStorage();
}

export function getFavTagsList(): FavTagItem[] {
  return Object.values(favTagsState);
}

export function useTagFavs() {
  const [favMap, setFavMap] = useState<Record<string, FavTagItem>>(favTagsState);

  useEffect(() => {
    const update = () => setFavMap({ ...favTagsState });
    listeners.add(update);
    return () => {
      listeners.delete(update);
    };
  }, []);

  const isFav = (type: string, name: string) => Boolean(favMap[tagKey(type, name)]);

  const toggleFav = (item: { type: string; name: string; category?: string; count?: number }) => {
    toggleTagFav(item);
  };

  const favoriteList = Object.values(favMap);

  return {
    isFav,
    toggleFav,
    favoriteList,
    favCount: favoriteList.length,
  };
}

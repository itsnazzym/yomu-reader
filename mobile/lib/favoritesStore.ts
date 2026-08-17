import AsyncStorage from "@react-native-async-storage/async-storage";
import { useState, useEffect } from "react";
import { Gallery } from "./api/types";

const FAVORITES_KEY = "@nhentai_favorites_v1";

let favoritesList: Gallery[] = [];
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

export async function initFavorites() {
  try {
    const raw = await AsyncStorage.getItem(FAVORITES_KEY);
    if (raw) {
      favoritesList = JSON.parse(raw);
      notify();
    }
  } catch {}
}

export function getFavorites(): Gallery[] {
  return favoritesList;
}

export function isFavorite(id: number): boolean {
  return favoritesList.some((g) => g.id === id);
}

export async function toggleFavorite(gallery: Gallery) {
  const exists = favoritesList.some((g) => g.id === gallery.id);
  if (exists) {
    favoritesList = favoritesList.filter((g) => g.id !== gallery.id);
  } else {
    favoritesList = [gallery, ...favoritesList];
  }
  await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(favoritesList));
  notify();
}

export async function removeFavorite(id: number) {
  favoritesList = favoritesList.filter((g) => g.id !== id);
  await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(favoritesList));
  notify();
}

export async function importFavorites(importedList: Gallery[]) {
  const map = new Map<number, Gallery>();
  // Existing local favs
  favoritesList.forEach((g) => map.set(Number(g.id), g));
  // Merge cloud favs
  importedList.forEach((g) => map.set(Number(g.id), g));

  favoritesList = Array.from(map.values());
  await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(favoritesList));
  notify();
}

export function useFavorites() {
  const [favs, setFavs] = useState<Gallery[]>(favoritesList);

  useEffect(() => {
    const update = () => setFavs([...favoritesList]);
    listeners.add(update);
    initFavorites();
    return () => {
      listeners.delete(update);
    };
  }, []);

  return {
    favorites: favs,
    isFavorite: (id: number) => favs.some((g) => g.id === id),
    toggleFavorite,
    removeFavorite,
    importFavorites,
  };
}

initFavorites();

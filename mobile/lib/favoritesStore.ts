import AsyncStorage from "@react-native-async-storage/async-storage";
import { useState, useEffect } from "react";
import { Gallery } from "./api/types";

const FAVORITES_KEY = "@nhentai_favorites_v1";

let favoritesList: Gallery[] = [];
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

/** Un titre « Gallery #id » = données pauvres (ancien proxy / API v2 non mappée). */
function isPlaceholderTitle(g: Gallery): boolean {
  const t = g.title;
  if (!t || (!t.pretty && !t.english)) return true;
  const placeholder = `Gallery #${g.id}`;
  return t.pretty === placeholder || t.english === placeholder;
}

export async function initFavorites() {
  try {
    const raw = await AsyncStorage.getItem(FAVORITES_KEY);
    if (raw) {
      favoritesList = JSON.parse(raw);
      // Migration : inférer la source des anciens favoris (sans champ source).
      // Un titre placeholder « Gallery #id » = importé du cloud (données pauvres
      // de l'ancien proxy) ; un vrai titre = ajouté localement via l'app.
      let migrated = false;
      favoritesList = favoritesList.map((g) => {
        if (g.source) return g;
        migrated = true;
        return { ...g, source: isPlaceholderTitle(g) ? "cloud" : "local" };
      });
      if (migrated) {
        await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(favoritesList));
      }
      notify();
    }
  } catch {}
}

/** Vrai si le store contient encore des favoris « Gallery #id » non enrichis. */
export function hasPlaceholderFavorites(): boolean {
  return favoritesList.some(isPlaceholderTitle);
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
    // Un favori ajouté via l'app est un signet LOCAL (source "local").
    favoritesList = [{ ...gallery, source: "local" }, ...favoritesList];
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
  // Fusion idempotente avec enrichissement, en préservant les données locales :
  // - un favori du site absent localement est AJOUTÉ (source "cloud") ;
  // - un favori existant dont le titre est un placeholder (« Gallery #id »,
  //   données pauvres de l'ancien proxy) est REMPLACÉ par la copie cloud riche ;
  // - un favori local (vrai titre) n'est jamais remplacé — on ne fait que
  //   combler ses tags s'ils sont vides. Relancer une synchro ne change donc
  //   rien aux favoris déjà synchronisés et complets.
  const byId = new Map<number, Gallery>(favoritesList.map((g) => [Number(g.id), g]));
  for (const incoming of importedList) {
    const id = Number(incoming.id);
    const existing = byId.get(id);
    if (!existing) {
      byId.set(id, { ...incoming, source: "cloud" });
      continue;
    }
    if (isPlaceholderTitle(existing)) {
      // La copie cloud est désormais plus riche que l'existant : remplacement.
      byId.set(id, { ...incoming, source: "cloud" });
      continue;
    }
    if (!existing.tags?.length && incoming.tags?.length) {
      byId.set(id, { ...existing, tags: incoming.tags, tag_ids: incoming.tag_ids });
    }
  }

  favoritesList = [...byId.values()];
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

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useState, useEffect } from "react";
import { Gallery } from "./api/types";
import {
  makeGlobalId,
  splitGlobalId,
  type GlobalGalleryId,
} from "./sources/types";

export const FAVORITES_STORAGE_KEY = "@nhentai_favorites_v1";

let favoritesList: Gallery[] = [];
let favoritesInitPromise: Promise<void> | null = null;
let favoritesWritePromise: Promise<void> = Promise.resolve();
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

/**
 * globalId d'un favori : champ dédié si présent, sinon dérivé de galleryId,
 * sinon composé depuis l'id numérique (legacy nhentai).
 */
export function favoriteGlobalId(g: Gallery): GlobalGalleryId {
  const anyG = g as Gallery & { globalId?: string; galleryId?: string };
  if (anyG.globalId) return anyG.globalId;
  if (anyG.galleryId) return anyG.galleryId;
  return makeGlobalId("nhentai", g.id);
}

function persistFavorites(): Promise<void> {
  const serialized = JSON.stringify(favoritesList);
  favoritesWritePromise = favoritesWritePromise
    .catch(() => {})
    .then(() => AsyncStorage.setItem(FAVORITES_STORAGE_KEY, serialized));
  return favoritesWritePromise;
}

/** Un titre « Gallery #id » = données pauvres (ancien proxy / API v2 non mappée). */
function isPlaceholderTitle(g: Gallery): boolean {
  const t = g.title;
  if (!t || (!t.pretty && !t.english)) return true;
  const placeholder = `Gallery #${g.id}`;
  return t.pretty === placeholder || t.english === placeholder;
}

/** Migration : garantit un globalId sur chaque favori. */
function migrateGlobalIds(list: Gallery[]): { list: Gallery[]; changed: boolean } {
  let changed = false;
  const migrated = list.map((g) => {
    const gid = favoriteGlobalId(g);
    if ((g as Gallery & { globalId?: string }).globalId === gid) return g;
    changed = true;
    return { ...(g as object), globalId: gid } as Gallery;
  });
  return { list: migrated, changed };
}

async function loadFavoritesFromStorage(): Promise<void> {
  try {
    await favoritesWritePromise.catch(() => {});
    const raw = await AsyncStorage.getItem(FAVORITES_STORAGE_KEY);
    if (raw) {
      favoritesList = JSON.parse(raw);
      // Migration : inférer la source des anciens favoris (sans champ source).
      // Un titre placeholder « Gallery #id » = importé du cloud (données pauvres
      // de l'ancien proxy) ; un vrai titre = ajouté localement via l'app.
      let migrated = false;
      favoritesList = favoritesList.map((g) => {
        if (g.origin) return g;
        migrated = true;
        return { ...g, source: isPlaceholderTitle(g) ? "cloud" : "local" };
      });
      // Migration multi-sources : composer les ids globaux.
      const gm = migrateGlobalIds(favoritesList);
      favoritesList = gm.list;
      if (migrated || gm.changed) {
        await persistFavorites();
      }
      notify();
    }
  } catch {}
}

export function initFavorites(forceReload = false): Promise<void> {
  if (forceReload || !favoritesInitPromise) {
    favoritesInitPromise = loadFavoritesFromStorage();
  }
  return favoritesInitPromise;
}

/** Vrai si le store contient encore des favoris « Gallery #id » non enrichis. */
export function hasPlaceholderFavorites(): boolean {
  return favoritesList.some(isPlaceholderTitle);
}

export function getFavorites(): Gallery[] {
  return favoritesList;
}

/** Favori présent pour un id global ("3hentai:719") ou numérique legacy. */
export function isFavorite(id: number | string | GlobalGalleryId): boolean {
  const target = typeof id === "string" && id.includes(":") ? id : makeGlobalId("nhentai", Number(id));
  return favoritesList.some((g) => favoriteGlobalId(g) === target);
}

export async function toggleFavorite(
  gallery: Gallery & { sourceName?: "nhentai" | "3hentai" | "doujins" }
) {
  await initFavorites();
  const sourceName = gallery.sourceName || splitGlobalId(String(gallery.id)).source;
  const gid =
    String(gallery.id).includes(":")
      ? (String(gallery.id) as GlobalGalleryId)
      : makeGlobalId(sourceName, gallery.id);
  const exists = favoritesList.some((g) => favoriteGlobalId(g) === gid);
  if (exists) {
    favoritesList = favoritesList.filter((g) => favoriteGlobalId(g) !== gid);
  } else {
    // Un favori ajouté via l'app est un signet LOCAL (source "local").
    favoritesList = [
      { ...gallery, id: gallery.id, origin: "local", globalId: gid } as Gallery,
      ...favoritesList,
    ];
  }
  await persistFavorites();
  notify();
}

export async function removeFavorite(id: number | string | GlobalGalleryId) {
  await initFavorites();
  const target =
    typeof id === "string" && id.includes(":") ? id : makeGlobalId("nhentai", Number(id));
  favoritesList = favoritesList.filter((g) => favoriteGlobalId(g) !== target);
  await persistFavorites();
  notify();
}

export async function importFavorites(importedList: Gallery[]) {
  await initFavorites();
  // Fusion idempotente nhentai-cloud uniquement (les autres sources n'ont pas
  // de cloud). Les ids globaux non-nhentai sont préservés tels quels.
  const byKey = new Map<string, Gallery>(
    favoritesList.map((g) => [favoriteGlobalId(g), g])
  );
  for (const incoming of importedList) {
    const key = makeGlobalId("nhentai", incoming.id);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, {
        ...incoming,
        origin: "cloud",
        globalId: key,
      } as Gallery);
      continue;
    }
    if (isPlaceholderTitle(existing)) {
      byKey.set(key, { ...incoming, origin: "cloud", globalId: key } as Gallery);
      continue;
    }
    if (!existing.tags?.length && incoming.tags?.length) {
      byKey.set(key, { ...existing, tags: incoming.tags, tag_ids: incoming.tag_ids });
    }
  }

  favoritesList = [...byKey.values()];
  await persistFavorites();
  notify();
}

export async function removeCloudFavorites(): Promise<void> {
  await initFavorites();
  const localOnly = favoritesList.filter((gallery) => gallery.origin !== "cloud");
  if (localOnly.length === favoritesList.length) return;
  favoritesList = localOnly;
  await persistFavorites();
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
    isFavorite: (id: number | string) =>
      favs.some((g) =>
        typeof id === "string" && id.includes(":")
          ? favoriteGlobalId(g) === id
          : Number(g.id) === Number(id)
      ),
    toggleFavorite,
    removeFavorite,
    importFavorites,
  };
}

initFavorites();

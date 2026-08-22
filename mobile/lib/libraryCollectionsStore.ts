import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { createInitOnce, createWriteQueue } from "./persistQueue";

export const LIBRARY_COLLECTIONS_STORAGE_KEY = "@nhentai_library_collections_v1";

export interface LibraryCollection {
  id: string;
  name: string;
  color: string;
  hidden: boolean;
  galleryIds: number[];
  localIds: string[];
  createdAt: number;
  updatedAt: number;
}

let currentCollections: LibraryCollection[] = [];
const listeners = new Set<() => void>();
const writes = createWriteQueue();

function notify(): void {
  for (const listener of listeners) listener();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseCollection(raw: unknown): LibraryCollection | null {
  if (!isRecord(raw) || typeof raw.id !== "string" || typeof raw.name !== "string") {
    return null;
  }
  return {
    id: raw.id,
    name: raw.name,
    color: typeof raw.color === "string" ? raw.color : "#60a5fa",
    hidden: raw.hidden === true,
    galleryIds: Array.isArray(raw.galleryIds)
      ? raw.galleryIds.filter((id): id is number => typeof id === "number" && Number.isFinite(id))
      : [],
    localIds: Array.isArray(raw.localIds)
      ? raw.localIds.filter((id): id is string => typeof id === "string")
      : [],
    createdAt: Number(raw.createdAt) || Date.now(),
    updatedAt: Number(raw.updatedAt) || Date.now(),
  };
}

async function loadCollections(): Promise<void> {
  await writes.flush();
  try {
    const raw = await AsyncStorage.getItem(LIBRARY_COLLECTIONS_STORAGE_KEY);
    if (!raw) return;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;
    currentCollections = parsed
      .map(parseCollection)
      .filter((item): item is LibraryCollection => item !== null);
    notify();
  } catch (error) {
    console.warn("[libraryCollections] load failed:", error);
  }
}

export const initLibraryCollections = createInitOnce(loadCollections);

async function persist(): Promise<void> {
  const serialized = JSON.stringify(currentCollections);
  await writes.enqueue(() =>
    AsyncStorage.setItem(LIBRARY_COLLECTIONS_STORAGE_KEY, serialized)
  );
}

export function getLibraryCollectionsSnapshot(): LibraryCollection[] {
  return currentCollections;
}

export async function createLibraryCollection(
  name: string,
  options?: { color?: string; hidden?: boolean }
): Promise<LibraryCollection> {
  await initLibraryCollections();
  const collection: LibraryCollection = {
    id: `libcol_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: name.trim() || "Sans titre",
    color: options?.color || "#60a5fa",
    hidden: options?.hidden === true,
    galleryIds: [],
    localIds: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  currentCollections = [collection, ...currentCollections];
  notify();
  await persist();
  return collection;
}

export async function updateLibraryCollection(
  id: string,
  patch: Partial<Pick<LibraryCollection, "name" | "color" | "hidden">>
): Promise<void> {
  await initLibraryCollections();
  currentCollections = currentCollections.map((col) =>
    col.id === id ? { ...col, ...patch, updatedAt: Date.now() } : col
  );
  notify();
  await persist();
}

export async function deleteLibraryCollection(id: string): Promise<void> {
  await initLibraryCollections();
  currentCollections = currentCollections.filter((col) => col.id !== id);
  notify();
  await persist();
}

export function collectionContains(
  collection: LibraryCollection,
  galleryId: number,
  localId?: string
): boolean {
  if (collection.galleryIds.includes(galleryId)) return true;
  if (localId && collection.localIds.includes(localId)) return true;
  return false;
}

export async function toggleLibraryCollectionMembership(
  collectionId: string,
  galleryId: number,
  localId?: string
): Promise<void> {
  await initLibraryCollections();
  currentCollections = currentCollections.map((col) => {
    if (col.id !== collectionId) return col;
    const hasGallery = col.galleryIds.includes(galleryId);
    const hasLocal = localId ? col.localIds.includes(localId) : false;
    const nextHas = !(hasGallery || hasLocal);
    return {
      ...col,
      galleryIds: nextHas
        ? Array.from(new Set([...col.galleryIds, galleryId]))
        : col.galleryIds.filter((id) => id !== galleryId),
      localIds: localId
        ? nextHas
          ? Array.from(new Set([...col.localIds, localId]))
          : col.localIds.filter((id) => id !== localId)
        : col.localIds,
      updatedAt: Date.now(),
    };
  });
  notify();
  await persist();
}

export function useLibraryCollections(): {
  collections: LibraryCollection[];
  createCollection: typeof createLibraryCollection;
  updateCollection: typeof updateLibraryCollection;
  deleteCollection: typeof deleteLibraryCollection;
  toggleMembership: typeof toggleLibraryCollectionMembership;
} {
  const [collections, setCollections] = useState<LibraryCollection[]>(currentCollections);

  useEffect(() => {
    const update = (): void => {
      setCollections([...currentCollections]);
    };
    listeners.add(update);
    void initLibraryCollections();
    return () => {
      listeners.delete(update);
    };
  }, []);

  return {
    collections,
    createCollection: createLibraryCollection,
    updateCollection: updateLibraryCollection,
    deleteCollection: deleteLibraryCollection,
    toggleMembership: toggleLibraryCollectionMembership,
  };
}

void initLibraryCollections();

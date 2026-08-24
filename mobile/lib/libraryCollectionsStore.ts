/**
 * Collections bibliothèque : étagères manuelles + smart (règles tags).
 * Identité multi-sources via globalIds (migration depuis galleryIds number[]).
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import type { Gallery } from "./api/types";
import type { LocalLibraryEntry } from "./localLibrary";
import { createInitOnce, createWriteQueue } from "./persistQueue";
import { makeGlobalId } from "./sources/types";
import type { TagCollectionItem } from "./tagCollectionsStore";

export const LIBRARY_COLLECTIONS_STORAGE_KEY = "@nhentai_library_collections_v1";

export interface SmartCollectionRule {
  include: TagCollectionItem[];
  exclude?: TagCollectionItem[];
}

export interface LibraryCollection {
  id: string;
  name: string;
  color: string;
  hidden: boolean;
  /** Identifiants globaux multi-sources ("nhentai:123"). */
  globalIds: string[];
  localIds: string[];
  mode: "manual" | "smart";
  rule?: SmartCollectionRule;
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

function parseTagItem(raw: unknown): TagCollectionItem | null {
  if (!isRecord(raw) || typeof raw.name !== "string") return null;
  return {
    type: typeof raw.type === "string" ? raw.type : "tag",
    name: raw.name,
  };
}

function parseRule(raw: unknown): SmartCollectionRule | undefined {
  if (!isRecord(raw) || !Array.isArray(raw.include)) return undefined;
  const include = raw.include
    .map(parseTagItem)
    .filter((item): item is TagCollectionItem => item !== null);
  if (include.length === 0) return undefined;
  const exclude = Array.isArray(raw.exclude)
    ? raw.exclude
        .map(parseTagItem)
        .filter((item): item is TagCollectionItem => item !== null)
    : undefined;
  return { include, exclude };
}

function migrateGlobalIds(raw: Record<string, unknown>): string[] {
  const ids = new Set<string>();
  if (Array.isArray(raw.globalIds)) {
    for (const id of raw.globalIds) {
      if (typeof id === "string" && id) ids.add(id);
    }
  }
  // Migration v1 : galleryIds number[] → nhentai:<id>
  if (Array.isArray(raw.galleryIds)) {
    for (const id of raw.galleryIds) {
      if (typeof id === "number" && Number.isFinite(id)) {
        ids.add(makeGlobalId("nhentai", id));
      } else if (typeof id === "string" && id) {
        ids.add(id.includes(":") ? id : makeGlobalId("nhentai", id));
      }
    }
  }
  return [...ids];
}

function parseCollection(raw: unknown): LibraryCollection | null {
  if (!isRecord(raw) || typeof raw.id !== "string" || typeof raw.name !== "string") {
    return null;
  }
  const mode = raw.mode === "smart" ? "smart" : "manual";
  return {
    id: raw.id,
    name: raw.name,
    color: typeof raw.color === "string" ? raw.color : "#60a5fa",
    hidden: raw.hidden === true,
    globalIds: migrateGlobalIds(raw),
    localIds: Array.isArray(raw.localIds)
      ? raw.localIds.filter((id): id is string => typeof id === "string")
      : [],
    mode,
    rule: mode === "smart" ? parseRule(raw.rule) : undefined,
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
  options?: {
    color?: string;
    hidden?: boolean;
    mode?: "manual" | "smart";
    rule?: SmartCollectionRule;
  }
): Promise<LibraryCollection> {
  await initLibraryCollections();
  const mode = options?.mode === "smart" ? "smart" : "manual";
  const collection: LibraryCollection = {
    id: `libcol_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: name.trim() || "Sans titre",
    color: options?.color || "#60a5fa",
    hidden: options?.hidden === true,
    globalIds: [],
    localIds: [],
    mode,
    rule: mode === "smart" ? options?.rule : undefined,
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
  patch: Partial<
    Pick<LibraryCollection, "name" | "color" | "hidden" | "mode" | "rule">
  >
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
  globalId: string,
  localId?: string
): boolean {
  if (globalId && collection.globalIds.includes(globalId)) return true;
  if (localId && collection.localIds.includes(localId)) return true;
  return false;
}

export async function toggleLibraryCollectionMembership(
  collectionId: string,
  globalId: string,
  localId?: string
): Promise<void> {
  await initLibraryCollections();
  currentCollections = currentCollections.map((col) => {
    if (col.id !== collectionId) return col;
    if (col.mode === "smart") {
      // Membership manuelle ignorée pour les smart (évaluation lazy).
      return col;
    }
    const hasGallery = col.globalIds.includes(globalId);
    const hasLocal = localId ? col.localIds.includes(localId) : false;
    const nextHas = !(hasGallery || hasLocal);
    return {
      ...col,
      globalIds: nextHas
        ? Array.from(new Set([...col.globalIds, globalId]))
        : col.globalIds.filter((id) => id !== globalId),
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

function tagMatches(gallery: Gallery, item: TagCollectionItem): boolean {
  const name = item.name.toLowerCase();
  const type = item.type.toLowerCase();
  return (gallery.tags || []).some(
    (t) => t.type.toLowerCase() === type && t.name.toLowerCase() === name
  );
}

export function galleryMatchesSmartRule(
  gallery: Gallery,
  rule: SmartCollectionRule
): boolean {
  if (!rule.include.length) return false;
  const includeOk = rule.include.every((item) => tagMatches(gallery, item));
  if (!includeOk) return false;
  const excludes = rule.exclude || [];
  if (excludes.some((item) => tagMatches(gallery, item))) return false;
  return true;
}

function galleryGlobalId(gallery: Gallery, fallbackId?: number): string {
  if (gallery.globalId) return gallery.globalId;
  const scanlator = gallery.scanlator;
  if (scanlator === "3hentai" || scanlator === "doujins" || scanlator === "hitomi") {
    return makeGlobalId(scanlator, gallery.id);
  }
  return makeGlobalId("nhentai", fallbackId ?? gallery.id);
}

/**
 * Évaluation lazy : favoris + bibliothèque locale (pas de crawl réseau).
 */
export function resolveCollectionMembers(
  collection: LibraryCollection,
  favorites: Gallery[],
  localEntries: LocalLibraryEntry[]
): string[] {
  if (collection.mode !== "smart" || !collection.rule) {
    return [...collection.globalIds];
  }
  const ids = new Set<string>();
  try {
    for (const g of favorites) {
      if (galleryMatchesSmartRule(g, collection.rule)) {
        ids.add(galleryGlobalId(g));
      }
    }
    for (const entry of localEntries) {
      if (galleryMatchesSmartRule(entry.gallery, collection.rule)) {
        ids.add(galleryGlobalId(entry.gallery, entry.galleryId));
      }
    }
  } catch (err) {
    console.warn("[libraryCollections] smart eval failed:", err);
  }
  return [...ids];
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

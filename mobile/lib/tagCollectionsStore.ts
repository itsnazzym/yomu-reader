import AsyncStorage from "@react-native-async-storage/async-storage";
import { useState, useEffect } from "react";
import { createInitOnce, createWriteQueue } from "./persistQueue";

export const TAG_COLLECTIONS_STORAGE_KEY = "@nhentai_tag_collections_v1";

export interface TagCollectionItem {
  type: string;
  name: string;
}

export interface TagCollection {
  id: string;
  name: string;
  description?: string;
  color: string;
  tags: TagCollectionItem[];
  excludeTags?: TagCollectionItem[];
  createdAt: number;
  updatedAt: number;
}

const DEFAULT_COLLECTIONS: TagCollection[] = [
  {
    id: "col_vanilla_romance",
    name: "Vanilla Romance",
    description: "Doujinshis purs, romantiques et sans drame",
    color: "#ec4899",
    tags: [
      { type: "tag", name: "sole female" },
      { type: "tag", name: "sole male" },
    ],
    excludeTags: [
      { type: "tag", name: "netorare" },
      { type: "tag", name: "guro" },
      { type: "tag", name: "ugly bastard" },
    ],
    createdAt: Date.now() - 86400000,
    updatedAt: Date.now() - 86400000,
  },
  {
    id: "col_fgo_spotlight",
    name: "Fate / Grand Order",
    description: "Les meilleures parodies de l'univers Fate",
    color: "#8b5cf6",
    tags: [
      { type: "parody", name: "fate grand order" },
    ],
    createdAt: Date.now() - 43200000,
    updatedAt: Date.now() - 43200000,
  },
];

let currentCollections: TagCollection[] = [...DEFAULT_COLLECTIONS];
const listeners = new Set<() => void>();
const writes = createWriteQueue();

function notify() {
  for (const l of listeners) l();
}

async function loadCollections(): Promise<void> {
  await writes.flush();
  try {
    const raw = await AsyncStorage.getItem(TAG_COLLECTIONS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        currentCollections = parsed;
        notify();
      }
    } else {
      await saveCollections();
    }
  } catch (e) {
    console.warn("[tagCollections] init error:", e);
  }
}

export const initTagCollections = createInitOnce(loadCollections);

async function saveCollections(): Promise<void> {
  const serialized = JSON.stringify(currentCollections);
  return writes.enqueue(() => AsyncStorage.setItem(TAG_COLLECTIONS_STORAGE_KEY, serialized));
}

export async function createTagCollection(
  name: string,
  tags: TagCollectionItem[],
  options?: {
    description?: string;
    color?: string;
    excludeTags?: TagCollectionItem[];
  }
): Promise<TagCollection> {
  await initTagCollections();
  const newCol: TagCollection = {
    id: `col_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: name.trim() || "Collection sans titre",
    description: options?.description?.trim() || "",
    color: options?.color || "#60a5fa",
    tags: Array.isArray(tags) ? tags : [],
    excludeTags: options?.excludeTags || [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  currentCollections = [newCol, ...currentCollections];
  notify();
  await saveCollections();
  return newCol;
}

export async function updateTagCollection(
  id: string,
  patch: Partial<Omit<TagCollection, "id" | "createdAt">>
): Promise<void> {
  await initTagCollections();
  currentCollections = currentCollections.map((col) => {
    if (col.id === id) {
      return {
        ...col,
        ...patch,
        updatedAt: Date.now(),
      };
    }
    return col;
  });
  notify();
  await saveCollections();
}

export async function deleteTagCollection(id: string): Promise<void> {
  await initTagCollections();
  currentCollections = currentCollections.filter((col) => col.id !== id);
  notify();
  await saveCollections();
}

export function formatCollectionSearchQuery(collection: TagCollection): string {
  const parts: string[] = [];

  for (const t of collection.tags) {
    const cleanName = t.name.trim();
    if (!cleanName) continue;
    const type = t.type || "tag";
    parts.push(cleanName.includes(" ") ? `${type}:"${cleanName}"` : `${type}:${cleanName}`);
  }

  if (Array.isArray(collection.excludeTags)) {
    for (const t of collection.excludeTags) {
      const cleanName = t.name.trim();
      if (!cleanName) continue;
      const type = t.type || "tag";
      parts.push(cleanName.includes(" ") ? `-${type}:"${cleanName}"` : `-${type}:${cleanName}`);
    }
  }

  return parts.join(" ");
}

export function getTagCollectionsSnapshot(): TagCollection[] {
  return currentCollections;
}

export function useTagCollections() {
  const [collections, setCollections] = useState<TagCollection[]>(currentCollections);

  useEffect(() => {
    const update = () => setCollections([...currentCollections]);
    listeners.add(update);
    initTagCollections();
    return () => {
      listeners.delete(update);
    };
  }, []);

  return {
    collections,
    createCollection: createTagCollection,
    updateCollection: updateTagCollection,
    deleteCollection: deleteTagCollection,
    formatQuery: formatCollectionSearchQuery,
  };
}

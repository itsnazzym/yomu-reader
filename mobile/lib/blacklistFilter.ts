import AsyncStorage from "@react-native-async-storage/async-storage";
import { useState, useEffect } from "react";
import { Gallery } from "./api/types";
import { createInitOnce, createWriteQueue } from "./persistQueue";

export const BLACKLIST_STORAGE_KEY = "@nhentai_blacklist_tags";
const BLACKLIST_KEY = BLACKLIST_STORAGE_KEY;

let cachedTags: string[] = [];
const listeners = new Set<() => void>();
const writes = createWriteQueue();

function notify() {
  for (const l of listeners) l();
}

async function loadBlacklist(): Promise<void> {
  await writes.flush();
  try {
    const raw = await AsyncStorage.getItem(BLACKLIST_KEY);
    if (raw) {
      cachedTags = JSON.parse(raw);
    }
  } catch {}
  notify();
}

export const initBlacklist = createInitOnce(loadBlacklist);

export function getBlacklistedTags(): string[] {
  return cachedTags;
}

export async function setBlacklistedTags(tags: string[]) {
  await initBlacklist();
  cachedTags = tags.map((t) => t.trim().toLowerCase()).filter(Boolean);
  const serialized = JSON.stringify(cachedTags);
  await writes.enqueue(() => AsyncStorage.setItem(BLACKLIST_KEY, serialized));
  notify();
}

export async function addBlacklistTag(tag: string) {
  const clean = tag.trim().toLowerCase();
  if (!clean || cachedTags.includes(clean)) return;
  const next = [...cachedTags, clean];
  await setBlacklistedTags(next);
}

export async function removeBlacklistTag(tag: string) {
  const clean = tag.trim().toLowerCase();
  const next = cachedTags.filter((t) => t !== clean);
  await setBlacklistedTags(next);
}

export function isGalleryBlacklisted(gallery: Pick<Gallery, "tags"> | null | undefined): boolean {
  if (!cachedTags.length || !gallery || !Array.isArray(gallery.tags)) return false;
  const tagNames = gallery.tags
    .map((t) => (t?.name ? String(t.name).toLowerCase() : ""))
    .filter(Boolean);
  return cachedTags.some((blacklisted) => tagNames.includes(blacklisted));
}

export function useBlacklist() {
  const [tags, setTags] = useState<string[]>(cachedTags);

  useEffect(() => {
    const update = () => setTags([...cachedTags]);
    listeners.add(update);
    initBlacklist();
    return () => {
      listeners.delete(update);
    };
  }, []);

  return {
    tags,
    addTag: addBlacklistTag,
    removeTag: removeBlacklistTag,
    setTags: setBlacklistedTags,
  };
}

initBlacklist();

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useState, useEffect } from "react";
import { Gallery } from "./api/types";

const BLACKLIST_KEY = "@nhentai_blacklist_tags";

let cachedTags: string[] = [];
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

export async function initBlacklist(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(BLACKLIST_KEY);
    if (raw) {
      cachedTags = JSON.parse(raw);
    }
  } catch {}
  notify();
  return cachedTags;
}

export function getBlacklistedTags(): string[] {
  return cachedTags;
}

export async function setBlacklistedTags(tags: string[]) {
  cachedTags = tags.map((t) => t.trim().toLowerCase()).filter(Boolean);
  await AsyncStorage.setItem(BLACKLIST_KEY, JSON.stringify(cachedTags));
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

export function isGalleryBlacklisted(gallery: Gallery): boolean {
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

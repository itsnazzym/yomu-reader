import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { searchGalleries } from "@/lib/api/nhentai";
import type { Gallery } from "@/lib/api/types";
import { isGalleryBlacklisted } from "./blacklistFilter";
import { formatSearchTerm } from "./searchQuery";
import { getFavTagsList, initTagFavs } from "./tagFavoritesStore";
import {
  formatCollectionSearchQuery,
  getTagCollectionsSnapshot,
  initTagCollections,
} from "./tagCollectionsStore";
import { createInitOnce, createWriteQueue } from "./persistQueue";

export const FOLLOWS_FEED_STORAGE_KEY = "@nhentai_follows_feed_v1";

export type FollowKind = "tag" | "pack" | "search";

export interface FollowSource {
  key: string;
  kind: FollowKind;
  label: string;
  query: string;
}

export interface FollowCursor {
  lastSeenId: number;
  lastCheckedAt: number;
}

export interface PinnedSearch {
  id: string;
  query: string;
  createdAt: number;
}

export interface FollowFeedRow {
  source: FollowSource;
  galleries: Gallery[];
  unseenCount: number;
}

interface FollowsPersist {
  cursors: Record<string, FollowCursor>;
  pinned: PinnedSearch[];
  lastRefreshAt: number;
}

const FOLLOWABLE_TYPES = new Set(["artist", "group", "parody", "character"]);
const MAX_CHECKS_PER_REFRESH = 8;
const CHECK_GAP_MS = 700;
const MIN_REFRESH_MS = 5 * 60 * 1000;

let persistState: FollowsPersist = {
  cursors: {},
  pinned: [],
  lastRefreshAt: 0,
};
let feedRows: FollowFeedRow[] = [];
let refreshing = false;
const listeners = new Set<() => void>();
const writes = createWriteQueue();

function notify(): void {
  for (const listener of listeners) listener();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parsePinned(raw: unknown): PinnedSearch | null {
  if (!isRecord(raw) || typeof raw.id !== "string" || typeof raw.query !== "string") {
    return null;
  }
  const query = raw.query.trim();
  if (!query) return null;
  return {
    id: raw.id,
    query,
    createdAt: Number(raw.createdAt) || Date.now(),
  };
}

function parseCursor(raw: unknown): FollowCursor | null {
  if (!isRecord(raw)) return null;
  const lastSeenId = Number(raw.lastSeenId);
  if (!Number.isFinite(lastSeenId)) return null;
  return {
    lastSeenId,
    lastCheckedAt: Number(raw.lastCheckedAt) || 0,
  };
}

async function loadFollows(): Promise<void> {
  await writes.flush();
  try {
    const raw = await AsyncStorage.getItem(FOLLOWS_FEED_STORAGE_KEY);
    if (!raw) return;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return;
    const cursors: Record<string, FollowCursor> = {};
    if (isRecord(parsed.cursors)) {
      for (const [key, value] of Object.entries(parsed.cursors)) {
        const cursor = parseCursor(value);
        if (cursor) cursors[key] = cursor;
      }
    }
    persistState = {
      cursors,
      pinned: Array.isArray(parsed.pinned)
        ? parsed.pinned.map(parsePinned).filter((item): item is PinnedSearch => item !== null)
        : [],
      lastRefreshAt: Number(parsed.lastRefreshAt) || 0,
    };
    notify();
  } catch (error) {
    console.warn("[followsFeed] load failed:", error);
  }
}

export const initFollowsFeed = createInitOnce(loadFollows);

async function persist(): Promise<void> {
  const serialized = JSON.stringify(persistState);
  await writes.enqueue(() => AsyncStorage.setItem(FOLLOWS_FEED_STORAGE_KEY, serialized));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getFollowSources(): FollowSource[] {
  const sources: FollowSource[] = [];
  const seen = new Set<string>();

  for (const tag of getFavTagsList()) {
    const type = (tag.type || "tag").toLowerCase();
    if (!FOLLOWABLE_TYPES.has(type)) continue;
    const query = formatSearchTerm(type, tag.name);
    if (!query || seen.has(query)) continue;
    seen.add(query);
    sources.push({
      key: `tag:${type}:${tag.name.toLowerCase()}`,
      kind: "tag",
      label: tag.name,
      query,
    });
  }

  for (const pack of getTagCollectionsSnapshot()) {
    const query = formatCollectionSearchQuery(pack).trim();
    if (!query || seen.has(query)) continue;
    seen.add(query);
    sources.push({
      key: `pack:${pack.id}`,
      kind: "pack",
      label: pack.name,
      query,
    });
  }

  for (const pin of persistState.pinned) {
    const query = pin.query.trim();
    if (!query || seen.has(query)) continue;
    seen.add(query);
    sources.push({
      key: `search:${pin.id}`,
      kind: "search",
      label: query,
      query,
    });
  }

  return sources;
}

export function getFollowFeedRows(): FollowFeedRow[] {
  return feedRows;
}

export function getFollowUnseenTotal(): number {
  return feedRows.reduce((sum, row) => sum + row.unseenCount, 0);
}

export function isFollowsRefreshing(): boolean {
  return refreshing;
}

export function getPinnedSearches(): PinnedSearch[] {
  return persistState.pinned;
}

export async function pinFollowSearch(query: string): Promise<PinnedSearch | null> {
  await initFollowsFeed();
  const clean = query.trim();
  if (clean.length < 2) return null;
  if (persistState.pinned.some((item) => item.query.toLowerCase() === clean.toLowerCase())) {
    return persistState.pinned.find((item) => item.query.toLowerCase() === clean.toLowerCase()) ?? null;
  }
  const pin: PinnedSearch = {
    id: `pin_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    query: clean,
    createdAt: Date.now(),
  };
  persistState = { ...persistState, pinned: [pin, ...persistState.pinned] };
  notify();
  await persist();
  return pin;
}

export async function unpinFollowSearch(id: string): Promise<void> {
  await initFollowsFeed();
  persistState = {
    ...persistState,
    pinned: persistState.pinned.filter((item) => item.id !== id),
  };
  notify();
  await persist();
}

export async function markFollowSeen(sourceKey: string): Promise<void> {
  await initFollowsFeed();
  const row = feedRows.find((item) => item.source.key === sourceKey);
  const maxId = row
    ? row.galleries.reduce((max, gallery) => Math.max(max, Number(gallery.id) || 0), 0)
    : persistState.cursors[sourceKey]?.lastSeenId || 0;
  persistState = {
    ...persistState,
    cursors: {
      ...persistState.cursors,
      [sourceKey]: {
        lastSeenId: maxId,
        lastCheckedAt: Date.now(),
      },
    },
  };
  feedRows = feedRows.map((item) =>
    item.source.key === sourceKey ? { ...item, unseenCount: 0 } : item
  );
  notify();
  await persist();
}

export async function refreshFollowsFeed(force = false): Promise<FollowFeedRow[]> {
  await initFollowsFeed();
  await initTagFavs();
  await initTagCollections();

  if (refreshing) return feedRows;
  if (!force && Date.now() - persistState.lastRefreshAt < MIN_REFRESH_MS && feedRows.length > 0) {
    return feedRows;
  }

  refreshing = true;
  notify();

  try {
    const sources = getFollowSources().slice(0, MAX_CHECKS_PER_REFRESH);
    const nextRows: FollowFeedRow[] = [];
    const nextCursors = { ...persistState.cursors };

    for (let i = 0; i < sources.length; i++) {
      const source = sources[i];
      if (i > 0) await sleep(CHECK_GAP_MS);
      try {
        const response = await searchGalleries(source.query, 1, "recent");
        const galleries = (response.result || []).filter((gallery) => !isGalleryBlacklisted(gallery));
        const newestId = galleries.reduce(
          (max, gallery) => Math.max(max, Number(gallery.id) || 0),
          0
        );
        const cursor = nextCursors[source.key];
        let unseenCount = 0;
        if (!cursor || cursor.lastSeenId <= 0) {
          nextCursors[source.key] = {
            lastSeenId: newestId,
            lastCheckedAt: Date.now(),
          };
        } else {
          unseenCount = galleries.filter((gallery) => Number(gallery.id) > cursor.lastSeenId).length;
          nextCursors[source.key] = {
            lastSeenId: cursor.lastSeenId,
            lastCheckedAt: Date.now(),
          };
        }
        nextRows.push({ source, galleries: galleries.slice(0, 8), unseenCount });
      } catch (error) {
        console.warn(`[followsFeed] ${source.key} failed:`, error);
        nextRows.push({ source, galleries: [], unseenCount: 0 });
      }
    }

    persistState = {
      ...persistState,
      cursors: nextCursors,
      lastRefreshAt: Date.now(),
    };
    feedRows = nextRows;
    await persist();
    return feedRows;
  } finally {
    refreshing = false;
    notify();
  }
}

export function useFollowsFeed(): {
  rows: FollowFeedRow[];
  unseenTotal: number;
  refreshing: boolean;
  pinned: PinnedSearch[];
  refresh: (force?: boolean) => Promise<void>;
  markSeen: typeof markFollowSeen;
  pinSearch: typeof pinFollowSearch;
  unpinSearch: typeof unpinFollowSearch;
} {
  const [rows, setRows] = useState<FollowFeedRow[]>(feedRows);
  const [isRefreshing, setIsRefreshing] = useState(refreshing);
  const [pinned, setPinned] = useState<PinnedSearch[]>(persistState.pinned);

  useEffect(() => {
    const update = (): void => {
      setRows([...feedRows]);
      setIsRefreshing(refreshing);
      setPinned([...persistState.pinned]);
    };
    listeners.add(update);
    void initFollowsFeed();
    return () => {
      listeners.delete(update);
    };
  }, []);

  return {
    rows,
    unseenTotal: rows.reduce((sum, row) => sum + row.unseenCount, 0),
    refreshing: isRefreshing,
    pinned,
    refresh: async (force = false) => {
      await refreshFollowsFeed(force);
    },
    markSeen: markFollowSeen,
    pinSearch: pinFollowSearch,
    unpinSearch: unpinFollowSearch,
  };
}

void initFollowsFeed();

/**
 * Cache des listes de tags par source (getTags des adaptateurs).
 *
 * - Cache AsyncStorage segmenté `@src_tax_v3_<source>` avec TTL 7 jours ; en cas d'échec
 *   réseau on retombe sur le cache périmé plutôt que d'échouer.
 * - Doujins : la page /tags officielle n'expose que ~36 tags. On enrichit
 *   donc cumulativement avec les tags observés dans les listings /folders
 *   (recordObservedTags, appelé par l'adaptateur), sans retirer les anciens tags.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createWriteQueue } from "./persistQueue";
import { dedupeTags } from "./sources/tagUtils";
import type { SourceId, SourceTaxonomyItem } from "./sources/types";

const TTL_MS = 7 * 24 * 60 * 60 * 1000;
const OBSERVED_KEY = "@src_tax_doujins_seen";
const CHUNK_SIZE = 1000;
const observedWrites = createWriteQueue();

interface TaxonomyCache {
  updatedAt: number;
  tags: SourceTaxonomyItem[];
  chunks?: string[];
}

const inflight = new Map<string, Promise<SourceTaxonomyItem[]>>();

function cacheKey(source: SourceId): string {
  return `@src_tax_v3_${source}`;
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

async function readCache(source: SourceId): Promise<TaxonomyCache | null> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(source));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TaxonomyCache;
    if (!Array.isArray(parsed.chunks)) return null;
    const pages = await Promise.all(parsed.chunks.map(key => AsyncStorage.getItem(key)));
    if (pages.some(page => !page)) return null;
    const tags: unknown[] = pages.flatMap(page => JSON.parse(page!));
    if (!tags.every(tag => tag && typeof tag === "object" && "name" in tag && typeof tag.name === "string")) return null;
    return { ...parsed, tags: tags as SourceTaxonomyItem[] };
  } catch {
    return null;
  }
}

async function writeCache(
  source: SourceId,
  tags: SourceTaxonomyItem[]
): Promise<void> {
  // Keep each SQLite value below Android CursorWindow limits.
  const previous = await readCache(source);
  const generation = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const chunks: string[] = [];
  try {
    for (let i = 0; i < tags.length; i += CHUNK_SIZE) {
      const key = `${cacheKey(source)}_${generation}_${i / CHUNK_SIZE}`;
      chunks.push(key);
      await AsyncStorage.setItem(key, JSON.stringify(tags.slice(i, i + CHUNK_SIZE)));
    }
    await AsyncStorage.setItem(cacheKey(source), JSON.stringify({ updatedAt: Date.now(), chunks }));
    await Promise.all((previous?.chunks || []).map(key => AsyncStorage.removeItem(key).catch(() => {})));
  } catch {
    await Promise.all(chunks.map(key => AsyncStorage.removeItem(key).catch(() => {})));
    // A full cache must not hide a successfully fetched catalogue.
  }
}

/* ── Cumul doujins : tags vus dans les listings /folders ─────────────── */

export async function recordObservedTags(names: string[]): Promise<void> {
  if (!names.length) return;
  return observedWrites.enqueue(async () => {
    try {
      const raw = await AsyncStorage.getItem(OBSERVED_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      const list: string[] = Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
      const existing = new Set(list.map(normalizeName));
      for (const n of names) {
        if (typeof n !== "string") continue;
        const key = normalizeName(n);
        if (!key || existing.has(key)) continue;
        existing.add(key);
        list.push(n);
      }
      await AsyncStorage.setItem(OBSERVED_KEY, JSON.stringify(list));
    } catch {
      // Non bloquant : le cumul est une optimisation, jamais une obligation.
    }
  });
}

async function readObservedTags(): Promise<string[]> {
  await observedWrites.flush();
  try {
    const raw = await AsyncStorage.getItem(OBSERVED_KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list)
      ? list.filter((s): s is string => typeof s === "string")
      : [];
  } catch {
    return [];
  }
}

/* ── API publique ────────────────────────────────────────────────────── */

/**
 * Tags réels d'une source : fraîches si cache < TTL, sinon fetch via
 * l'adaptateur ; réseau KO → dernier bon cache, sinon erreur.
 * (nhentai n'utilise pas ce store : sa liste vient de la DB statique.)
 */
export async function getSourceTags(
  source: SourceId,
  fetcher: () => Promise<SourceTaxonomyItem[]>,
  options: { refresh?: boolean } = {}
): Promise<SourceTaxonomyItem[]> {
  if (inflight.has(source)) return inflight.get(source)!;

  const task = (async (): Promise<SourceTaxonomyItem[]> => {
    const cached = await readCache(source);
    if (!options.refresh && cached && Date.now() - cached.updatedAt < TTL_MS) {
      if (source === "doujins") return mergeDoujins(cached.tags);
      return cached.tags;
    }
    try {
      const fresh = dedupeTags(await fetcher());
      await writeCache(source, fresh);
      if (source === "doujins") return mergeDoujins(fresh);
      return fresh;
    } catch (err) {
      if (cached && cached.tags.length > 0) {
        return source === "doujins" ? mergeDoujins(cached.tags) : cached.tags;
      }
      throw err instanceof Error ? err : new Error(String(err));
    }
  })().finally(() => { inflight.delete(source); });

  inflight.set(source, task);
  return task;
}

/** Officiels (fraîches ou cache) ∪ tags cumulés localement, dédupliqués. */
async function mergeDoujins(official: SourceTaxonomyItem[]): Promise<SourceTaxonomyItem[]> {
  const observed = await readObservedTags();
  return dedupeTags([...official, ...observed.map((name) => ({ name }))]);
}

/** Force un rafraîchissement au prochain appel (pull-to-refresh futur). */
export async function invalidateSourceTags(source: SourceId): Promise<void> {
  const cached = await readCache(source);
  await Promise.all([cacheKey(source), ...(cached?.chunks || [])].map(key => AsyncStorage.removeItem(key).catch(() => {})));
}

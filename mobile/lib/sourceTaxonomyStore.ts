/**
 * Cache des listes de tags par source (getTags des adaptateurs).
 *
 * - Cache AsyncStorage `@src_tax_<source>` avec TTL 7 jours ; en cas d'échec
 *   réseau on retombe sur le cache périmé plutôt que d'échouer.
 * - Doujins : la page /tags officielle n'expose que ~36 tags. On enrichit
 *   donc cumulativement avec les tags observés dans les listings /folders
 *   (recordObservedTags, appelé fire-and-forget par l'adaptateur), plafonné
 *   à OBSERVED_CAP entrées FIFO.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { dedupeTags } from "./sources/tagUtils";
import type { SourceId, SourceTaxonomyItem } from "./sources/types";

const TTL_MS = 7 * 24 * 60 * 60 * 1000;
const OBSERVED_KEY = "@src_tax_doujins_seen";
const OBSERVED_CAP = 2000;

interface TaxonomyCache {
  updatedAt: number;
  tags: SourceTaxonomyItem[];
}

const inflight = new Map<string, Promise<SourceTaxonomyItem[]>>();

function cacheKey(source: SourceId): string {
  return `@src_tax_${source}`;
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

async function readCache(source: SourceId): Promise<TaxonomyCache | null> {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(source));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TaxonomyCache;
    if (!Array.isArray(parsed.tags)) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function writeCache(
  source: SourceId,
  tags: SourceTaxonomyItem[]
): Promise<void> {
  const payload: TaxonomyCache = { updatedAt: Date.now(), tags };
  await AsyncStorage.setItem(cacheKey(source), JSON.stringify(payload));
}

/* ── Cumul doujins : tags vus dans les listings /folders ─────────────── */

export async function recordObservedTags(names: string[]): Promise<void> {
  if (!names.length) return;
  try {
    const raw = await AsyncStorage.getItem(OBSERVED_KEY);
    let list: string[] = raw ? (JSON.parse(raw) as string[]) : [];
    const existing = new Set(list.map(normalizeName));
    for (const n of names) {
      const key = normalizeName(n);
      if (!key || existing.has(key)) continue;
      existing.add(key);
      list.push(n);
    }
    // FIFO : on garde les plus récents si dépassement du plafond.
    if (list.length > OBSERVED_CAP) list = list.slice(-OBSERVED_CAP);
    await AsyncStorage.setItem(OBSERVED_KEY, JSON.stringify(list));
  } catch {
    // Non bloquant : le cumul est une optimisation, jamais une obligation.
  }
}

async function readObservedTags(): Promise<string[]> {
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
  fetcher: () => Promise<SourceTaxonomyItem[]>
): Promise<SourceTaxonomyItem[]> {
  if (inflight.has(source)) return inflight.get(source)!;

  const task = (async (): Promise<SourceTaxonomyItem[]> => {
    const cached = await readCache(source);
    if (cached && Date.now() - cached.updatedAt < TTL_MS) {
      if (source === "doujins") return mergeDoujins(cached.tags);
      return cached.tags;
    }
    try {
      const fresh = dedupeTags(await fetcher());
      await writeCache(source, fresh);
      if (source === "doujins") return mergeDoujins(fresh);
      return fresh;
    } catch (err) {
      console.warn(`[sourceTaxonomy] fetch ${source} KO, fallback cache:`, err);
      if (cached && cached.tags.length > 0) {
        return source === "doujins" ? mergeDoujins(cached.tags) : cached.tags;
      }
      throw err instanceof Error ? err : new Error(String(err));
    } finally {
      inflight.delete(source);
    }
  })();

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
  await AsyncStorage.removeItem(cacheKey(source)).catch(() => {});
}

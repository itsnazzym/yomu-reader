/**
 * Client-side recommendation engine.
 *
 * Signals used to build the preference profile:
 *   1. Local favorites (bookmarks) — weight ×3
 *   2. Read history — weight ×2, with a recency boost
 *   3. Search history — weight ×1
 *
 * The engine stays local: only the resulting search queries are sent to
 * nHentai, while the preference profile never leaves the device.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Gallery, SearchResult } from "@/lib/api/types";
import { searchGalleries } from "@/lib/api/nhentai";
import { getFavorites, initFavorites } from "@/lib/favoritesStore";
import { getHistory, initHistory } from "@/lib/historyStore";
import {
  getBlacklistedTags,
  initBlacklist,
  isGalleryBlacklisted,
} from "@/lib/blacklistFilter";

const SEARCH_HISTORY_KEY = "@nhentai_search_history_v1";

// ── Public types ──

export interface ScoredTerm {
  name: string;
  score: number;
  sources: string[];
  /** Global nHentai tag count (0 when the signal has no metadata, e.g. search). */
  count: number;
}

export interface RecommendationProfile {
  tags: ScoredTerm[];
  artists: ScoredTerm[];
  parodies: ScoredTerm[];
  languages: string[];
  totalFavorites: number;
  totalHistory: number;
  totalSearches: number;
  searchQueriesForApi: string[];
  hasSignals: boolean;
}

export interface RecommendationResult {
  books: Gallery[];
  profile: RecommendationProfile;
  queriesUsed: string[];
}

// ── Score-map helpers ──

type ScoreMap = Map<string, { score: number; sources: Set<string>; count: number }>;

function addScore(
  map: ScoreMap,
  rawName: string,
  score: number,
  source: string,
  count = 0
): void {
  const key = rawName.trim().toLowerCase();
  if (!key) return;

  const entry = map.get(key);
  if (entry) {
    entry.score += score;
    entry.sources.add(source);
    if (count > entry.count) entry.count = count;
  } else {
    map.set(key, { score, sources: new Set([source]), count });
  }
}

// Un signal de recherche ne doit pas re-pondérer un terme déjà signalé par un
// favori ou une lecture : la recherche ne ferait que confirmer un intérêt déjà
// fortement établi, sans apporter d'information nouvelle.
function addSearchSignal(map: ScoreMap, rawName: string, score: number): void {
  const key = rawName.trim().toLowerCase();
  if (!key) return;
  const entry = map.get(key);
  if (entry && (entry.sources.has("fav") || entry.sources.has("history"))) return;
  addScore(map, rawName, score, "search");
}

function mapToSorted(map: ScoreMap): ScoredTerm[] {
  return Array.from(map.entries())
    .map(([name, { score, sources, count }]) => ({
      name,
      score,
      sources: [...sources],
      count,
    }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}

// ── History & Search storage ──

export async function getReadHistory(): Promise<Gallery[]> {
  await initHistory();
  return getHistory().map((entry) => entry.gallery);
}

export async function getSearchHistory(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(SEARCH_HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((query) => typeof query === "string") : [];
  } catch {
    return [];
  }
}

export async function addToSearchHistory(query: string): Promise<void> {
  try {
    const clean = query.trim();
    if (!clean || clean.length < 2) return;

    const history = await getSearchHistory();
    const filtered = history.filter((item) => item.toLowerCase() !== clean.toLowerCase());
    const updated = [clean, ...filtered].slice(0, 50);
    await AsyncStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated));
  } catch {}
}

// ── Profile builder ──

function extractTagsFromGallery(
  gallery: Gallery,
  tagMap: ScoreMap,
  artistMap: ScoreMap,
  parodyMap: ScoreMap,
  langSet: Set<string>,
  weight: number,
  source: string
): void {
  if (!gallery?.tags) return;

  for (const tag of gallery.tags) {
    switch (tag.type) {
      case "tag":
        addScore(tagMap, tag.name, weight, source, tag.count);
        break;
      case "artist":
        addScore(artistMap, tag.name, weight * 1.5, source, tag.count);
        break;
      case "group":
        addScore(artistMap, tag.name, weight, source, tag.count);
        break;
      case "parody":
        addScore(parodyMap, tag.name, weight, source, tag.count);
        break;
      case "language":
        if (tag.name !== "translated") langSet.add(tag.name.toLowerCase());
        break;
    }
  }
}

const SEARCH_STOP_WORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "that",
  "this",
  "all",
  "any",
  "tag",
  "artist",
  "group",
  "parody",
  "character",
  "language",
  "uploaded",
  "english",
  "japanese",
  "chinese",
  "translated",
]);

// Operators whose values can be multi-word names (artist/group/parody/...).
const SEARCH_MULTI_WORD_OPS = "(?:artist|group|parody|character|tag)";
// Technical operators with a single-token value (language:english, sort:popular,
// category:doujinshi, order:popular, comments:>50, favorites:1000, ...).
const SEARCH_SINGLE_WORD_OPS =
  "(?:language|category|pages|num_pages|date|uploaded|sort|order|comments|favorites|scores)";
const SEARCH_ALL_OPS = `(?:${SEARCH_MULTI_WORD_OPS}|${SEARCH_SINGLE_WORD_OPS})`;

// A multi-word value is either quoted ("blue archive") or a run of unquoted
// words that stops before the next `op:` clause — so `artist:siina tai` keeps
// the full name instead of leaking the trailing word as a free tag.
function searchValueRegex(ops: string): string {
  return `${ops}:\\s*(?:"([^"]+)"|([^\\s"]+(?:\\s+(?!${SEARCH_ALL_OPS}\\s*:)[^\\s"]+)*))`;
}

function extractSignalsFromSearch(
  query: string,
  tagMap: ScoreMap,
  artistMap: ScoreMap,
  parodyMap: ScoreMap
): void {
  const searchWeight = 0.75;
  const typedTerms = new RegExp(searchValueRegex("(?:artist|group)"), "gi");
  const parodyTerms = new RegExp(searchValueRegex("parody"), "gi");

  for (const match of query.matchAll(typedTerms)) {
    addSearchSignal(artistMap, match[1] || match[2], searchWeight);
  }
  for (const match of query.matchAll(parodyTerms)) {
    addSearchSignal(parodyMap, match[1] || match[2], searchWeight);
  }

  // Free-text searches are light tag signals. Strip every operator clause so a
  // term searched via `artist:`/`parody:` is never also recorded as a free tag.
  // Single-word clauses use their own pattern so `sort:popular anal` keeps
  // `anal` as a tag instead of swallowing it into the operator value.
  const freeText = query
    .replace(
      new RegExp(
        `${searchValueRegex(SEARCH_MULTI_WORD_OPS)}|${SEARCH_SINGLE_WORD_OPS}:\\s*(?:"[^"]*"|\\S+)`,
        "gi"
      ),
      " "
    )
    .replace(/["()[\]{}]/g, " ");

  for (const token of freeText.split(/\s+/)) {
    const clean = token.trim().toLowerCase();
    if (clean.length < 3 || SEARCH_STOP_WORDS.has(clean) || /^\d+$/.test(clean)) continue;
    addSearchSignal(tagMap, clean, searchWeight);
  }
}

async function buildProfile(): Promise<RecommendationProfile> {
  // Hydrate the stores here because this screen can be opened before their
  // hook-based initialisation has run.
  await initFavorites();
  const [history, searches] = await Promise.all([getReadHistory(), getSearchHistory()]);

  const favorites = getFavorites();
  const tagMap: ScoreMap = new Map();
  const artistMap: ScoreMap = new Map();
  const parodyMap: ScoreMap = new Map();
  const langSet = new Set<string>();

  // Favorites — weight ×3
  for (const fav of favorites) {
    extractTagsFromGallery(fav, tagMap, artistMap, parodyMap, langSet, 3, "fav");
  }

  // Read history — weight ×2 (with recency boost)
  for (let i = 0; i < history.length; i++) {
    const recencyBoost = i < 10 ? 1.5 : i < 30 ? 1 : 0.5;
    extractTagsFromGallery(
      history[i],
      tagMap,
      artistMap,
      parodyMap,
      langSet,
      2 * recencyBoost,
      "history"
    );
  }

  // Searches are intentionally weaker than an explicit favorite/read signal,
  // but they still let a new user get useful results immediately.
  for (const query of searches.slice(0, 10)) {
    extractSignalsFromSearch(query, tagMap, artistMap, parodyMap);
  }

  const tags = mapToSorted(tagMap).slice(0, 30);
  const artists = mapToSorted(artistMap).slice(0, 15);
  const parodies = mapToSorted(parodyMap).slice(0, 10);
  const searchQueriesForApi = searches.slice(0, 5);

  return {
    tags,
    artists,
    parodies,
    languages: [...langSet],
    totalFavorites: favorites.length,
    totalHistory: history.length,
    totalSearches: searches.length,
    searchQueriesForApi,
    hasSignals:
      tags.length > 0 ||
      artists.length > 0 ||
      parodies.length > 0 ||
      searchQueriesForApi.length > 0,
  };
}

// ── Recommendation generator ──

let refreshCount = 0;
let shownIds = new Set<number>();
let cache: RecommendationResult | null = null;

export function clearRecommendationCache(): void {
  cache = null;
  refreshCount += 1;
  // Avoid retaining an ever-growing set on a very active device.
  if (shownIds.size > 1000) shownIds = new Set();
}

export function getCachedRecommendations(): RecommendationResult | null {
  return cache;
}

function quoteTerm(term: string): string {
  return `"${term.replace(/"/g, "\\\"")}"`;
}

function uniqueQueries(queries: string[]): string[] {
  const seen = new Set<string>();
  return queries.filter((query) => {
    const key = query.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── Retry / backoff ──
// nHentai renvoie fréquemment des 429 quand plusieurs requêtes s'enchaînent.
// On réessaie uniquement les erreurs transitoires (429/5xx/réseau) avec un
// backoff exponentiel + jitter, pour éviter l'état « connexion impossible ».

const MAX_RETRIES = 2; // 1 tentative + 2 réessais
const BASE_RETRY_DELAY_MS = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (/HTTP (429|5\d\d)\b/.test(error.message)) return true;
  return /fetch failed|network|timeout|aborted|ECONN|ETIMEDOUT|ENOTFOUND/i.test(error.message);
}

async function searchWithRetry(
  query: string,
  page: number,
  sort: Parameters<typeof searchGalleries>[2]
): Promise<SearchResult> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await searchGalleries(query, page, sort);
    } catch (error) {
      lastError = error;
      if (!isRetryableError(error) || attempt === MAX_RETRIES) throw error;
      const delay = BASE_RETRY_DELAY_MS * 2 ** attempt + Math.random() * 250;
      await sleep(delay);
    }
  }
  throw lastError;
}

export async function generateRecommendations(
  onProgress?: (msg: string) => void
): Promise<RecommendationResult> {
  const profile = await buildProfile();

  if (!profile.hasSignals) {
    cache = { books: [], profile, queriesUsed: [] };
    return cache;
  }

  const seenIds = new Set<number>();
  for (const favorite of getFavorites()) seenIds.add(favorite.id);
  for (const history of await getReadHistory()) seenIds.add(history.id);
  for (const id of shownIds) seenIds.add(id);

  const allBooks: Gallery[] = [];
  const queriesUsed: string[] = [];

  // One combined query gives high relevance, while the individual terms below
  // keep the result set from becoming too narrow.
  const queries: string[] = [];
  if (profile.tags.length >= 2) {
    queries.push(profile.tags.slice(0, 2).map((term) => quoteTerm(term.name)).join(" "));
  }
  for (const artist of profile.artists.slice(0, 3)) {
    queries.push(`artist:${quoteTerm(artist.name)}`);
  }
  for (const parody of profile.parodies.slice(0, 2)) {
    queries.push(`parody:${quoteTerm(parody.name)}`);
  }
  for (const tag of profile.tags.slice(0, 6)) {
    queries.push(quoteTerm(tag.name));
  }
  queries.push(...profile.searchQueriesForApi);

  const limitedQueries = uniqueQueries(queries).slice(0, 8);
  const maxQueries = Math.min(limitedQueries.length, 6);

  await initBlacklist();
  const blacklistedTags = getBlacklistedTags();

  for (let i = 0; i < maxQueries; i++) {
    const query = limitedQueries[i];
    onProgress?.(`Recherche ${i + 1}/${maxQueries} · ${query.slice(0, 34)}…`);

    try {
      const pageOffset = ((refreshCount + i) % 5) + 1;
      const languageFilter = profile.languages[0]
        ? ` language:${profile.languages[0]}`
        : "";
      const response = await searchWithRetry(`${query}${languageFilter}`, pageOffset, "popular");

      for (const book of response.result || []) {
        if (seenIds.has(book.id)) continue;
        if (blacklistedTags.length > 0 && isGalleryBlacklisted(book)) continue;

        seenIds.add(book.id);
        allBooks.push(book);
        shownIds.add(book.id);
      }
      queriesUsed.push(query);
    } catch (error) {
      // A single failed query should not prevent the other signals from
      // producing a list. Only fail when every query fails.
      console.warn("Recommendation query failed:", query, error);
    }
  }

  if (maxQueries > 0 && queriesUsed.length === 0) {
    throw new Error("Impossible de charger les recommandations. Vérifiez votre connexion.");
  }

  const tagScores = new Map(profile.tags.map((term) => [term.name, term.score]));
  const artistScores = new Map(profile.artists.map((term) => [term.name, term.score]));
  const parodyScores = new Map(profile.parodies.map((term) => [term.name, term.score]));
  const languageSet = new Set(profile.languages.map((language) => language.toLowerCase()));

  const scored = allBooks.map((book, index) => {
    let score = 0;
    let matchedSignals = 0;

    for (const tag of book.tags || []) {
      const normalized = tag.name.trim().toLowerCase();
      const tagScore = tagScores.get(normalized);
      const artistScore = artistScores.get(normalized);
      const parodyScore = parodyScores.get(normalized);

      if (tagScore) {
        score += tagScore;
        matchedSignals += 1;
      }
      if (artistScore) {
        score += artistScore * 2;
        matchedSignals += 1;
      }
      if (parodyScore) {
        score += parodyScore * 1.5;
        matchedSignals += 1;
      }
      if (tag.type === "language" && languageSet.has(normalized)) {
        score += 3;
      }
    }

    // Popularity is only a tie-breaker. Preference matches dominate it.
    const popularity = Math.log10((book.num_favorites || 0) + 1);
    score += popularity * 0.12;

    return { book, score, matchedSignals, popularity, index };
  });

  scored.sort(
    (a, b) =>
      b.score - a.score ||
      b.matchedSignals - a.matchedSignals ||
      b.popularity - a.popularity ||
      a.index - b.index
  );

  cache = {
    books: scored.map((item) => item.book),
    profile,
    queriesUsed,
  };
  return cache;
}

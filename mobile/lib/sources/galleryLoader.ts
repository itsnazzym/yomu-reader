/** Cache de session court pour éviter un second scraping fiche → lecteur. */

import { getSource } from "./registry";
import type { SourceGallery, SourceId } from "./types";

const MAX_ENTRIES = 40;
const DEFAULT_TTL_MS = 5 * 60 * 1000;
const DEFAULT_LOAD_TIMEOUT_MS = 10_000;
// Doujins produit des URLs signées : elles ne doivent pas rester longtemps.
const SIGNED_URL_TTL_MS = 60 * 1000;

interface CacheEntry {
  gallery: SourceGallery;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<SourceGallery>>();

function keyOf(source: SourceId, nativeId: string): string {
  return `${source}:${nativeId}`;
}

function remember(key: string, gallery: SourceGallery, ttlMs: number): void {
  cache.delete(key);
  cache.set(key, { gallery, expiresAt: Date.now() + ttlMs });
  while (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

export function peekSourceGallery(
  source: SourceId,
  nativeId: string
): SourceGallery | null {
  const key = keyOf(source, nativeId);
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  cache.delete(key);
  cache.set(key, entry);
  return entry.gallery;
}

export function loadSourceGallery(
  source: SourceId,
  nativeId: string,
  knownTitle?: string,
  options?: { forceRefresh?: boolean; timeoutMs?: number }
): Promise<SourceGallery> {
  const key = keyOf(source, nativeId);
  if (!options?.forceRefresh) {
    const cached = peekSourceGallery(source, nativeId);
    if (cached) return Promise.resolve(cached);
  }

  const pending = inFlight.get(key);
  if (pending && !options?.forceRefresh) return pending;
  // Un nouvel essai ne doit pas rester captif d'une requête qui a dépassé
  // son délai. L'ancienne réponse tardive est volontairement ignorée.
  if (pending) inFlight.delete(key);

  const timeoutMs = options?.timeoutMs ?? DEFAULT_LOAD_TIMEOUT_MS;
  let request!: Promise<SourceGallery>;
  request = new Promise<SourceGallery>((resolve, reject) => {
    let settled = false;
    const settle = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      callback();
    };
    const timer = setTimeout(() => {
      settle(() => reject(new Error("Le chargement de la galerie a dépassé 10 secondes. Réessayez.")));
    }, timeoutMs);

    void getSource(source)
      .getGallery(nativeId, knownTitle)
      .then((gallery) => {
        settle(() => {
          remember(
            key,
            gallery,
            source === "doujins" || source === "hitomi" ? SIGNED_URL_TTL_MS : DEFAULT_TTL_MS
          );
          resolve(gallery);
        });
      })
      .catch((error) => settle(() => reject(error)));
  }).finally(() => {
    if (inFlight.get(key) === request) inFlight.delete(key);
  });

  inFlight.set(key, request);
  return request;
}

export function clearSourceGalleryCache(): void {
  cache.clear();
}

/**
 * Préchargement adaptatif : médiane des temps de dwell → fenêtre {prev, next}.
 * Les sauts slider / thumb rail ne doivent pas alimenter l'historique de dwell.
 */

export interface PreloadWindow {
  prev: number;
  next: number;
}

export const PRELOAD_MIN = 1;
export const PRELOAD_MAX = 8;
/** Fenêtre de montage pager (repris de ReaderCanvas). */
export const PAGE_MOUNT_WINDOW = 1;

const DWELL_RING_SIZE = 8;

export function clampPreload(value: number): number {
  if (!Number.isFinite(value)) return PRELOAD_MIN;
  return Math.min(PRELOAD_MAX, Math.max(PRELOAD_MIN, Math.trunc(value)));
}

export function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2;
  }
  return sorted[mid]!;
}

/**
 * Flip rapide → fenêtre next large ; lecture lente → fenêtre courte.
 * Médiane ≤0 (pas encore de samples) → défaut +2 / -1 historique.
 */
export function dwellToPreloadWindow(medianDwellMs: number): PreloadWindow {
  if (medianDwellMs <= 0) return { prev: 1, next: 2 };
  if (medianDwellMs < 400) return { prev: 2, next: 6 };
  if (medianDwellMs < 900) return { prev: 1, next: 4 };
  if (medianDwellMs < 1800) return { prev: 1, next: 3 };
  return { prev: 1, next: 2 };
}

export function resolvePreloadWindow(opts: {
  adaptive: boolean;
  medianDwellMs: number;
  manualPrev: number;
  manualNext: number;
}): PreloadWindow {
  if (!opts.adaptive) {
    return {
      prev: clampPreload(opts.manualPrev),
      next: clampPreload(opts.manualNext),
    };
  }
  const mapped = dwellToPreloadWindow(opts.medianDwellMs);
  return {
    prev: clampPreload(mapped.prev),
    next: clampPreload(mapped.next),
  };
}

/** Anneau borné pour les échantillons de dwell (ms). */
export class DwellRing {
  private samples: number[] = [];

  push(ms: number): void {
    if (!Number.isFinite(ms) || ms < 40 || ms > 60_000) return;
    this.samples.push(ms);
    if (this.samples.length > DWELL_RING_SIZE) {
      this.samples.shift();
    }
  }

  median(): number {
    return median(this.samples);
  }

  clear(): void {
    this.samples = [];
  }
}

export function isNearMounted(index: number, mounted: number, window = PAGE_MOUNT_WINDOW): boolean {
  return Math.abs(index - mounted) <= window;
}

/**
 * Utilitaires taxonomie multi-sources (module pur : importable partout,
 * y compris dans les bundles de tests sans mocks React Native).
 */

import type { SourceTaxonomyItem } from "./types";

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

/** Dédup insensible à la casse ; les premières occurrences gagnent ; tri alpha. */
export function dedupeTags(tags: SourceTaxonomyItem[]): SourceTaxonomyItem[] {
  const seen = new Set<string>();
  const out: SourceTaxonomyItem[] = [];
  for (const t of tags) {
    const key = normalizeName(t.name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

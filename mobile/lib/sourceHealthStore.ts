/**
 * Santé des sources au démarrage : badges vert/rouge + fallback home.
 */

import { useSyncExternalStore } from "react";
import type { SourceId } from "./sources/types";
import { listSources, getSource } from "./sources/registry";
import { probeAdapterHealth, type SourceHealthResult } from "./sources/probeHealth";

export type SourceHealthStatus = "unknown" | "checking" | "ok" | "down";

export interface SourceHealthEntry {
  status: SourceHealthStatus;
  latencyMs?: number;
  error?: string;
  checkedAt?: number;
}

type HealthMap = Record<SourceId, SourceHealthEntry>;

function emptyMap(): HealthMap {
  const map = {} as HealthMap;
  for (const meta of listSources()) {
    map[meta.id] = { status: "unknown" };
  }
  return map;
}

let healthMap: HealthMap = emptyMap();
let fallbackToastShown = false;
const listeners = new Set<() => void>();

function notify(): void {
  for (const l of listeners) l();
}

function snapshot(): HealthMap {
  return healthMap;
}

function isOfflineError(error?: string): boolean {
  return Boolean(error && /(network request failed|network down|offline|internet|failed to fetch)/i.test(error));
}

export function getSourceHealth(): HealthMap {
  return healthMap;
}

export function getSourceHealthEntry(id: SourceId): SourceHealthEntry {
  return healthMap[id] ?? { status: "unknown" };
}

export function subscribeSourceHealth(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useSourceHealth(): HealthMap {
  return useSyncExternalStore(subscribeSourceHealth, snapshot, snapshot);
}

export function useSourceHealthEntry(id: SourceId): SourceHealthEntry {
  const map = useSourceHealth();
  return map[id] ?? { status: "unknown" };
}

/**
 * Sonde toutes les sources en parallèle. Idempotent si déjà en cours.
 */
export async function checkAllSourcesHealth(ids?: SourceId[]): Promise<HealthMap> {
  const selected = listSources().filter(meta => (!ids || ids.includes(meta.id)) && healthMap[meta.id].status !== "checking");
  const previousMap = { ...healthMap };
  const next: HealthMap = { ...healthMap };
  for (const meta of selected) {
    next[meta.id] = { status: "checking", checkedAt: Date.now() };
  }
  healthMap = next;
  notify();

  await Promise.all(
    selected.map(async (meta) => {
      const adapter = getSource(meta.id);
      let result: SourceHealthResult;
      try {
        // A source is healthy only after a real catalogue → detail → image
        // traversal. Lightweight adapter pings can remain useful for local
        // diagnostics, but must not decide what the UI exposes.
        result = await probeAdapterHealth(adapter);
      } catch (err) {
        result = {
          ok: false,
          latencyMs: 0,
          error: err instanceof Error ? err.message : String(err),
        };
      }
      const previous = previousMap[meta.id] ?? { status: "unknown" as const };
      // Going offline is a device condition, not evidence that a provider is
      // down. Preserve the last known visibility and retry on foreground.
      const inconclusive = isOfflineError(result.error) || /timeout|délai|clé api|abonn|connexion à la source|sonde indisponible|^Image |Aucun résultat|Pas d.URL/i.test(result.error ?? "");
      const status = inconclusive
        ? previous.status
        : result.ok ? "ok" : "down";
      healthMap = {
        ...healthMap,
        [meta.id]: {
          status,
          latencyMs: result.latencyMs,
          error: result.error,
          checkedAt: Date.now(),
        },
      };
      notify();
    })
  );

  notify();
  return healthMap;
}

/**
 * Si la source active est down et ≠ "all", propose une bascule.
 * Retourne la source de remplacement ou null.
 */
export function pickFallbackSource(
  active: SourceId | "all"
): SourceId | "all" | null {
  if (active === "all") return null;
  const entry = healthMap[active];
  if (!entry || entry.status !== "down") return null;

  const firstOk = listSources().find((m) => healthMap[m.id]?.status === "ok");
  if (firstOk) return firstOk.id;
  return "all";
}

export function consumeFallbackToast(): boolean {
  if (fallbackToastShown) return false;
  fallbackToastShown = true;
  return true;
}

export function resetFallbackToastFlag(): void {
  fallbackToastShown = false;
}

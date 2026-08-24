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
let checking = false;
let fallbackToastShown = false;
const listeners = new Set<() => void>();

function notify(): void {
  for (const l of listeners) l();
}

function snapshot(): HealthMap {
  return healthMap;
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
export async function checkAllSourcesHealth(): Promise<HealthMap> {
  if (checking) return healthMap;
  checking = true;
  const next: HealthMap = { ...healthMap };
  for (const meta of listSources()) {
    next[meta.id] = { status: "checking", checkedAt: Date.now() };
  }
  healthMap = next;
  notify();

  await Promise.all(
    listSources().map(async (meta) => {
      const adapter = getSource(meta.id);
      let result: SourceHealthResult;
      try {
        if (adapter.healthCheck) {
          result = await adapter.healthCheck();
        } else {
          result = await probeAdapterHealth(adapter);
        }
      } catch (err) {
        result = {
          ok: false,
          latencyMs: 0,
          error: err instanceof Error ? err.message : String(err),
        };
      }
      healthMap = {
        ...healthMap,
        [meta.id]: {
          status: result.ok ? "ok" : "down",
          latencyMs: result.latencyMs,
          error: result.error,
          checkedAt: Date.now(),
        },
      };
      notify();
    })
  );

  checking = false;
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

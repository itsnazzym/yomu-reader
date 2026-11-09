import { sha256 } from "@noble/hashes/sha2.js";
import type { BackupData } from "../backupStore";

const arrays = ["favorites", "history", "tagCollections", "libraryCollections"] as const;
const objects = ["tagFavorites", "readerSettings", "privacy", "followsFeed", "downloadSettings"] as const;
const sets = ["blacklistTags", "searchHistory"] as const;
type Fields = typeof arrays[number] | typeof objects[number] | typeof sets[number];
export type SyncBaseline = Partial<Record<Fields, Record<string, string>>>;

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).filter(([, v]) => v !== undefined).map(([k, v]) => [k, stable(v)]));
  return value;
}

function fingerprint(value: unknown): string {
  return Array.from(sha256(new TextEncoder().encode(JSON.stringify(stable(value))))).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function identity(item: Record<string, unknown>, field: Fields): string {
  if (field !== "favorites" && field !== "history") return String(item.id || item.globalId || fingerprint(item));
  const gallery = item.gallery && typeof item.gallery === "object" ? item.gallery as Record<string, unknown> : item;
  if (typeof gallery.globalId === "string") return gallery.globalId;
  const source = String(item.source || gallery.scanlator || "nhentai");
  const known = ["nhentai", "3hentai", "doujins", "hitomi"].includes(source) ? source : "nhentai";
  return `${known}:${gallery.id ?? item.galleryId ?? fingerprint(item)}`;
}

function entries(data: BackupData, field: Fields): Map<string, unknown> {
  if (arrays.some((name) => name === field)) return new Map(((data[field] || []) as Record<string, unknown>[]).map((item) => [identity(item, field), item]));
  if (sets.some((name) => name === field)) return new Map(((data[field] || []) as string[]).map((value) => [value, value]));
  return new Map(Object.entries(data[field] || {}));
}

/** Fingerprints, rather than complete plaintext snapshots, identify changes and deletions. */
export function createSyncBaseline(data: BackupData): SyncBaseline {
  return Object.fromEntries([...arrays, ...objects, ...sets].map((field) => [field, Object.fromEntries([...entries(data, field)].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => [key, fingerprint(value)]))]));
}

export function backupsEqual(a: BackupData, b: BackupData): boolean {
  return fingerprint(createSyncBaseline(a)) === fingerprint(createSyncBaseline(b));
}

/** Three-way merge: a deletion observed against the last sync wins over a concurrent edit. */
export function mergeBackups(remote: BackupData, local: BackupData, baseline: SyncBaseline = {}): BackupData {
  const result = { ...remote, ...local, exportedAt: new Date().toISOString() };
  for (const field of [...arrays, ...objects, ...sets]) {
    const r = entries(remote, field), l = entries(local, field), base = baseline[field] || {};
    const merged = new Map<string, unknown>();
    for (const key of new Set([...r.keys(), ...l.keys(), ...Object.keys(base)])) {
      const existed = Object.hasOwn(base, key);
      if (existed && (!r.has(key) || !l.has(key))) continue;
      if (!l.has(key)) { if (r.has(key)) merged.set(key, r.get(key)); continue; }
      if (!r.has(key)) { merged.set(key, l.get(key)); continue; }
      const localUnchanged = existed && fingerprint(l.get(key)) === base[key];
      const remoteUnchanged = existed && fingerprint(r.get(key)) === base[key];
      let value = localUnchanged && !remoteUnchanged ? r.get(key) : l.get(key);
      if (field === "history" && !localUnchanged && !remoteUnchanged) {
        const left = l.get(key) as Record<string, unknown>, right = r.get(key) as Record<string, unknown>;
        if (Number(right.readAt || 0) > Number(left.readAt || 0)) value = right;
      }
      merged.set(key, value);
    }
    const value = arrays.some((name) => name === field) || sets.some((name) => name === field) ? [...merged.values()] : Object.fromEntries(merged);
    Object.assign(result, { [field]: field === "searchHistory" ? (value as string[]).slice(0, 200) : value });
  }
  return result;
}

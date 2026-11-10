import type { Gallery } from "../lib/api/types";
const files = new Map<string, Uint8Array>();
const directories = new Set<string>();
let network = { type: "wifi", isConnected: true };
const listeners = new Set<(state: typeof network) => void>();
export function __network(type: string) { network = { type, isConnected: true }; for (const listener of listeners) listener(network); }
export default { fetch: async () => network, addEventListener: (fn: (s: typeof network) => void) => { listeners.add(fn); return () => listeners.delete(fn); } };
export const documentDirectory = "file:///audit/";
export const cacheDirectory = "file:///audit-cache/";
export const EncodingType = { Base64: "base64", UTF8: "utf8" };
export const transfers: string[] = [];
export let failSaf = false;
export function __failSaf(value: boolean) { failSaf = value; }
export let onTransfer: () => void = () => {};
export function __onTransfer(fn: () => void) { onTransfer = fn; }
export async function makeDirectoryAsync(uri: string) { directories.add(uri.replace(/\/$/, "")); }
export async function readDirectoryAsync(uri: string) { return [...files.keys()].filter(k => k.startsWith(uri + "/")).map(k => k.slice(uri.length + 1)); }
export async function copyAsync({ from, to }: { from: string; to: string }) { files.set(to, files.get(from)!); }
export async function getInfoAsync(uri: string) { const directory = directories.has(uri.replace(/\/$/, "")); return { exists: directory || files.has(uri), size: files.get(uri)?.length ?? 0, isDirectory: directory }; }
export async function readAsStringAsync(uri: string, options?: { encoding?: string; position?: number; length?: number }) {
  const value = files.get(uri) ?? new Uint8Array();
  const slice = value.slice(options?.position ?? 0, options?.length === undefined ? undefined : (options.position ?? 0) + options.length);
  return options?.encoding === "base64" ? Buffer.from(slice).toString("base64") : new TextDecoder().decode(value);
}
export async function writeAsStringAsync(uri: string, value: string) { files.set(uri, new TextEncoder().encode(value)); }
export async function deleteAsync(uri: string) { files.delete(uri); }
export async function moveAsync({ from, to }: { from: string; to: string }) { files.set(to, files.get(from)!); files.delete(from); }
export function createDownloadResumable(url: string, uri: string) {
  let cancelled = false;
  return {
    savable: () => ({}), cancelAsync: async () => { cancelled = true; },
    downloadAsync: async () => {
      transfers.push(url); onTransfer(); await Promise.resolve();
      if (cancelled) return null;
      const jpeg = new Uint8Array(400); jpeg.set([255,216,255]); jpeg.set([255,217],398); files.set(uri,jpeg);
      return { status: 200, headers: { "content-length": "400" }, uri };
    },
  };
}
export const StorageAccessFramework = {
  makeDirectoryAsync: async () => { if (failSaf) throw new Error("folder unavailable"); return "content://folder"; },
  createFileAsync: async () => "content://file",
};
export async function activateKeepAwakeAsync() {}
export function deactivateKeepAwake() {}
export async function getGallery(id: number): Promise<Gallery> {
  return { id, media_id: String(id), globalId: `nhentai:${id}`, title: { english: "Fixture", pretty: "Fixture", japanese: "" }, images: { pages: [1,2].map(n => ({ t: "j", w: 10, h: 10, url: `https://example.test/${id}/${n}.jpg` })), cover: { t:"j", w:10, h:10 }, thumbnail: { t:"j", w:10, h:10 } }, tags: [], scanlator: "", upload_date:0, num_pages:2, num_favorites:0 };
}
export function resolvePageUrl() { return "https://example.test/fallback.jpg"; }
export async function searchGalleries() { return { result: [], num_pages: 0, per_page: 0 }; }
export async function restoreLocalAvatarFromSaf() { return null; }
export function getAccountSession() { return {}; }
export async function saveAccountSession() {}

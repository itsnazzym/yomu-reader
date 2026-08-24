/**
 * Global gallery IDs shared with mobile (GlobalGalleryId).
 * Desktop nHentai API still uses numeric ids; stores key on "nhentai:123".
 */

export type SourceId = "nhentai" | "3hentai" | "doujins" | "hitomi";
export type GlobalGalleryId = string;

export function makeGlobalId(
  source: SourceId,
  nativeId: string | number
): GlobalGalleryId {
  return `${source}:${nativeId}`;
}

export function splitGlobalId(id: GlobalGalleryId | number): {
  source: SourceId;
  nativeId: string;
} {
  const raw = String(id);
  const idx = raw.indexOf(":");
  if (idx <= 0) {
    return { source: "nhentai", nativeId: raw };
  }
  const source = raw.slice(0, idx);
  if (!["nhentai", "3hentai", "doujins", "hitomi"].includes(source)) {
    return { source: "nhentai", nativeId: raw };
  }
  return { source: source as SourceId, nativeId: raw.slice(idx + 1) };
}

/** Prefer gallery.globalId when present; else nhentai:{id}. */
export function galleryGlobalId(gallery: {
  id: number | string;
  globalId?: string;
}): GlobalGalleryId {
  if (typeof gallery.globalId === "string" && gallery.globalId.includes(":")) {
    return gallery.globalId;
  }
  return makeGlobalId("nhentai", gallery.id);
}

export function nativeIdAsNumber(globalId: GlobalGalleryId | number): number {
  const { nativeId } = splitGlobalId(globalId);
  const n = Number.parseInt(nativeId, 10);
  return Number.isFinite(n) ? n : 0;
}

export function isDesktopReadableSource(globalId: GlobalGalleryId): boolean {
  return splitGlobalId(globalId).source === "nhentai";
}

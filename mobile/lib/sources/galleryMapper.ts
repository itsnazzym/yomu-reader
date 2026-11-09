/**
 * Conversion SourceGallery -> Gallery : réutilise toute l'UI existante
 * (lecteur, fiche, téléchargement) pour les sources alternatives.
 * Anciennement dupliqué dans read.tsx et book/[id]/index.tsx.
 */

import type { Gallery, TagType } from "../api/types";
import type { SourceGallery, SourceId } from "./types";

function unixSeconds(value: number | undefined): number {
  if (!value || !Number.isFinite(value) || value < 0) return 0;
  const seconds = Math.floor(value > 100_000_000_000 ? value / 1000 : value);
  return seconds <= 4_102_444_800 ? seconds : 0;
}

export function sourceGalleryToGallery(
  sg: SourceGallery,
  sourceId: SourceId
): Gallery {
  return {
    id: Number(sg.nativeId) || 0,
    media_id: sg.nativeId,
    title: { english: sg.title, japanese: "", pretty: sg.title },
    images: {
      pages: sg.pageUrls.map((p) => ({
        t: "j" as const,
        w: p.width || 0,
        h: p.height || 0,
        url: p.url,
      })),
      cover: { t: "j", w: 0, h: 0, url: sg.coverUrl },
      thumbnail: { t: "j", w: 0, h: 0, url: sg.coverUrl },
    },
    scanlator: sourceId,
    upload_date: unixSeconds(sg.uploadDate),
    tags: sg.tags.map((t, i) => ({
      id: i,
      type: (t.type || "tag") as TagType,
      name: t.name,
      url: "",
      count: typeof t.count === "number" ? t.count : 0,
    })),
    num_pages: sg.numPages,
    num_favorites: 0,
    category: sg.category,
    rating: sg.rating,
    globalId: sg.globalId,
  };
}

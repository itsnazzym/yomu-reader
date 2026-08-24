/**
 * Matching doublons cross-source (métadonnées) — pas de merge destructif.
 * Clé v1 : titre normalisé + artist + num_pages ± 1.
 */

import type { Gallery, Tag } from "./api/types";
import { makeGlobalId, type SourceId } from "./sources/types";

export interface DuplicateCandidate {
  globalId: string;
  title: string;
  artist?: string;
  numPages: number;
  source?: SourceId | string;
}

export interface DuplicateGroup {
  canonicalGroupId: string;
  members: DuplicateCandidate[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Normalise un titre pour la comparaison (casse, ponctuation, espaces). */
export function normalizeTitle(title: string): string {
  return (title || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\[[^\]]*]/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractArtistName(tags: Tag[] | undefined): string {
  if (!Array.isArray(tags)) return "";
  const artist = tags.find((t) => t.type === "artist");
  return artist?.name ? normalizeTitle(artist.name) : "";
}

export function galleryToDuplicateCandidate(gallery: Gallery): DuplicateCandidate {
  const prefix = gallery.globalId?.split(":")[0];
  const source: string =
    prefix ||
    (gallery.scanlator === "3hentai" || gallery.scanlator === "doujins"
      ? gallery.scanlator
      : "nhentai");
  const sourceId: SourceId =
    source === "3hentai" || source === "doujins" || source === "hitomi"
      ? source
      : "nhentai";
  const globalId = gallery.globalId || makeGlobalId(sourceId, gallery.id);
  const title =
    gallery.title?.pretty || gallery.title?.english || gallery.title?.japanese || "";
  return {
    globalId,
    title,
    artist: extractArtistName(gallery.tags),
    numPages: gallery.num_pages || 0,
    source,
  };
}

function pagesClose(a: number, b: number): boolean {
  if (!a || !b) return a === b;
  return Math.abs(a - b) <= 1;
}

/** Deux candidats matchent s'ils partagent titre+artist+pages±1. */
export function isDuplicateMatch(
  a: DuplicateCandidate,
  b: DuplicateCandidate
): boolean {
  if (a.globalId === b.globalId) return false;
  const titleA = normalizeTitle(a.title);
  const titleB = normalizeTitle(b.title);
  if (!titleA || titleA !== titleB) return false;
  const artistA = a.artist || "";
  const artistB = b.artist || "";
  if (artistA !== artistB) return false;
  return pagesClose(a.numPages, b.numPages);
}

/**
 * Groupe les candidats en clusters de doublons.
 * canonicalGroupId = premier globalId du groupe (stable pour une session).
 */
export function findDuplicateGroups(
  candidates: DuplicateCandidate[]
): DuplicateGroup[] {
  const groups: DuplicateGroup[] = [];
  const assigned = new Set<string>();

  for (let i = 0; i < candidates.length; i += 1) {
    const seed = candidates[i];
    if (!seed || assigned.has(seed.globalId)) continue;
    const members: DuplicateCandidate[] = [seed];
    assigned.add(seed.globalId);
    for (let j = i + 1; j < candidates.length; j += 1) {
      const other = candidates[j];
      if (!other || assigned.has(other.globalId)) continue;
      if (isDuplicateMatch(seed, other)) {
        members.push(other);
        assigned.add(other.globalId);
      }
    }
    if (members.length > 1) {
      groups.push({
        canonicalGroupId: members[0]!.globalId,
        members,
      });
    }
  }
  return groups;
}

/** Autres sources du même groupe pour un globalId donné. */
export function otherSourcesInGroup(
  globalId: string,
  groups: DuplicateGroup[]
): string[] {
  const group = groups.find((g) => g.members.some((m) => m.globalId === globalId));
  if (!group) return [];
  const sources = new Set<string>();
  for (const m of group.members) {
    if (m.globalId === globalId) continue;
    if (m.source) sources.add(m.source);
  }
  return [...sources];
}

export function parseDuplicateCandidate(raw: unknown): DuplicateCandidate | null {
  if (!isRecord(raw) || typeof raw.globalId !== "string") return null;
  return {
    globalId: raw.globalId,
    title: typeof raw.title === "string" ? raw.title : "",
    artist: typeof raw.artist === "string" ? raw.artist : undefined,
    numPages: Number(raw.numPages) || 0,
    source: typeof raw.source === "string" ? raw.source : undefined,
  };
}

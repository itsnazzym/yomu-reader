/**
 * Parsing des deep links Yomu / nhentai.
 * Schemes : yomureader:// et nhentaidownlo://
 * Routes : gallery/<id> | gallery/<source>/<id> | https://nhentai.net/g/<id>
 */

import type { SourceId } from "./sources/types";

export interface DeepLinkTarget {
  id: string;
  src?: SourceId;
}

const KNOWN_SOURCES: ReadonlySet<SourceId> = new Set([
  "nhentai",
  "3hentai",
  "doujins",
  "hitomi",
]);

function asSourceId(value: string): SourceId | undefined {
  if (value === "nhentai") return undefined;
  if ((KNOWN_SOURCES as ReadonlySet<string>).has(value)) {
    return value as SourceId;
  }
  return undefined;
}

function parsePathSegments(path: string): string[] {
  return path
    .replace(/^\/+/, "")
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Retourne une cible book/[id] ou null si l'URL n'est pas reconnue / invalide.
 */
export function parseGalleryDeepLink(url: string): DeepLinkTarget | null {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  try {
    // https://nhentai.net/g/177013[/…]
    const httpsMatch = trimmed.match(
      /^https?:\/\/(?:www\.)?nhentai\.net\/g\/(\d+)(?:\/|$|\?)/i
    );
    if (httpsMatch?.[1]) {
      return { id: httpsMatch[1] };
    }

    // Custom schemes — Linking peut donner yomureader://gallery/177013
    // ou yomureader:///gallery/177013 selon la plateforme.
    const schemeMatch = trimmed.match(
      /^(?:yomureader|nhentaidownlo):\/\/(?:\/)?(.+)$/i
    );
    if (!schemeMatch?.[1]) return null;

    const rest = schemeMatch[1].replace(/\?.*$/, "").replace(/#.*$/, "");
    const segments = parsePathSegments(rest);
    if (segments.length === 0) return null;

    // gallery/<id>  ou  gallery/<source>/<id>  ou  g/<id>
    const head = segments[0]?.toLowerCase();
    if (head === "gallery" || head === "g") {
      if (segments.length === 2 && /^\d+$/.test(segments[1]!)) {
        return { id: segments[1]! };
      }
      if (segments.length >= 3) {
        const maybeSource = segments[1]!.toLowerCase();
        const maybeId = segments[2]!;
        if (!/^\d+$/.test(maybeId) && !/^[a-zA-Z0-9_-]+$/.test(maybeId)) {
          return null;
        }
        if (maybeSource === "nhentai") {
          return { id: maybeId };
        }
        const src = asSourceId(maybeSource);
        if (src) return { id: maybeId, src };
        // Source inconnue : traiter le 2e segment comme id si numérique
        if (/^\d+$/.test(maybeSource)) {
          return { id: maybeSource };
        }
      }
    }

    // Raccourci : yomureader://177013
    if (segments.length === 1 && /^\d+$/.test(segments[0]!)) {
      return { id: segments[0]! };
    }
  } catch {
    return null;
  }

  return null;
}

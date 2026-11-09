/**
 * Contrat multi-sources à la Mihon : chaque site est un SourceAdapter qui
 * mappe sa structure vers le modèle normalisé de l'app.
 *
 * Les favoris, l'historique/reprise et les téléchargements sont GLOBAUX :
 * ils référencent des GlobalGalleryId ("nhentai:12345") composés, jamais
 * des ids natifs nus.
 */

export type SourceId = "nhentai" | "3hentai" | "doujins" | "hitomi" | "ehentai" | "rule34";

/** Identifiant global unique d'une galerie, toutes sources confondues. */
export type GlobalGalleryId = string;

export function makeGlobalId(
  source: SourceId,
  nativeId: string | number
): GlobalGalleryId {
  return `${source}:${nativeId}`;
}

export function splitGlobalId(id: GlobalGalleryId): {
  source: SourceId;
  nativeId: string;
} {
  const idx = id.indexOf(":");
  if (idx <= 0) {
    // Legacy pré-migration : un id numérique nu était forcément nhentai.
    return { source: "nhentai", nativeId: id };
  }
  const source = id.slice(0, idx);
  // Un préfixe inconnu retombe sur nhentai plutôt que de crasher l'app.
  if (!["nhentai", "3hentai", "doujins", "hitomi", "ehentai", "rule34"].includes(source)) {
    return { source: "nhentai", nativeId: id };
  }
  return { source: source as SourceId, nativeId: id.slice(idx + 1) };
}

/** Métadonnées affichables d'une source (badges, réglages). */
export interface SourceMeta {
  id: SourceId;
  label: string;
  baseUrl: string;
  /** Couleur du badge de carte. */
  accentColor: string;
  supportsLogin: boolean;
  supportsComments: boolean;
}

export interface SourceSearchOptions {
  query?: string;
  page?: number;
  /** Sémantique par source ; défaut "recent". */
  sort?: string;
  /** Filtre langue séparé de la requête ("english" | "japanese" | "all" | slug). */
  language?: string;
}

export interface SourceCapabilities {
  search: boolean;
  pagination: boolean;
  tags: boolean;
  random: boolean;
}

export type SourceErrorCode =
  | "offline"
  | "timeout"
  | "http"
  | "rate_limited"
  | "parse"
  | "paywalled"
  | "not_found"
  | "unsupported";

export class SourceError extends Error {
  constructor(
    public readonly code: SourceErrorCode,
    message: string,
    public readonly status?: number
  ) {
    super(message);
    this.name = "SourceError";
  }
}

/** Cancellation travels from a screen change to adapters that support fetch signals. */
export interface SourceRequestOptions {
  signal?: AbortSignal;
}

export interface SourceTag {
  name: string;
  /** Type libre selon la source ("artist", "tag", "language"...). */
  type?: string;
  /** Compteur optionnel (souvent absent hors nHentai). */
  count?: number;
}

/** Carte légère pour les listings. */
export interface SourceGalleryCard {
  globalId: GlobalGalleryId;
  title: string;
  coverUrl: string;
  numPages?: number;
  uploadDate?: number;
  tags?: SourceTag[];
  access?: "public" | "subscriber" | "unknown";
  category?: string;
  rating?: number;
  uploader?: string;
}

/** Galerie complète, prête pour le lecteur. */
export interface SourceGallery {
  globalId: GlobalGalleryId;
  nativeId: string;
  title: string;
  coverUrl: string;
  numPages: number;
  uploadDate?: number;
  tags: SourceTag[];
  category?: string;
  rating?: number;
  uploader?: string;
  /**
   * URLs des pages dans l'ordre. Pour les sources à signatures (doujins),
   * ces URLs sont fraîchement capturées et périment : toujours passer par
   * getGallery() avant de lire, jamais cacher les URLs au-delà d'une session.
   */
  pageUrls: { url: string; width?: number; height?: number }[];
}

/**
 * Contrat d'une source. Toutes les méthodes sont async et lancent Error("…")
 * en cas d'échec réseau ou de parsing.
 */
export interface SourceAdapter {
  meta: SourceMeta;
  capabilities: SourceCapabilities;
  search(opts: SourceSearchOptions, request?: SourceRequestOptions): Promise<{
    cards: SourceGalleryCard[];
    hasMore: boolean;
  }>;
  getGallery(nativeId: string, knownTitle?: string, request?: SourceRequestOptions): Promise<SourceGallery>;
  getRandomNativeId?(request?: SourceRequestOptions): Promise<string>;
  /**
   * Liste réelle des tags du site (périmètre : tags uniquement). Absente si
   * la source n'expose pas de taxonomie exploitable ; l'appelant retombe
   * alors sur la DB statique nhentai.
   */
  getTags?(request?: SourceRequestOptions): Promise<SourceTaxonomyItem[]>;
  /**
   * Ping léger (search → getGallery → HEAD). Absent = sonde générique
   * via probeAdapterHealth.
   */
  healthCheck?(): Promise<{ ok: boolean; latencyMs: number; error?: string }>;
}

/** Entrée de la liste de tags native d'une source. */
export interface SourceTaxonomyItem {
  /** Libellé tel qu'utilisé dans la recherche du site. */
  name: string;
  /** Nombre de galeries portant ce tag, quand le site le fournit. */
  count?: number;
  /** Identifiant natif du tag (ex. tag_id doujins), si le site en a un. */
  id?: string;
}

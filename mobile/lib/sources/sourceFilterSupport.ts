import type { SourceId } from "./types";

export interface SourceFilterSupport {
  /** La source supporte-t-elle le filtrage par catégories ? */
  supportsCategories: boolean;
  /** Liste des catégories supportées par cette source */
  supportedCategories: string[];
  /** La source supporte-t-elle la plage de pages (min/max) ? */
  supportsPages: boolean;
  /** La source supporte-t-elle la note minimale (1..5 étoiles) ? */
  supportsRating: boolean;
  /** La source supporte-t-elle le tri (recent, popular) ? */
  supportsSort: boolean;
  /** La source supporte-t-elle le filtre de langue ? */
  supportsLanguage: boolean;
  /** La source supporte-t-elle le filtre de date de téléversement ? */
  supportsDate: boolean;
}

export const ALL_EHENTAI_CATEGORIES = [
  "Doujinshi",
  "Manga",
  "Image Set",
  "Game CG",
  "Artist CG",
  "Cosplay",
  "Non-H",
  "Asian Porn",
  "Western",
  "Misc",
];

export function getSourceFilterSupport(sourceId?: SourceId | "all"): SourceFilterSupport {
  switch (sourceId) {
    case "ehentai":
      return {
        supportsCategories: true,
        supportedCategories: ALL_EHENTAI_CATEGORIES,
        supportsPages: true,
        supportsRating: true,
        supportsSort: false,
        supportsLanguage: false,
        supportsDate: false,
      };

    case "nhentai":
      return {
        supportsCategories: true,
        supportedCategories: ALL_EHENTAI_CATEGORIES,
        supportsPages: true,
        supportsRating: false, // nHentai n'a pas de système de notation
        supportsSort: true,
        supportsLanguage: true,
        supportsDate: true,
      };

    case "hitomi":
      return {
        supportsCategories: true,
        // Hitomi supporte les types manga, doujinshi, gamecg, artistcg
        supportedCategories: ["Doujinshi", "Manga", "Artist CG", "Game CG"],
        supportsPages: false,
        supportsRating: false,
        supportsSort: false,
        supportsLanguage: true,
        supportsDate: false,
      };

    case "3hentai":
      return {
        supportsCategories: false,
        supportedCategories: [],
        supportsPages: false,
        supportsRating: false,
        supportsSort: false,
        supportsLanguage: true,
        supportsDate: false,
      };

    case "rule34":
      return {
        supportsCategories: false,
        supportedCategories: [],
        supportsPages: false,
        supportsRating: false,
        supportsSort: false,
        supportsLanguage: false,
        supportsDate: false,
      };

    case "doujins":
      return {
        supportsCategories: false,
        supportedCategories: [],
        supportsPages: false,
        supportsRating: false,
        supportsSort: false,
        supportsLanguage: false,
        supportsDate: false,
      };

    case "all":
    default:
      return {
        supportsCategories: true,
        supportedCategories: ALL_EHENTAI_CATEGORIES,
        supportsPages: true,
        supportsRating: true,
        supportsSort: true,
        supportsLanguage: true,
        supportsDate: true,
      };
  }
}

/** Vérifie si la source a au moins un filtre avancé compatible */
export function hasAnyFilterSupport(sourceId?: SourceId | "all"): boolean {
  const s = getSourceFilterSupport(sourceId);
  return (
    s.supportsCategories ||
    s.supportsPages ||
    s.supportsRating ||
    s.supportsSort ||
    s.supportsLanguage ||
    s.supportsDate
  );
}

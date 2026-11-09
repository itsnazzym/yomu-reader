/**
 * Catégories et charte couleur E-Hentai / ExHentai inspirées de JHenTai.
 * Les couleurs et libellés respectent la convention manga d'E-Hentai.
 */

export interface EhentaiCategory {
  id: string;
  name: string;
  bitmask: number;
  color: string;
  bgTint: string;
}

export const EHENTAI_CATEGORIES: Record<string, EhentaiCategory> = {
  Doujinshi: {
    id: "Doujinshi",
    name: "Doujinshi",
    bitmask: 2,
    color: "#e63946",
    bgTint: "rgba(230, 57, 70, 0.16)",
  },
  Manga: {
    id: "Manga",
    name: "Manga",
    bitmask: 4,
    color: "#f77f00",
    bgTint: "rgba(247, 127, 0, 0.16)",
  },
  "Artist CG": {
    id: "Artist CG",
    name: "Artist CG",
    bitmask: 8,
    color: "#e0a96d",
    bgTint: "rgba(224, 169, 109, 0.16)",
  },
  "Game CG": {
    id: "Game CG",
    name: "Game CG",
    bitmask: 16,
    color: "#06d6a0",
    bgTint: "rgba(6, 214, 160, 0.16)",
  },
  Western: {
    id: "Western",
    name: "Western",
    bitmask: 512,
    color: "#8ac926",
    bgTint: "rgba(138, 201, 38, 0.16)",
  },
  "Non-H": {
    id: "Non-H",
    name: "Non-H",
    bitmask: 256,
    color: "#118ab2",
    bgTint: "rgba(17, 138, 178, 0.16)",
  },
  "Image Set": {
    id: "Image Set",
    name: "Image Set",
    bitmask: 32,
    color: "#4361ee",
    bgTint: "rgba(67, 97, 238, 0.16)",
  },
  Cosplay: {
    id: "Cosplay",
    name: "Cosplay",
    bitmask: 64,
    color: "#7209b7",
    bgTint: "rgba(114, 9, 183, 0.16)",
  },
  "Asian Porn": {
    id: "Asian Porn",
    name: "Asian Porn",
    bitmask: 128,
    color: "#f72585",
    bgTint: "rgba(247, 37, 133, 0.16)",
  },
  Misc: {
    id: "Misc",
    name: "Misc",
    bitmask: 1,
    color: "#6c757d",
    bgTint: "rgba(108, 117, 125, 0.16)",
  },
};

export const EHENTAI_CATEGORY_LIST: EhentaiCategory[] = Object.values(EHENTAI_CATEGORIES);

/** Résout les informations visuelles d'une catégorie E-Hentai. */
export function getEhentaiCategoryInfo(categoryName?: string): EhentaiCategory {
  if (!categoryName) return EHENTAI_CATEGORIES.Misc;
  const match = Object.keys(EHENTAI_CATEGORIES).find(
    (k) => k.toLowerCase() === categoryName.trim().toLowerCase()
  );
  return match ? EHENTAI_CATEGORIES[match] : EHENTAI_CATEGORIES.Misc;
}

/** Calcule le masque binaire f_cats pour exclure les catégories désactivées. */
export function calculateCategoryBitmask(disabledCategories: string[]): number {
  let mask = 0;
  for (const cat of disabledCategories) {
    const info = getEhentaiCategoryInfo(cat);
    if (info) mask |= info.bitmask;
  }
  return mask;
}

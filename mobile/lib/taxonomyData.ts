
import type { Icon as TablerIcon } from "@tabler/icons-react-native";
import {
  IconTag,
  IconDeviceTv,
  IconUser,
  IconFeather,
  IconUsers,
  IconWorld,
} from "@tabler/icons-react-native";
import rawTagsDb from "./nhentai-tags.json";

export interface TaxonomyItem {
  id: number;
  name: string;
  count: number;
  category: "tags" | "parodies" | "characters" | "artists" | "groups" | "languages";
}

interface CategoryMetaItem {
  icon: TablerIcon;
  color: string;
  label: string;
  type: string;
}

export const CATEGORY_META: Record<string, CategoryMetaItem> = {
  tags: { icon: IconTag, color: "#60a5fa", label: "Tag", type: "tag" },
  tag: { icon: IconTag, color: "#60a5fa", label: "Tag", type: "tag" },
  parodies: { icon: IconDeviceTv, color: "#a78bfa", label: "Série", type: "parody" },
  parody: { icon: IconDeviceTv, color: "#a78bfa", label: "Série", type: "parody" },
  parodys: { icon: IconDeviceTv, color: "#a78bfa", label: "Série", type: "parody" },
  characters: { icon: IconUser, color: "#22d3ee", label: "Personnage", type: "character" },
  character: { icon: IconUser, color: "#22d3ee", label: "Personnage", type: "character" },
  artists: { icon: IconFeather, color: "#f472b6", label: "Artiste", type: "artist" },
  artist: { icon: IconFeather, color: "#f472b6", label: "Artiste", type: "artist" },
  groups: { icon: IconUsers, color: "#c084fc", label: "Groupe", type: "group" },
  group: { icon: IconUsers, color: "#c084fc", label: "Groupe", type: "group" },
  languages: { icon: IconWorld, color: "#34d399", label: "Langue", type: "language" },
  language: { icon: IconWorld, color: "#34d399", label: "Langue", type: "language" },
  categories: { icon: IconTag, color: "#38bdf8", label: "Catégorie", type: "category" },
  category: { icon: IconTag, color: "#38bdf8", label: "Catégorie", type: "category" },
};

type RawEntry =
  | [number | string, string, (number | string)?]
  | { id?: number | string; name?: string; count?: number | string };

interface RawTagsDatabase {
  updated?: string;
  tags?: RawEntry[];
  artists?: RawEntry[];
  characters?: RawEntry[];
  parodies?: RawEntry[];
  groups?: RawEntry[];
}

const typedRawDb = rawTagsDb as unknown as RawTagsDatabase;

const mapRawEntries = (
  entries: readonly RawEntry[] | undefined,
  category: TaxonomyItem["category"]
): TaxonomyItem[] => {
  if (!Array.isArray(entries)) return [];
  return entries
    .map((e): TaxonomyItem => {
      if (Array.isArray(e)) {
        const idRaw = e[0];
        const countRaw = e[2];
        return {
          id: typeof idRaw === "number" ? idRaw : parseInt(String(idRaw), 10) || 0,
          name: String(e[1] || ""),
          count: typeof countRaw === "number" ? countRaw : parseInt(String(countRaw), 10) || 0,
          category,
        };
      }
      const idRaw = e.id;
      const countRaw = e.count;
      return {
        id: typeof idRaw === "number" ? idRaw : parseInt(String(idRaw), 10) || 0,
        name: String(e.name || ""),
        count: typeof countRaw === "number" ? countRaw : parseInt(String(countRaw), 10) || 0,
        category,
      };
    })
    .sort((a, b) => b.count - a.count);
};

export const DB_CATEGORIES: Record<string, TaxonomyItem[]> = {
  tags: mapRawEntries(typedRawDb.tags, "tags"),
  artists: mapRawEntries(typedRawDb.artists, "artists"),
  characters: mapRawEntries(typedRawDb.characters, "characters"),
  parodies: mapRawEntries(typedRawDb.parodies, "parodies"),
  groups: mapRawEntries(typedRawDb.groups, "groups"),
  languages: [
    { id: 16947, name: "french", count: 28000, category: "languages" },
    { id: 12227, name: "english", count: 210000, category: "languages" },
    { id: 6346, name: "japanese", count: 340000, category: "languages" },
    { id: 29963, name: "chinese", count: 98000, category: "languages" },
    { id: 20525, name: "spanish", count: 22000, category: "languages" },
    { id: 12824, name: "german", count: 8500, category: "languages" },
    { id: 20617, name: "russian", count: 18000, category: "languages" },
    { id: 33842, name: "italian", count: 7200, category: "languages" },
    { id: 35763, name: "korean", count: 14000, category: "languages" },
  ],
};

export const POPULAR_TAXONOMIES: TaxonomyItem[] = [
  ...DB_CATEGORIES.tags.slice(0, 100),
  ...DB_CATEGORIES.artists.slice(0, 60),
  ...DB_CATEGORIES.parodies.slice(0, 60),
  ...DB_CATEGORIES.characters.slice(0, 60),
  ...DB_CATEGORIES.groups.slice(0, 40),
  ...DB_CATEGORIES.languages,
].sort((a, b) => b.count - a.count);

/**
 * Récupère tous les tags d'une catégorie donnée avec recherche optionnelle
 */
export function getAllTaxonomies(category: string, query?: string): TaxonomyItem[] {
  let list: TaxonomyItem[] = [];
  if (category === "all") {
    list = POPULAR_TAXONOMIES;
  } else if (DB_CATEGORIES[category]) {
    list = DB_CATEGORIES[category];
  }

  if (!query || !query.trim()) return list;
  const q = query.trim().toLowerCase();
  return list.filter((item) => item.name.toLowerCase().includes(q));
}

/**
 * Recherche rapide autocomplétion pour la barre de recherche
 */
export function searchTaxonomy(query: string, limit: number = 8): TaxonomyItem[] {
  const clean = query.trim().toLowerCase();
  if (!clean || clean.length < 2) return [];

  const results: TaxonomyItem[] = [];
  const allSets = [
    DB_CATEGORIES.tags,
    DB_CATEGORIES.artists,
    DB_CATEGORIES.characters,
    DB_CATEGORIES.parodies,
    DB_CATEGORIES.groups,
    DB_CATEGORIES.languages,
  ];

  for (const set of allSets) {
    for (const item of set) {
      const name = item.name.toLowerCase();
      if (name === clean) {
        results.unshift(item);
      } else if (name.startsWith(clean)) {
        results.push(item);
      } else if (name.includes(clean) && results.length < limit * 2) {
        results.push(item);
      }
      if (results.length >= limit * 3) break;
    }
  }

  return results.slice(0, limit);
}

/**
 * Formate un élément en opérateur de recherche nHentai officiel
 */
export function formatTagQuery(item: TaxonomyItem): string {
  const type = CATEGORY_META[item.category]?.type || "tag";
  const name = item.name.trim();
  return name.includes(" ") ? `${type}:"${name}"` : `${type}:${name}`;
}

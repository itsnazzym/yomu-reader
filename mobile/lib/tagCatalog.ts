import type { SourceId, SourceTaxonomyItem } from "./sources/types";
import { normalizeTagType, formatSearchTerm } from "./searchQuery";

const compareNames = new Intl.Collator("en", { sensitivity: "base" }).compare;

export const TAG_SOURCE_IDS: SourceId[] = ["nhentai", "3hentai", "doujins", "hitomi", "ehentai", "rule34"];
export type TagSource = SourceId | "all";
export type CatalogCategory = "tags" | "artists" | "parodies" | "characters" | "groups" | "languages" | "categories";
export interface CatalogTag {
  key: string;
  name: string;
  type: string;
  category: CatalogCategory;
  sources: SourceId[];
  nativeNames: Partial<Record<SourceId, string>>;
}
export const categoryForType = (type: string): CatalogCategory => ({ artist: "artists", parody: "parodies", character: "characters", group: "groups", language: "languages", category: "categories" } as Record<string, CatalogCategory>)[type] || "tags";
export function canonicalTagName(name: string): string { return name.normalize("NFKC").trim().replace(/_/g, " ").replace(/\s+/g, " ").toLowerCase(); }
export function catalogTagKey(type: string, name: string): string { return `${normalizeTagType(type)}:${canonicalTagName(name)}`; }
export function isTagSource(value: unknown): value is TagSource { return value === "all" || TAG_SOURCE_IDS.includes(value as SourceId); }

/** Types/namespaces stay distinct; each merged row retains every source and native spelling. */
export function mergeTagCatalogs(catalogs: Partial<Record<SourceId, SourceTaxonomyItem[]>>, selection: TagSource): CatalogTag[] {
  const entries = new Map<string, CatalogTag>();
  for (const source of selection === "all" ? TAG_SOURCE_IDS : [selection]) {
    for (const tag of catalogs[source] || []) {
      if (typeof tag.name !== "string" || !tag.name.trim()) continue;
      const type = normalizeTagType(tag.type || "tag");
      const name = tag.name.trim().replace(/_/g, " ").replace(/\s+/g, " ");
      const key = catalogTagKey(type, name);
      const existing = entries.get(key);
      if (existing) {
        if (!existing.sources.includes(source)) existing.sources.push(source);
        existing.nativeNames[source] = tag.name;
      } else entries.set(key, { key, name, type, category: categoryForType(type), sources: [source], nativeNames: { [source]: tag.name } });
    }
  }
  return [...entries.values()].sort((a, b) => compareNames(a.name, b.name) || compareNames(a.type, b.type));
}

export function tagSearchTarget(tag: CatalogTag, selection: TagSource): { source: TagSource; query: string } {
  const source = selection;
  const name = source === "all" ? tag.name : tag.nativeNames[source] || tag.name;
  return { source, query: source === "rule34" ? name : formatSearchTerm(tag.type, name) };
}

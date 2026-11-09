import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSource } from "./sources/registry";
import { getSourceTags } from "./sourceTaxonomyStore";
import { dedupeTags } from "./sources/tagUtils";
import { TAG_SOURCE_IDS, mergeTagCatalogs, type TagSource } from "./tagCatalog";
import type { SourceId, SourceTaxonomyItem } from "./sources/types";

export interface CatalogState { tags: SourceTaxonomyItem[]; loading: boolean; loaded: boolean; error?: string; page: number; hasMore: boolean }
const emptyState = (): CatalogState => ({ tags: [], loading: false, loaded: false, page: -1, hasMore: false });

export function useTagCatalog(selection: TagSource, authRevision: number) {
  const [states, setStates] = useState<Partial<Record<SourceId, CatalogState>>>({});
  const snapshot = useRef(states);
  const pending = useRef(new Set<SourceId>());
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const patch = useCallback((source: SourceId, update: Partial<CatalogState>) => {
    if (!mounted.current) return;
    const next = { ...snapshot.current, [source]: { ...(snapshot.current[source] || emptyState()), ...update } };
    snapshot.current = next;
    setStates(next);
  }, []);

  const load = useCallback(async (source: SourceId, refresh = false, more = false) => {
    if (pending.current.has(source)) return;
    pending.current.add(source);
    const previous = snapshot.current[source] || emptyState();
    const page = more ? previous.page + 1 : 0;
    patch(source, { loading: true, error: undefined });
    try {
      const adapter = getSource(source);
      const result = adapter.getTagsPage
        ? await adapter.getTagsPage(page)
        : { tags: source === "nhentai" ? await adapter.getTags!() : await getSourceTags(source, () => adapter.getTags!(), { refresh }), hasMore: false };
      const known = new Set(previous.tags.map(tag => `${tag.type || "tag"}:${tag.name}`));
      if (more && result.tags.length && result.tags.every(tag => known.has(`${tag.type || "tag"}:${tag.name}`))) throw new Error("Le serveur ne fournit pas la page suivante. Les tags déjà chargés restent disponibles.");
      patch(source, { tags: more ? dedupeTags([...previous.tags, ...result.tags]) : result.tags, loaded: true, page, hasMore: result.hasMore, loading: false });
    } catch (error) {
      // Never render transport messages that could contain a credentials URL.
      const message = source === "rule34" ? "Connexion Rule34 requise ou répertoire indisponible." : "Répertoire indisponible. Réessayez ou consultez les tags déjà chargés.";
      const repeated = error instanceof Error && error.message.startsWith("Le serveur ne fournit");
      patch(source, { loading: false, loaded: true, ...(repeated ? { hasMore: false } : {}), error: repeated ? error.message : message });
    } finally { pending.current.delete(source); }
  }, [patch]);

  useEffect(() => {
    for (const source of selection === "all" ? TAG_SOURCE_IDS : [selection]) {
      if (!snapshot.current[source]?.loaded) void load(source);
    }
  }, [selection, load]);
  useEffect(() => { if (snapshot.current.rule34?.loaded) void load("rule34", true); }, [authRevision, load]);
  const selected = selection === "all" ? TAG_SOURCE_IDS : [selection];
  const items = useMemo(() => mergeTagCatalogs(Object.fromEntries(Object.entries(states).map(([id, state]) => [id, state?.tags || []])), selection), [states, selection]);
  return { states, items, loading: selected.some(source => states[source]?.loading),
    errors: selected.filter(source => states[source]?.error),
    refresh: () => { for (const source of selected) void load(source, true); },
    retry: (source: SourceId) => { const previous = snapshot.current[source]; void load(source, true, !!previous?.hasMore && previous.page >= 0); },
    loadMore: () => { for (const source of selected) if (states[source]?.hasMore && !states[source]?.error) void load(source, false, true); },
    hasMore: selected.some(source => states[source]?.hasMore && !states[source]?.error),
  };
}

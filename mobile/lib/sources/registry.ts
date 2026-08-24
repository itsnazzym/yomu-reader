/**
 * Registre des sources : point d'entrée unique getSource()/listSources().
 * Les instances sont créées paresseusement et réutilisées (les adaptateurs
 * n'ont pas d'état mutable critique).
 */

import type { SourceAdapter, SourceId, GlobalGalleryId } from "./types";
import type { SourceMeta } from "./types";
export type { SourceMeta };
import { NhentaiSource } from "./nhentai";
import { ThreeHentaiSource } from "./threehentai";
import { DoujinsSource } from "./doujins";
import { HitomiSource } from "./hitomi";

const FACTORIES: Record<SourceId, () => SourceAdapter> = {
  nhentai: () => new NhentaiSource(),
  "3hentai": () => new ThreeHentaiSource(),
  doujins: () => new DoujinsSource(),
  hitomi: () => new HitomiSource(),
};

/** Cache statique des métadonnées (pas d'instanciation nécessaire). */
const METAS: Record<SourceId, SourceMeta> = {
  nhentai: new NhentaiSource().meta,
  "3hentai": new ThreeHentaiSource().meta,
  doujins: new DoujinsSource().meta,
  hitomi: new HitomiSource().meta,
};

const instances = new Map<SourceId, SourceAdapter>();

function normalizeSource(ref: string): SourceId | null {
  return (FACTORIES as Record<string, unknown>)[ref] ? (ref as SourceId) : null;
}

/** Résout une source depuis son id OU depuis un globalId ("3hentai:719690"). */
export function getSource(sourceOrGlobalId: SourceId | GlobalGalleryId): SourceAdapter {
  let source: SourceId;
  if (sourceOrGlobalId.includes(":")) {
    const prefix = sourceOrGlobalId.slice(0, sourceOrGlobalId.indexOf(":"));
    source = normalizeSource(prefix) ?? "nhentai";
  } else {
    source = normalizeSource(sourceOrGlobalId) ?? "nhentai";
  }
  let inst = instances.get(source);
  if (!inst) {
    inst = FACTORIES[source]();
    instances.set(source, inst);
  }
  return inst;
}

export function listSources(): SourceMeta[] {
  return Object.values(METAS);
}

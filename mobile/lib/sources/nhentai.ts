/**
 * Adaptateur nhentai : enveloppe l'API existante (lib/api/nhentai.ts) dans le
 * contrat SourceAdapter sans changer son comportement.
 */

import * as api from "../api/nhentai";
import type { Gallery } from "../api/types";
import { DB_CATEGORIES } from "../taxonomyData";
import {
  makeGlobalId,
  type SourceAdapter,
  type SourceGallery,
  type SourceGalleryCard,
  type SourceMeta,
  type SourceSearchOptions,
} from "./types";
import { probeAdapterHealth } from "./probeHealth";

function toCard(g: Gallery): SourceGalleryCard {
  return {
    globalId: makeGlobalId("nhentai", g.id),
    title: g.title?.pretty || g.title?.english || `Gallery #${g.id}`,
    coverUrl: api.resolveCoverUrl(g.media_id, g.images?.cover),
    numPages: g.num_pages,
    uploadDate: g.upload_date,
    tags: (g.tags || []).map((t) => ({ name: t.name, type: t.type })),
  };
}

function toFull(g: Gallery): SourceGallery {
  const pages = (g.images?.pages || []).map((p, idx) => ({
    url: p.url || api.resolvePageUrl(g.media_id, idx, p),
    width: p.w,
    height: p.h,
  }));
  return {
    globalId: makeGlobalId("nhentai", g.id),
    nativeId: String(g.id),
    title: g.title?.pretty || g.title?.english || `Gallery #${g.id}`,
    coverUrl: api.resolveCoverUrl(g.media_id, g.images?.cover),
    numPages: g.num_pages,
    uploadDate: g.upload_date,
    tags: (g.tags || []).map((t) => ({ name: t.name, type: t.type })),
    pageUrls: pages,
  };
}

export class NhentaiSource implements SourceAdapter {
  meta: SourceMeta = {
    id: "nhentai",
    label: "nHentai",
    baseUrl: "https://nhentai.net",
    accentColor: "#ff0055",
    supportsLogin: true,
    supportsComments: true,
  };

  async search(opts: SourceSearchOptions) {
    const sort = (opts.sort as Parameters<typeof api.searchGalleries>[2]) || "recent";
    const res = await api.searchGalleries(opts.query || "", opts.page || 1, sort);
    const galleries = res.result || [];
    return { cards: galleries.map(toCard), hasMore: galleries.length >= 20 };
  }

  async getGallery(nativeId: string): Promise<SourceGallery> {
    return toFull(await api.getGallery(Number(nativeId)));
  }

  async getRandomNativeId(): Promise<string> {
    const g = await api.getRandomGallery();
    return String(g.id);
  }

  /** DB statique embarquée (données réelles nhentai, zéro réseau). */
  async getTags() {
    return (DB_CATEGORIES.tags || []).map((t) => ({
      name: t.name,
      count: t.count,
    }));
  }

  async healthCheck() {
    return probeAdapterHealth(this);
  }
}

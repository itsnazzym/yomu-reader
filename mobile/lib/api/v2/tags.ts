/**
 * nhentai API v2 — Tags
 *
 * GET  /api/v2/tags/:type          Paginated list of tags by type
 * GET  /api/v2/tags/:type/:slug    Single tag by slug
 * POST /api/v2/tags/autocomplete   Search tags (for autocomplete UI)
 */

import { nhApi, buildQuery } from "./client";
import type { Tag, TagType, Paginated } from "./types";

export interface GetTagsParams {
  sort?: "name" | "popular";
  page?: number;
  per_page?: number;
}

export async function getTagsByType(
  tagType: TagType | string,
  params: GetTagsParams = {}
): Promise<Paginated<Tag>> {
  return nhApi.get(`/tags/${tagType}${buildQuery(params)}`, { public: true });
}

export async function getTagBySlug(
  tagType: TagType | string,
  slug: string
): Promise<Tag> {
  return nhApi.get(`/tags/${tagType}/${slug}`, { public: true });
}

export interface AutocompleteParams {
  query: string;
  type?: TagType | string;
  limit?: number;
}

export async function autocompleteTags(
  params: AutocompleteParams
): Promise<Tag[]> {
  return nhApi.post(
    "/tags/autocomplete",
    {
      query: params.query,
      type: params.type,
      limit: params.limit ?? 15,
    },
    { public: true }
  );
}

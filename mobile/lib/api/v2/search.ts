/**
 * nhentai API v2 — Search
 *
 * GET /api/v2/search
 */

import { nhApi, buildQuery } from "./client";
import { getGalleries } from "./galleries";
import type { GalleryCard, Paginated, SortOrder } from "./types";

export interface SearchParams {
  query: string;
  sort?: SortOrder | string;
  page?: number;
  per_page?: number;
}

const BROWSE_MATCH_ALL = "*";

export async function searchGalleries(
  params: SearchParams
): Promise<Paginated<GalleryCard>> {
  const q = (params.query ?? "").trim();
  const sort = params.sort ?? "date";
  const page = params.page ?? 1;
  const per_page = params.per_page;

  if (!q) {
    if (sort === "date" || sort === "recent") {
      return getGalleries({ page, per_page });
    }
    return nhApi.get(
      `/search${buildQuery({
        query: BROWSE_MATCH_ALL,
        sort,
        page,
        ...(per_page != null ? { per_page } : {}),
      })}`
    );
  }

  return nhApi.get(
    `/search${buildQuery({
      query: q,
      sort,
      page,
      ...(per_page != null ? { per_page } : {}),
    })}`
  );
}

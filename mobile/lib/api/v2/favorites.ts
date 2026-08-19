/**
 * nhentai API v2 — Favorites
 *
 * GET /api/v2/favorites          Authenticated user's favorites
 * GET /api/v2/favorites/random   Random gallery ID from favorites
 */

import { nhApi, buildQuery } from "./client";
import type { GalleryCard, Paginated } from "./types";

export interface FavoritesParams {
  q?: string;
  page?: number;
  per_page?: number;
}

export async function getFavorites(
  params: FavoritesParams = {}
): Promise<Paginated<GalleryCard>> {
  return nhApi.get(`/favorites${buildQuery(params)}`);
}

export async function getRandomFavoriteId(): Promise<number> {
  const res = await nhApi.get<Record<string, unknown>>("/favorites/random");
  return (res as any).id as number;
}

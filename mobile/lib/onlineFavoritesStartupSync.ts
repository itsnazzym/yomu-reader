/**
 * Startup sync for official nHentai online favorites (API v2).
 */
import { getFavorites as fetchV2Favorites } from "./api/v2/favorites";
import { ApiError, getAuthStorageReady, hasSession } from "./api/v2/client";
import { resolveThumbUrl } from "./api/v2/config";
import type { GalleryCard } from "./api/v2/types";
import { importFavorites } from "./favoritesStore";
import type { Gallery } from "./api/types";

const PER_PAGE = 100;
const MIN_PAGE_INTERVAL_MS = 5_000;
const MAX_PAGE_ATTEMPTS = 6;
let syncRunning = false;

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function formatWait(milliseconds: number): string {
  const seconds = Math.max(1, Math.ceil(milliseconds / 1000));
  return seconds >= 60
    ? `${Math.ceil(seconds / 60)} min`
    : `${seconds} s`;
}

function isRetryablePageError(error: unknown): boolean {
  if (!(error instanceof ApiError)) return true;
  return error.status === 429 || error.status >= 500;
}

function getPageRetryDelay(error: unknown, attempt: number): number {
  if (error instanceof ApiError && error.status === 429) {
    return Math.max(30_000, error.retryAfterMs ?? 60_000);
  }
  return Math.min(30_000, 3_000 * 2 ** Math.max(0, attempt - 1));
}

function cardToGallery(c: GalleryCard): Gallery {
  const thumbUrl = resolveThumbUrl(c.thumbnail);
  return {
    id: c.id,
    media_id: c.media_id || String(c.id),
    title: {
      english: c.english_title || "",
      japanese: c.japanese_title || "",
      pretty: c.english_title || c.japanese_title || `Gallery #${c.id}`,
    },
    images: {
      cover: {
        t: "j",
        w: c.thumbnail_width || 250,
        h: c.thumbnail_height || 350,
        url: thumbUrl,
        urlThumb: thumbUrl,
      },
      thumbnail: {
        t: "j",
        w: c.thumbnail_width || 250,
        h: c.thumbnail_height || 350,
        url: thumbUrl,
        urlThumb: thumbUrl,
      },
      pages: [],
    },
    scanlator: c.scanlator || "",
    upload_date: c.upload_date || Math.floor(Date.now() / 1000),
    tags: [],
    tag_ids: c.tag_ids || [],
    num_pages: c.num_pages || 0,
    num_favorites: c.num_favorites || 0,
    source: "cloud",
  };
}

export async function syncOnlineFavoritesFullOnLaunch(
  onProgress?: (msg: string, current: number, total: number) => void
): Promise<{ success: boolean; count: number; error?: string; partial?: boolean }> {
  if (syncRunning) {
    return { success: false, count: 0, error: "Synchronisation déjà en cours" };
  }
  syncRunning = true;
  try {
    await getAuthStorageReady();
    if (!(await hasSession())) return { success: false, count: 0, error: "Non connecté" };

    let page = 1;
    let numPages = 0;
    let total = 0;
    let partialError: string | undefined;
    let pageSize = PER_PAGE;
    let requestedPageSize = PER_PAGE;
    let lastPageRequestAt = 0;
    const collectedById = new Map<number, Gallery>();

    const fetchPage = async (pageNumber: number) => {
      for (let attempt = 1; attempt <= MAX_PAGE_ATTEMPTS; attempt += 1) {
        const waitForSlot = MIN_PAGE_INTERVAL_MS - (Date.now() - lastPageRequestAt);
        if (waitForSlot > 0) {
          await sleep(waitForSlot);
        }

        lastPageRequestAt = Date.now();
        try {
          return await fetchV2Favorites({
            page: pageNumber,
            per_page: requestedPageSize,
          });
        } catch (pageError) {
          if (
            requestedPageSize !== 25 &&
            pageError instanceof ApiError &&
            (pageError.status === 400 || pageError.status === 422)
          ) {
            // Some API deployments keep the historical 25-item limit and
            // reject a larger per_page instead of clamping it.
            requestedPageSize = 25;
            continue;
          }

          if (attempt >= MAX_PAGE_ATTEMPTS || !isRetryablePageError(pageError)) {
            throw pageError;
          }

          const retryDelay = getPageRetryDelay(pageError, attempt);
          const statusSuffix =
            pageError instanceof ApiError && pageError.status === 429
              ? " (limite de requêtes)"
              : "";
          onProgress?.(
            `Page ${pageNumber} temporairement indisponible${statusSuffix} · nouvelle tentative dans ${formatWait(retryDelay)}…`,
            pageNumber,
            numPages
          );
          await sleep(retryDelay);
        }
      }

      throw new Error(`Échec de la page ${pageNumber}`);
    };

    for (;;) {
      onProgress?.(
        `Chargement page ${page}${numPages > 0 ? `/${numPages}` : ""}…`,
        page,
        numPages
      );
      let res;
      try {
        res = await fetchPage(page);
      } catch (pageErr: any) {
        console.warn(`[onlineFavorites] error on page ${page}:`, pageErr?.message);
        // If we already collected some favorites, don't fail completely
        if (collectedById.size > 0) {
          partialError = pageErr?.message || `Échec de la page ${page}`;
          break;
        }
        throw pageErr;
      }

      const responseTotal = Number(res?.total);
      if (Number.isFinite(responseTotal) && responseTotal > 0) {
        total = responseTotal;
      }

      const responsePageSize = Number(res?.per_page);
      const hasResponsePageSize =
        Number.isFinite(responsePageSize) && responsePageSize > 0;
      if (hasResponsePageSize) {
        pageSize = responsePageSize;
      }

      const responsePageCount = Number(res?.num_pages);
      if (Number.isFinite(responsePageCount) && responsePageCount > 0) {
        numPages = Math.max(numPages, responsePageCount);
      }
      if (total > 0) {
        numPages = Math.max(numPages, Math.ceil(total / pageSize));
      }

      const result = Array.isArray(res?.result) ? res.result : [];
      if (!hasResponsePageSize && result.length > 0) {
        // If the server omits per_page, the first non-empty page is the best
        // available indication of the effective page size.
        pageSize = result.length;
        if (total > 0) {
          numPages = Math.max(numPages, Math.ceil(total / pageSize));
        }
      }
      const beforeCount = collectedById.size;

      for (const card of result) {
        const id = Number(card?.id);
        if (Number.isFinite(id) && id > 0) {
          collectedById.set(id, cardToGallery({ ...card, id }));
        }
      }

      const collectedCount = collectedById.size;
      const progressTotal = numPages || (total > 0 ? Math.ceil(total / pageSize) : 0);
      onProgress?.(
        `Page ${page}${progressTotal > 0 ? `/${progressTotal}` : ""} · ${collectedCount.toLocaleString("fr-FR")} favoris`,
        page,
        progressTotal
      );

      const reachedTotal = total > 0 && collectedCount >= total;
      const reachedPageCount =
        total <= 0 && numPages > 0 && page >= numPages;
      const stoppedBeforeTotal =
        result.length === 0 && total > 0 && collectedCount < total;
      if (stoppedBeforeTotal) {
        partialError =
          `La page ${page} est vide alors que ${total - collectedCount} favoris restent à récupérer`;
      }
      if (result.length === 0 || reachedTotal || reachedPageCount) {
        break;
      }
      if (beforeCount === collectedCount) {
        if (progressTotal > page) {
          page += 1;
          continue;
        }
        partialError =
          `La page ${page} ne contient aucun nouveau favori ; la suite n'a pas pu être récupérée`;
        break;
      }

      page += 1;
    }

    const collected = [...collectedById.values()];
    if (collected.length > 0) {
      await importFavorites(collected);
    }

    if (partialError) {
      return {
        success: false,
        count: collected.length,
        partial: true,
        error: `${collected.length} favoris importés, mais la synchronisation est incomplète : ${partialError}`,
      };
    }
    return { success: true, count: collected.length };
  } catch (e: any) {
    console.warn("[onlineFavorites] sync error:", e);
    return { success: false, count: 0, error: e?.message || "Erreur de synchronisation" };
  } finally {
    syncRunning = false;
  }
}

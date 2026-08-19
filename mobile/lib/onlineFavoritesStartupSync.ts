/**
 * Startup sync for official nHentai online favorites (API v2).
 */
import { getFavorites as fetchV2Favorites } from "./api/v2/favorites";
import { getAuthStorageReady, hasSession } from "./api/v2/client";
import { resolveThumbUrl } from "./api/v2/config";
import type { GalleryCard } from "./api/v2/types";
import { importFavorites } from "./favoritesStore";
import type { Gallery } from "./api/types";

const PER_PAGE = 25;
let syncRunning = false;

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
): Promise<{ success: boolean; count: number; error?: string }> {
  if (syncRunning) return { success: true, count: 0 };
  syncRunning = true;
  try {
    await getAuthStorageReady();
    if (!(await hasSession())) return { success: false, count: 0, error: "Non connecté" };

    const collected: Gallery[] = [];
    let page = 1;
    let numPages = 1;
    let total = 0;

    for (;;) {
      onProgress?.(`Chargement page ${page}...`, page, numPages);
      let res;
      try {
        res = await fetchV2Favorites({ page, per_page: PER_PAGE });
      } catch (pageErr: any) {
        console.warn(`[onlineFavorites] error on page ${page}:`, pageErr?.message);
        // If we already collected some favorites, don't fail completely
        if (collected.length > 0) {
          break;
        }
        throw pageErr;
      }

      total = res?.total ?? 0;
      numPages = Math.max(1, res?.num_pages ?? 1);

      for (const card of res?.result ?? []) {
        if (typeof card?.id === "number" && Number.isFinite(card.id)) {
          collected.push(cardToGallery(card));
        }
      }

      if (collected.length >= total || page >= numPages || !res?.result?.length) {
        break;
      }

      page += 1;
      await new Promise((r) => setTimeout(r, 250));
    }

    if (collected.length > 0) {
      await importFavorites(collected);
    }

    return { success: true, count: collected.length };
  } catch (e: any) {
    console.warn("[onlineFavorites] sync error:", e);
    return { success: false, count: 0, error: e?.message || "Erreur de synchronisation" };
  } finally {
    syncRunning = false;
  }
}

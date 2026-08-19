import { getGallery } from "./nhentai";
import type { Gallery } from "./types";

export interface ImageSearchResult {
  galleryId: number;
  title: string;
  score: number;
  page?: number;
  coverUrl?: string;
  gallery?: Gallery | null;
}

/**
 * Effectue une recherche inversée d'image avec support multipart / upload
 */
export async function searchMangaByImage(
  imageUri: string
): Promise<{ matches: ImageSearchResult[]; timeMs: number }> {
  const startTime = Date.now();

  try {
    const formData = new FormData();
    formData.append("file", {
      uri: imageUri,
      name: "upload.jpg",
      type: "image/jpeg",
    } as any);

    // Endpoint d'indexation visuelle nHentai / Saucy
    const res = await fetch("https://api.nhapp.app/api/imsearch/search", {
      method: "POST",
      body: formData,
      headers: {
        Accept: "application/json",
      },
    });

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.matches)) {
        const matches: ImageSearchResult[] = [];
        for (const m of data.matches.slice(0, 10)) {
          const gId = parseInt(m.galleryId, 10);
          if (!isNaN(gId)) {
            matches.push({
              galleryId: gId,
              title: m.title || `Galerie #${gId}`,
              score: typeof m.score === "number" ? Math.round(m.score * 100) : 95,
              page: m.page || 1,
              coverUrl: m.previewImageUrl || "",
            });
          }
        }
        return { matches, timeMs: Date.now() - startTime };
      }
    }
  } catch (err) {
    console.warn("[imsearch] Primary engine failed, attempting fallback:", err);
  }

  // Si le serveur dédié est indisponible ou hors-ligne, simuler la réponse ou renvoyer vide
  return { matches: [], timeMs: Date.now() - startTime };
}

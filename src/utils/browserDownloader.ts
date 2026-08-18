import { Gallery, DownloadFormat, DownloadProgressPayload } from "../types";
import {
  getGallery,
  saveDownloadedArchive,
  fetchImageData,
  cleanCdnPath,
  logToTerminal,
  isElectron,
} from "./ipc";

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000; // 32KB chunks for blazing fast conversion
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return window.btoa(binary);
}

async function fetchPageBuffer(
  candidateUrls: string[],
  referer?: string,
  cookies?: string,
  apiKey?: string,
  abortSignal?: AbortSignal
): Promise<{ bufferBase64: string; ext: string; size: number }> {
  // 1. Direct Node.js IPC Stream in Electron (Ultra-Fast, Connection Pooling, Zero CORS)
  if (isElectron()) {
    for (const url of candidateUrls) {
      if (abortSignal?.aborted) throw new Error("ABORTED");
      try {
        const dataUrl = await fetchImageData(url, referer, cookies, apiKey);
        if (dataUrl && dataUrl.startsWith("data:")) {
          const commaIdx = dataUrl.indexOf(",");
          const base64 = dataUrl.substring(commaIdx + 1);
          const mime = dataUrl.substring(5, commaIdx).split(";")[0];
          const ext = mime.includes("png") ? "png" : mime.includes("jpeg") || mime.includes("jpg") ? "jpg" : "webp";
          return {
            bufferBase64: base64,
            ext,
            size: Math.round((base64.length * 3) / 4),
          };
        }
      } catch (e: any) {
        if (abortSignal?.aborted) throw new Error("ABORTED");
      }
    }
  }

  // 2. Browser Direct Fetch with fast 3s per-url timeout
  for (const url of candidateUrls) {
    if (abortSignal?.aborted) throw new Error("ABORTED");

    try {
      const controller = new AbortController();
      const onAbort = () => controller.abort();
      if (abortSignal) abortSignal.addEventListener("abort", onAbort, { once: true });

      const timeoutId = setTimeout(() => controller.abort(), 3000);

      try {
        const resp = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (resp.ok) {
          const ab = await resp.arrayBuffer();
          if (ab.byteLength > 500) {
            const ext = url.endsWith(".png") ? "png" : url.endsWith(".jpg") || url.endsWith(".jpeg") ? "jpg" : "webp";
            return {
              bufferBase64: arrayBufferToBase64(ab),
              ext,
              size: ab.byteLength,
            };
          }
        }
      } finally {
        clearTimeout(timeoutId);
        if (abortSignal) abortSignal.removeEventListener("abort", onAbort);
      }
    } catch (e: any) {
      if (abortSignal?.aborted) throw new Error("ABORTED");
    }
  }

  throw new Error(`Échec de récupération de la page (sources inaccessibles)`);
}

export async function executeHighSpeedDownload(params: {
  gallery: Gallery;
  formatType: DownloadFormat;
  pattern: string;
  destDir: string;
  cookies?: string;
  apiKey?: string;
  abortSignal?: AbortSignal;
  onProgress: (payload: DownloadProgressPayload) => void;
}): Promise<string> {
  const { gallery, formatType, pattern, destDir, cookies, apiKey, abortSignal, onProgress } = params;

  // 1. Fetch full gallery details if tags or full pages are missing
  let fullGallery = gallery;
  const hasFullPages = fullGallery.images?.pages && fullGallery.images.pages.length > 1;
  const hasMediaId = !!fullGallery.media_id;

  if (!hasFullPages || !hasMediaId) {
    try {
      fullGallery = await getGallery(gallery.id, cookies, apiKey);
    } catch (e) {
      console.warn("Could not fetch full gallery details, using current metadata:", e);
    }
  }

  const rawPages = fullGallery.images?.pages || [];
  const totalPages = rawPages.length || fullGallery.num_pages || 1;
  const mediaId = String(fullGallery.media_id || fullGallery.id);
  const displayTitle = fullGallery.title?.pretty || fullGallery.title?.english || `Galerie #${fullGallery.id}`;

  await logToTerminal(`[🚀 DÉBUT TÉLÉCHARGEMENT] #${fullGallery.id} "${displayTitle}" (${totalPages} planches, Format: ${formatType.toUpperCase()})`);

  const startTime = Date.now();
  let totalBytes = 0;
  let completedPages = 0;

  const pagesData: Array<{ pageNum: number; ext: string; bufferBase64: string }> = new Array(totalPages);

  onProgress({
    id: fullGallery.id,
    downloaded_pages: 0,
    total_pages: totalPages,
    progress: 0,
    speed_kb_s: 0,
    status: "downloading",
  });

  const concurrency = Math.min(6, totalPages);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < totalPages) {
      if (abortSignal?.aborted) throw new Error("ABORTED");
      const i = nextIndex++;
      const pageNum = i + 1;
      const pInfo = rawPages[i] || {};
      const rawPath = cleanCdnPath(pInfo.path);
      // Prioritize Direct Gigabit CDN mirrors (8000-15000 KB/s) with Photon Edge fallback
      const mirrors = ["i3", "i2", "i1", "i4", "t3", "t2", "t1", "t4"];
      const candidateUrls: string[] = [];
      if (rawPath) {
        for (const m of mirrors) {
          candidateUrls.push(`https://${m}.nhentai.net/${rawPath}`);
        }
      }
      for (const m of mirrors) {
        for (const e of ["webp", "jpg", "png", "gif"]) {
          const u = `https://${m}.nhentai.net/galleries/${mediaId}/${pageNum}.${e}`;
          if (!candidateUrls.includes(u)) candidateUrls.push(u);
        }
      }
      // Edge mirror fallbacks
      candidateUrls.push(`https://i0.wp.com/i3.nhentai.net/galleries/${mediaId}/${pageNum}.webp`);
      candidateUrls.push(`https://i1.wp.com/i2.nhentai.net/galleries/${mediaId}/${pageNum}.webp`);
      candidateUrls.push(`https://external-content.duckduckgo.com/iu/?u=https://i3.nhentai.net/galleries/${mediaId}/${pageNum}.webp`);

      const pageRes = await fetchPageBuffer(
        candidateUrls,
        `https://nhentai.net/g/${fullGallery.id}/${pageNum}/`,
        cookies,
        apiKey,
        abortSignal
      );

      pagesData[i] = {
        pageNum,
        ext: pageRes.ext,
        bufferBase64: pageRes.bufferBase64,
      };

      completedPages++;
      totalBytes += pageRes.size;

      const elapsedSec = Math.max(0.1, (Date.now() - startTime) / 1000);
      const speedKbS = Math.round(totalBytes / 1024 / elapsedSec);

      // Log milestone in terminal every 25% or every 6 pages
      if (completedPages === totalPages || completedPages % Math.max(6, Math.floor(totalPages / 4)) === 0) {
        const remainingPages = totalPages - completedPages;
        const avgPageBytes = totalBytes / completedPages;
        const etaSec = speedKbS > 0 ? Math.ceil((remainingPages * avgPageBytes) / 1024 / speedKbS) : 0;
        await logToTerminal(`[⬇️ PROGRESSION #${fullGallery.id}] ${completedPages}/${totalPages} planches (${Math.round((completedPages / totalPages) * 100)}%) - ${speedKbS} KB/s (ETA: ~${etaSec}s)`);
      }

      onProgress({
        id: fullGallery.id,
        downloaded_pages: completedPages,
        total_pages: totalPages,
        progress: completedPages / totalPages,
        speed_kb_s: speedKbS,
        status: "downloading",
      });
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);

  if (abortSignal?.aborted) throw new Error("ABORTED");

  // 2. Save and package into archive
  await logToTerminal(`[📦 EMPAQUETAGE #${fullGallery.id}] Création de l'archive ${formatType.toUpperCase()} (${totalPages} planches)...`);

  let targetPath = "";
  if (isElectron()) {
    targetPath = await saveDownloadedArchive({
      gallery: fullGallery,
      formatType,
      pattern,
      destDir,
      pagesData,
    });
  }

  const totalElapsedSec = Math.max(0.1, (Date.now() - startTime) / 1000);
  const finalSpeedKbS = Math.round(totalBytes / 1024 / totalElapsedSec);
  await logToTerminal(`[🎉 TÉLÉCHARGEMENT TERMINÉ] #${fullGallery.id} en ${totalElapsedSec.toFixed(1)}s (Taille: ${(totalBytes / 1024 / 1024).toFixed(1)} Mo, Vitesse moy: ${finalSpeedKbS} KB/s)`);

  onProgress({
    id: fullGallery.id,
    downloaded_pages: totalPages,
    total_pages: totalPages,
    progress: 1,
    speed_kb_s: finalSpeedKbS,
    status: "completed",
    target_path: targetPath,
  });

  return targetPath;
}

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system";
import { getGallery, resolvePageUrl } from "./api/nhentai";
import { Gallery } from "./api/types";
import { makeLocalId, sanitizeTitle, writeLocalManifest } from "./localLibrary";

const QUEUE_KEY = "@nhentai_download_queue";
const CONCURRENCY_KEY = "@nhentai_download_concurrency";

export type QueueItemStatus = "queued" | "downloading" | "completed" | "error" | "paused";

export interface QueueItem {
  id: number;
  title: string;
  cover: string;
  status: QueueItemStatus;
  progress: number;
  totalPages: number;
  downloadedPages: number;
  errorMessage?: string;
  /** Identifiant local (dossier NHAppAndroid/<localId>/), défini à la complétion. */
  localId?: string;
  addedAt: number;
}

export interface QueueState {
  items: QueueItem[];
  maxConcurrent: number;
  isProcessing: boolean;
}

let state: QueueState = {
  items: [],
  maxConcurrent: 2,
  isProcessing: false,
};

const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

async function persistQueue() {
  try {
    const toSave = state.items.map((i) => ({
      ...i,
      status: i.status === "downloading" ? ("queued" as QueueItemStatus) : i.status,
    }));
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(toSave));
  } catch (err) {
    console.warn("[downloadQueue] Error saving queue:", err);
  }
}

export async function initDownloadQueue() {
  try {
    const rawConc = await AsyncStorage.getItem(CONCURRENCY_KEY);
    if (rawConc) {
      const parsed = parseInt(rawConc, 10);
      if (!isNaN(parsed) && parsed >= 1 && parsed <= 8) {
        state.maxConcurrent = parsed;
      }
    }
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (raw) {
      const parsed: QueueItem[] = JSON.parse(raw);
      state.items = parsed.map((item) => ({
        ...item,
        status: item.status === "downloading" ? "queued" : item.status,
      }));
      notify();
    }
    // Reprise automatique : les items en attente (queued, ou downloading
    // ramenés à queued par le chargement) reprennent dès le démarrage.
    processQueue();
  } catch (e) {
    console.warn("[downloadQueue] Error loading queue:", e);
  }
}

export function subscribeDownloadQueue(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// useSyncExternalStore compare les snapshots par référence (Object.is).
// Comme `state` est muté en place, il faut renvoyer une NOUVELLE référence
// à chaque changement, sinon les écrans abonnés ne se re-rendent jamais.
let lastSnapshot: QueueState | null = null;
export function getDownloadQueueSnapshot(): QueueState {
  if (
    !lastSnapshot ||
    lastSnapshot.items !== state.items ||
    lastSnapshot.maxConcurrent !== state.maxConcurrent ||
    lastSnapshot.isProcessing !== state.isProcessing
  ) {
    lastSnapshot = { ...state, items: state.items };
  }
  return lastSnapshot;
}

export function setMaxConcurrent(val: number) {
  const bounded = Math.max(1, Math.min(8, val));
  state.maxConcurrent = bounded;
  AsyncStorage.setItem(CONCURRENCY_KEY, String(bounded)).catch(() => {});
  notify();
  processQueue();
}

export function enqueueGalleries(
  galleries: Array<{ id: number; title: string; cover?: string }>
) {
  const existingIds = new Set(state.items.map((i) => i.id));
  const newItems: QueueItem[] = [];

  for (const g of galleries) {
    if (existingIds.has(g.id)) continue;
    newItems.push({
      id: g.id,
      title: g.title || `Gallery #${g.id}`,
      cover: g.cover || "",
      status: "queued",
      progress: 0,
      totalPages: 0,
      downloadedPages: 0,
      addedAt: Date.now(),
    });
    existingIds.add(g.id);
  }

  if (newItems.length > 0) {
    state.items = [...state.items, ...newItems];
    persistQueue();
    notify();
    processQueue();
  }
}

export function pauseQueueItem(id: number) {
  state.items = state.items.map((item) =>
    item.id === id && (item.status === "queued" || item.status === "downloading")
      ? { ...item, status: "paused" }
      : item
  );
  persistQueue();
  notify();
}

export function resumeQueueItem(id: number) {
  state.items = state.items.map((item) =>
    item.id === id && (item.status === "paused" || item.status === "error")
      ? { ...item, status: "queued", errorMessage: undefined }
      : item
  );
  persistQueue();
  notify();
  processQueue();
}

export function removeQueueItem(id: number) {
  state.items = state.items.filter((item) => item.id !== id);
  persistQueue();
  notify();
}

/**
 * Re-télécharge un item terminé (réparation) : le remet en file en réinitialisant
 * son état local. Le localId est effacé — il peut pointer vers un dossier perdu —
 * et sera re-dérivé par le worker (makeLocalId est déterministe). Les fichiers
 * encore présents sont sautés par le worker, donc seuls les manquants repartent.
 */
export function requeueItem(id: number) {
  state.items = state.items.map((item) =>
    item.id === id && item.status === "completed"
      ? {
          ...item,
          status: "queued" as const,
          localId: undefined,
          progress: 0,
          downloadedPages: 0,
          totalPages: 0,
        }
      : item
  );
  persistQueue();
  notify();
  processQueue();
}

export function clearCompletedQueue() {
  state.items = state.items.filter((item) => item.status !== "completed");
  persistQueue();
  notify();
}

export function pauseAllQueue() {
  state.items = state.items.map((item) =>
    item.status === "queued" || item.status === "downloading"
      ? { ...item, status: "paused" }
      : item
  );
  persistQueue();
  notify();
}

export function resumeAllQueue() {
  state.items = state.items.map((item) =>
    item.status === "paused" || item.status === "error"
      ? { ...item, status: "queued", errorMessage: undefined }
      : item
  );
  persistQueue();
  notify();
  processQueue();
}

const activeWorkers = new Set<number>();

/**
 * Extension du fichier déduite de l'URL (y compris les URLs du proxy miroir,
 * où l'extension réelle est dans le paramètre u=). Priorité à l'URL, sinon le
 * type t de la page (j/p/w/g).
 */
function detectPageExt(pageUrl: string, t?: string): string {
  const direct = pageUrl.match(/\.(jpg|jpeg|png|webp|gif)(?:[?#]|$)/i);
  if (direct) return direct[1].toLowerCase() === "jpeg" ? "jpg" : direct[1].toLowerCase();
  const um = pageUrl.match(/[?&]u=([^&]+)/);
  if (um) {
    try {
      const decoded = decodeURIComponent(um[1]);
      const m = decoded.match(/\.(jpg|jpeg|png|webp|gif)(?:[?#]|$)/i);
      if (m) return m[1].toLowerCase() === "jpeg" ? "jpg" : m[1].toLowerCase();
    } catch {}
  }
  if (t === "p") return "png";
  if (t === "w") return "webp";
  return "jpg";
}

async function downloadSingleGalleryWorker(item: QueueItem): Promise<void> {
  try {
    const gallery: Gallery = await getGallery(item.id);
    const rawTitle = gallery.title.pretty || gallery.title.english;
    const localId = makeLocalId(gallery.id, rawTitle); // identité stable = dossier
    const baseDir = `${FileSystem.documentDirectory}NHAppAndroid/`;
    const targetDir = `${baseDir}${localId}/`;

    await FileSystem.makeDirectoryAsync(targetDir, { intermediates: true });

    const total = gallery.images?.pages?.length || gallery.num_pages || 0;
    const pagesCopy = [...(gallery.images?.pages || [])];

    updateItem(item.id, {
      totalPages: total,
      cover: gallery.images?.cover?.url || item.cover,
      title: gallery.title.pretty || item.title,
    });

    for (let i = 0; i < total; i++) {
      const cur = state.items.find((x) => x.id === item.id);
      if (!cur || cur.status === "paused") {
        throw new Error("__PAUSED__");
      }

      const p = pagesCopy[i];
      const pageNum = (i + 1).toString().padStart(3, "0");
      const pageUrl = p?.url || resolvePageUrl(gallery.media_id, i, p);
      const ext = detectPageExt(pageUrl, p?.t);
      const fileUri = `${targetDir}Image${pageNum}.${ext}`;


      const exists = (await FileSystem.getInfoAsync(fileUri)).exists;
      if (!exists && pageUrl) {
        const downloadRes = FileSystem.createDownloadResumable(pageUrl, fileUri, {
          headers: {
            Referer: "https://nhentai.net/",
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
          },
        });
        await downloadRes.downloadAsync();
      }

      pagesCopy[i] = {
        ...p,
        url: fileUri,
        urlThumb: fileUri,
      };

      updateItem(item.id, {
        downloadedPages: i + 1,
        progress: (i + 1) / total,
      });
    }

    const metaUri = `${targetDir}metadata.json`;
    await FileSystem.writeAsStringAsync(
      metaUri,
      JSON.stringify({
        ...gallery,
        images: {
          ...gallery.images,
          pages: pagesCopy,
        },
      }),
      { encoding: FileSystem.EncodingType.UTF8 }
    );

    // Manifeste versionné : identité stable + statut, sans dupliquer les pages
    // (non bloquant — les anciennes galeries sont dérivées de metadata.json).
    try {
      await writeLocalManifest({
        localId,
        galleryId: gallery.id,
        title: sanitizeTitle(rawTitle),
        status: "complete",
      });
    } catch (err) {
      console.warn("[downloadQueue] manifest write failed:", err);
    }

    updateItem(item.id, {
      status: "completed",
      progress: 1,
      downloadedPages: total,
      localId,
    });
  } catch (err: any) {
    if (err?.message === "__PAUSED__") {
      updateItem(item.id, { status: "paused" });
    } else {
      console.error(`[downloadQueue] Failed gallery ${item.id}:`, err);
      updateItem(item.id, {
        status: "error",
        errorMessage: err?.message || "Échec du téléchargement",
      });
    }
  } finally {
    activeWorkers.delete(item.id);
    persistQueue();
    notify();
    processQueue();
  }
}

function updateItem(id: number, patch: Partial<QueueItem>) {
  state.items = state.items.map((it) => (it.id === id ? { ...it, ...patch } : it));
  notify();
}

export function processQueue() {
  if (activeWorkers.size >= state.maxConcurrent) return;

  const slots = state.maxConcurrent - activeWorkers.size;
  const nextItems = state.items.filter(
    (it) => it.status === "queued" && !activeWorkers.has(it.id)
  );

  for (let i = 0; i < Math.min(slots, nextItems.length); i++) {
    const item = nextItems[i];
    activeWorkers.add(item.id);
    updateItem(item.id, { status: "downloading" });
    downloadSingleGalleryWorker(item);
  }
}

initDownloadQueue();

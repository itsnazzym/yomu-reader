import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import { getGallery, resolvePageUrl } from "./api/nhentai";
import { Gallery } from "./api/types";
import { ensureNoMediaFile, libraryRoot, makeLocalId, sanitizeTitle, writeLocalManifest } from "./localLibrary";
import { decodeBase64Header, isCompleteDownload } from "./imageIntegrity";
import { createInitOnce, createWriteQueue } from "./persistQueue";
import { getDownloadSettings } from "./downloadSettingsStore";
import { copyLocalGalleryToSaf } from "./safCopy";
import { requestNotificationPermissions } from "./permissions";
import { notifyDownloadFinished } from "./downloadNotifications";
import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import {
  computeResumeOffset,
  classifyResumeResponse,
} from "./resumableDownload";
import {
  startDownloadForeground,
  updateDownloadForeground,
  stopDownloadForeground,
} from "./foregroundDownloadService";

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
const writes = createWriteQueue();

function notify() {
  for (const l of listeners) l();
}

function persistQueue(): Promise<void> {
  const toSave = state.items.map((i) => ({
    ...i,
    status: i.status === "downloading" ? ("queued" as QueueItemStatus) : i.status,
  }));
  const serialized = JSON.stringify(toSave);
  return writes.enqueue(() => AsyncStorage.setItem(QUEUE_KEY, serialized));
}

async function loadDownloadQueue() {
  await writes.flush();
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
    processQueue();
  } catch (e) {
    console.warn("[downloadQueue] Error loading queue:", e);
  }
}

export const initDownloadQueue = createInitOnce(loadDownloadQueue);

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

let notificationAsked = false;

export function enqueueGalleries(
  galleries: { id: number; title: string; cover?: string }[]
) {
  if (!notificationAsked) {
    notificationAsked = true;
    void requestNotificationPermissions();
  }
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
  // Annule d'abord tout transfert en vol : le .part déjà écrit est conservé,
  // la reprise se fera par HTTP Range. Le worker verra `null` en retour de
  // downloadAsync et lèvera __PAUSED__ via la vérification de statut.
  const inFlight = activeDownloads.get(id);
  if (inFlight) {
    activeDownloads.delete(id);
    void inFlight.cancelAsync().catch(() => {});
  }
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
  // Si un transfert est en vol, l'annuler immédiatement (le .part sera
  // nettoyé par la boucle du worker via sa vérification de statut).
  const inFlight = activeDownloads.get(id);
  if (inFlight) {
    activeDownloads.delete(id);
    void inFlight.cancelAsync().catch(() => {});
  }
  state.items = state.items.filter((item) => item.id !== id);
  persistQueue();
  notify();
}

/**
 * Après suppression disque : retire les items **completed** dont le localId
 * correspond. Les files queued/downloading/error/paused restent intactes.
 */
export function removeCompletedByLocalId(localId: string | string[]): void {
  const ids = new Set(Array.isArray(localId) ? localId : [localId]);
  if (ids.size === 0) return;
  const next = state.items.filter(
    (item) => !(item.status === "completed" && item.localId != null && ids.has(item.localId))
  );
  if (next.length === state.items.length) return;
  state.items = next;
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
  // Annule tous les transferts en vol (voir pauseQueueItem) avant de basculer
  // les statuts, sinon les workers en cours continueraient leur page.
  const ids = [...activeDownloads.keys()];
  for (const id of ids) {
    const inFlight = activeDownloads.get(id);
    activeDownloads.delete(id);
    void inFlight?.cancelAsync().catch(() => {});
  }
  state.items = state.items.map((item) =>
    item.status === "queued" || item.status === "downloading"
      ? { ...item, status: "paused" }
      : item
  );
  persistQueue();
  notify();
}

export function reorderQueue(fromIndex: number, toIndex: number): void {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= state.items.length ||
    toIndex >= state.items.length
  ) {
    return;
  }
  const next = [...state.items];
  const [moved] = next.splice(fromIndex, 1);
  if (!moved) return;
  next.splice(toIndex, 0, moved);
  state.items = next;
  persistQueue();
  notify();
}

export function moveQueueItem(id: number, direction: -1 | 1): void {
  const index = state.items.findIndex((item) => item.id === id);
  if (index < 0) return;
  reorderQueue(index, index + direction);
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
 * Pause immédiate : mappe galleryId -> DownloadResumable en vol. `cancelAsync`
 * résout la promesse avec `null` SANS supprimer le .part (confirmé côté natif :
 * `call.cancel()` → resolve(null)), donc le préfixe déjà écrit reste valable
 * pour une reprise HTTP Range au prochain passage du worker.
 */
const activeDownloads = new Map<number, FileSystem.DownloadResumable>();

/**
 * Les téléchargements s'exécutent au premier plan dans l'app. La reprise se fait
 * via fichiers `.part` + file persistée, pas via un service natif d'arrière-plan.
 */
async function isLocalImageComplete(uri: string, expectedSize?: number): Promise<boolean> {
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists) return false;
  let headerBytes: Uint8Array | null = null;
  try {
    const header = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
      length: 16,
      position: 0,
    });
    headerBytes = decodeBase64Header(header, 16);
  } catch {}
  return isCompleteDownload({
    size: info.size ?? 0,
    expectedSize,
    headerBytes,
  });
}

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
    await ensureNoMediaFile(libraryRoot());
    await ensureNoMediaFile(targetDir);

    const total = gallery.images?.pages?.length || gallery.num_pages || 0;
    const pagesCopy = [...(gallery.images?.pages || [])];
    if (!Number.isFinite(total) || total <= 0) {
      throw new Error("La galerie ne contient aucune page téléchargeable.");
    }

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
      if (!pageUrl) {
        throw new Error(`URL manquante pour la page ${i + 1}.`);
      }
      const ext = detectPageExt(pageUrl, p?.t);
      const fileUri = `${targetDir}Image${pageNum}.${ext}`;
      const partUri = `${fileUri}.part`;
      const resumeKey = `@nh_dl_resume_${item.id}_${pageNum}`;

      let fileInfo = await FileSystem.getInfoAsync(fileUri);
      if (fileInfo.exists) {
        const valid = await isLocalImageComplete(fileUri);
        if (!valid) {
          await FileSystem.deleteAsync(fileUri, { idempotent: true });
          fileInfo = await FileSystem.getInfoAsync(fileUri);
        }
      }
      if (!fileInfo.exists) {
        // Reprise : si un .part existe (téléchargement interrompu), on passe
        // son octet de reprise en `resumeData`. Côté natif, cet argument
        // déclenche à la fois l'APPEND au fichier existant ET l'envoi du
        // header `Range: bytes=<offset>-` (voir FileSystemModule.kt).
        // Ne PAS ajouter soi-même un header Range : il serait dupliqué.
        const partialInfo = await FileSystem.getInfoAsync(partUri);
        const resumeOffset = partialInfo.exists
          ? computeResumeOffset({
              partialSize: partialInfo.size ?? 0,
              totalBytes: -1, // taille totale inconnue avant la réponse
            })
          : 0;

        const baseHeaders: Record<string, string> = {
          Referer: "https://nhentai.net/",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
        };

        const runDownload = (offset: number) => {
          const downloadRes = FileSystem.createDownloadResumable(
            pageUrl,
            partUri,
            { headers: { ...baseHeaders } },
            undefined,
            offset > 0 ? String(offset) : undefined
          );
          void AsyncStorage.setItem(resumeKey, JSON.stringify(downloadRes.savable())).catch(
            () => {}
          );
          activeDownloads.set(item.id, downloadRes);
          return downloadRes
            .downloadAsync()
            .finally(() => {
              void AsyncStorage.removeItem(resumeKey).catch(() => {});
              if (activeDownloads.get(item.id) === downloadRes) {
                activeDownloads.delete(item.id);
              }
            });
        };

        let result: Awaited<ReturnType<typeof runDownload>> = null;
        try {
          result = await runDownload(resumeOffset);
        } catch (err) {
          // Échec réseau en cours de transfert : conserver le .part pour la
          // prochaine reprise (c'est toujours un préfixe valide du fichier),
          // mais signaler l'échec.
          throw err instanceof Error ? err : new Error(String(err));
        }
        if (!result) {
          // Tâche annulée (pause utilisateur ou retrait de la file) :
          // le .part est conservé pour la reprise, on sort sans erreur.
          throw new Error("__PAUSED__");
        }

        const kind = classifyResumeResponse(result?.status ?? 0);
        if (
          kind === "restarted" &&
          resumeOffset > 0 &&
          result?.status === 200
        ) {
          // Le serveur a ignoré le Range : comme le natif a APPENDU la réponse
          // complète au .part existant, celui-ci est corrompu. On repart de zéro.
          await FileSystem.deleteAsync(partUri, { idempotent: true });
          result = await runDownload(0);
        }
        const finalKind = classifyResumeResponse(result?.status ?? 0);
        if (
          finalKind === "failed" ||
          !result ||
          result.status < 200 ||
          result.status >= 300
        ) {
          await FileSystem.deleteAsync(partUri, { idempotent: true });
          throw new Error(`Téléchargement incomplet pour la page ${i + 1}.`);
        }
        const contentLength = Number(
          result.headers?.["Content-Length"] ||
            result.headers?.["content-length"] ||
            0
        );
        // En reprise (206), Content-Length ne couvre que la plage restante :
        // la taille attendue du fichier final = offset déjà écrit + plage.
        const expectedSize =
          finalKind === "resumed" ? resumeOffset + contentLength : contentLength;
        const complete = await isLocalImageComplete(partUri, expectedSize || undefined);
        if (!complete) {
          await FileSystem.deleteAsync(partUri, { idempotent: true });
          throw new Error(`Fichier incomplet ou corrompu pour la page ${i + 1}.`);
        }
        await FileSystem.moveAsync({ from: partUri, to: fileUri });
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
    void notifyDownloadFinished({ title: item.title, ok: true });

    const downloadSettings = getDownloadSettings();
    if (downloadSettings.mode === "saf" && downloadSettings.safDirectoryUri) {
      try {
        await copyLocalGalleryToSaf(localId, downloadSettings.safDirectoryUri);
      } catch (copyError) {
        console.warn("[downloadQueue] SAF copy failed, sandbox copy kept:", copyError);
      }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Échec du téléchargement";
    if (message === "__PAUSED__") {
      updateItem(item.id, { status: "paused" });
    } else {
      console.error(`[downloadQueue] Failed gallery ${item.id}:`, err);
      updateItem(item.id, {
        status: "error",
        errorMessage: message,
      });
      void notifyDownloadFinished({ title: item.title, ok: false, errorMessage: message });
    }
  } finally {
    activeWorkers.delete(item.id);
    syncDownloadKeepAwake();
    persistQueue();
    notify();
    processQueue();
  }
}

function updateItem(id: number, patch: Partial<QueueItem>) {
  state.items = state.items.map((it) => (it.id === id ? { ...it, ...patch } : it));
  notify();
  // Progression de page -> rafraîchir la notif persistante (throttlé 1/s).
  if (
    patch.downloadedPages !== undefined ||
    patch.totalPages !== undefined
  ) {
    void syncForegroundService();
  }
}

async function canStartDownloads(): Promise<boolean> {
  if (!getDownloadSettings().wifiOnly) return true;
  try {
    const net = await NetInfo.fetch();
    return net.type === "wifi" && net.isConnected === true;
  } catch {
    return false;
  }
}

function syncDownloadKeepAwake(): void {
  if (activeWorkers.size > 0) {
    void activateKeepAwakeAsync("yomu-downloads");
    void syncForegroundService();
    return;
  }
  try {
    deactivateKeepAwake("yomu-downloads");
  } catch {
    // Tag may not have been activated yet.
  }
  void stopDownloadForeground().catch(() => {});
}

/**
 * Notifie le foreground service de la progression globale de la file.
 * Throttle ~1 update/s : les updates notifee sont coûteuses (IPC + notif).
 */
let lastFgsUpdate = 0;
async function syncForegroundService(): Promise<void> {
  const now = Date.now();
  if (now - lastFgsUpdate < 1000) return;
  lastFgsUpdate = now;
  const pending = state.items.filter(
    (it) => it.status === "downloading" || it.status === "queued"
  );
  if (pending.length === 0) return;
  const progress = {
    remainingGalleries: pending.length,
    downloadedPages: pending.reduce((acc, it) => acc + it.downloadedPages, 0),
    totalPages: pending.reduce((acc, it) => acc + it.totalPages, 0),
  };
  try {
    if (!fgsStarted) {
      fgsStarted = true;
      await startDownloadForeground(progress);
    } else {
      await updateDownloadForeground(progress);
    }
  } catch {
    // Pas grave si le FGS échoue (permission notif refusée, etc.) :
    // les téléchargements continuent au premier plan quand même.
  }
}
let fgsStarted = false;

export function processQueue() {
  void processQueueAsync();
}

async function processQueueAsync(): Promise<void> {
  if (activeWorkers.size >= state.maxConcurrent) return;
  if (!(await canStartDownloads())) return;

  const slots = state.maxConcurrent - activeWorkers.size;
  const nextItems = state.items.filter(
    (it) => it.status === "queued" && !activeWorkers.has(it.id)
  );

  for (let i = 0; i < Math.min(slots, nextItems.length); i++) {
    const item = nextItems[i];
    activeWorkers.add(item.id);
    updateItem(item.id, { status: "downloading" });
    syncDownloadKeepAwake();
    void downloadSingleGalleryWorker(item);
  }
}

function onNetworkChange(state: NetInfoState): void {
  if (!getDownloadSettings().wifiOnly) return;
  if (state.type === "wifi" && state.isConnected) {
    processQueue();
  }
}

NetInfo.addEventListener(onNetworkChange);

initDownloadQueue();

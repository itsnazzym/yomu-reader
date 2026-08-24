import { create } from "zustand";
import { DownloadItem, Gallery, DownloadFormat, DownloadProgressPayload } from "../types";
import { cancelDownload, onDownloadProgress, isElectron, startDownload } from "../utils/ipc";
import { executeHighSpeedDownload } from "../utils/browserDownloader";
import { useSettingsStore } from "./settingsStore";
import { galleryGlobalId } from "../utils/globalId";

const STORAGE_KEY = "nhentai_download_history";
const activeAbortControllers = new Map<number, AbortController>();

interface DownloadState {
  queue: DownloadItem[];
  activeCount: number;
  initListener: () => () => void;
  addToQueue: (gallery: Gallery, format?: DownloadFormat) => void;
  addBatchToQueue: (galleries: Gallery[], format?: DownloadFormat) => void;
  pauseDownload: (id: number) => void;
  resumeDownload: (id: number) => void;
  cancelItem: (id: number) => void;
  clearCompleted: () => void;
  retryItem: (id: number) => void;
  processQueue: () => void;
}

const loadInitialQueue = (): DownloadItem[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const items: DownloadItem[] = JSON.parse(raw);
      // Reset any stuck "downloading" items to "queued" or "error"
      return items.map((i) =>
        i.status === "downloading" ? { ...i, status: "paused" } : i
      );
    }
  } catch (e) {
    console.error("Failed to load download history:", e);
  }
  return [];
};

const saveQueue = (queue: DownloadItem[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.error("Failed to save download history:", e);
  }
};

export const useDownloadStore = create<DownloadState>((set, get) => ({
  queue: loadInitialQueue(),
  activeCount: 0,

  initListener: () => {
    return onDownloadProgress((payload: DownloadProgressPayload) => {
      set((state) => {
        const index = state.queue.findIndex((item) => item.id === payload.id);
        if (index === -1) return state;

        const updatedQueue = [...state.queue];
        const current = updatedQueue[index];

        updatedQueue[index] = {
          ...current,
          downloaded_pages: payload.downloaded_pages,
          total_pages: payload.total_pages || current.total_pages,
          progress: payload.progress,
          speed_kb_s: payload.speed_kb_s,
          status: payload.status,
          error_message: payload.error || current.error_message,
          target_path: payload.target_path || current.target_path,
        };

        saveQueue(updatedQueue);
        const activeCount = updatedQueue.filter((item) => item.status === "downloading").length;
        return { queue: updatedQueue, activeCount };
      });

      // If item completed or errored, process next in queue
      if (payload.status === "completed" || payload.status === "error" || payload.status === "cancelled") {
        setTimeout(() => {
          get().processQueue();
        }, 100);
      }
    });
  },

  addToQueue: (gallery, format) => {
    const existing = get().queue.find((item) => item.id === gallery.id);
    if (existing && existing.status === "completed") {
      return; // Already downloaded
    }

    const defaultFormat = useSettingsStore.getState().settings.default_format;
    const newItem: DownloadItem = {
      id: gallery.id,
      globalId: galleryGlobalId(gallery),
      gallery,
      format: format || defaultFormat || "cbz",
      status: "queued",
      progress: 0,
      downloaded_pages: 0,
      total_pages: gallery.num_pages || gallery.images?.pages?.length || 1,
      speed_kb_s: 0,
      created_at: Date.now(),
    };

    set((state) => {
      const filtered = state.queue.filter((i) => i.id !== gallery.id);
      const updated = [newItem, ...filtered];
      saveQueue(updated);
      return { queue: updated };
    });

    get().processQueue();
  },

  addBatchToQueue: (galleries, format) => {
    const defaultFormat = useSettingsStore.getState().settings.default_format;
    const currentQueue = get().queue;
    const newItems: DownloadItem[] = [];

    for (const gallery of galleries) {
      const existing = currentQueue.find((item) => item.id === gallery.id);
      if (!existing || existing.status !== "completed") {
        newItems.push({
          id: gallery.id,
          globalId: galleryGlobalId(gallery),
          gallery,
          format: format || defaultFormat || "cbz",
          status: "queued",
          progress: 0,
          downloaded_pages: 0,
          total_pages: gallery.num_pages || gallery.images?.pages?.length || 1,
          speed_kb_s: 0,
          created_at: Date.now(),
        });
      }
    }

    if (newItems.length === 0) return;

    set((state) => {
      const existingIds = new Set(newItems.map((i) => i.id));
      const filtered = state.queue.filter((i) => !existingIds.has(i.id));
      const updated = [...newItems, ...filtered];
      saveQueue(updated);
      return { queue: updated };
    });

    get().processQueue();
  },

  processQueue: async () => {
    const { queue } = get();
    const settings = useSettingsStore.getState().settings;
    const maxConcurrent = settings.concurrent_downloads || 2;

    const currentDownloading = queue.filter((i) => i.status === "downloading");
    if (currentDownloading.length >= maxConcurrent) {
      return;
    }

    const nextQueued = queue.find((i) => i.status === "queued");
    if (!nextQueued) {
      return;
    }

    // Mark as downloading
    set((state) => {
      const updated = state.queue.map((i) =>
        i.id === nextQueued.id ? { ...i, status: "downloading" as const, error_message: undefined } : i
      );
      saveQueue(updated);
      return {
        queue: updated,
        activeCount: updated.filter((i) => i.status === "downloading").length,
      };
    });

    const abortCtrl = new AbortController();
    activeAbortControllers.set(nextQueued.id, abortCtrl);

    try {
      if (isElectron()) {
        await startDownload(
          nextQueued.gallery,
          nextQueued.format,
          settings.naming_pattern,
          settings.download_directory
        );
      } else {
        await executeHighSpeedDownload({
          gallery: nextQueued.gallery,
          formatType: nextQueued.format,
          pattern: settings.naming_pattern,
          destDir: settings.download_directory,
          cookies: settings.cookies,
          apiKey: settings.api_key,
          abortSignal: abortCtrl.signal,
          onProgress: (payload) => {
            set((state) => {
              const index = state.queue.findIndex((item) => item.id === payload.id);
              if (index === -1) return state;

              const updatedQueue = [...state.queue];
              const current = updatedQueue[index];

              updatedQueue[index] = {
                ...current,
                downloaded_pages: payload.downloaded_pages,
                total_pages: payload.total_pages || current.total_pages,
                progress: payload.progress,
                speed_kb_s: payload.speed_kb_s,
                status: payload.status,
                error_message: payload.error || current.error_message,
                target_path: payload.target_path || current.target_path,
              };

              saveQueue(updatedQueue);
              return {
                queue: updatedQueue,
                activeCount: updatedQueue.filter((item) => item.status === "downloading").length,
              };
            });
          },
        });
      }
    } catch (err: any) {
      if (err?.message !== "ABORTED") {
        console.error(`Download failed for gallery #${nextQueued.id}:`, err);
        set((state) => {
          const updated = state.queue.map((i) =>
            i.id === nextQueued.id
              ? { ...i, status: "error" as const, error_message: err.message || "Erreur de téléchargement" }
              : i
          );
          saveQueue(updated);
          return { queue: updated };
        });
      }
    } finally {
      activeAbortControllers.delete(nextQueued.id);
      get().processQueue();
    }
  },

  pauseDownload: (id) => {
    const ctrl = activeAbortControllers.get(id);
    if (ctrl) ctrl.abort();
    cancelDownload(id);
    set((state) => {
      const updated = state.queue.map((i) =>
        i.id === id ? { ...i, status: "paused" as const } : i
      );
      saveQueue(updated);
      return { queue: updated };
    });
  },

  resumeDownload: (id) => {
    set((state) => {
      const updated = state.queue.map((i) =>
        i.id === id ? { ...i, status: "queued" as const, error_message: undefined } : i
      );
      saveQueue(updated);
      return { queue: updated };
    });
    get().processQueue();
  },

  retryItem: (id) => {
    set((state) => {
      const updated = state.queue.map((i) =>
        i.id === id ? { ...i, status: "queued" as const, progress: 0, error_message: undefined } : i
      );
      saveQueue(updated);
      return { queue: updated };
    });
    get().processQueue();
  },

  cancelItem: (id) => {
    const ctrl = activeAbortControllers.get(id);
    if (ctrl) ctrl.abort();
    cancelDownload(id);
    set((state) => {
      const updated = state.queue.map((i) =>
        i.id === id ? { ...i, status: "cancelled" as const } : i
      );
      saveQueue(updated);
      return { queue: updated };
    });
  },

  clearCompleted: () => {
    set((state) => {
      const updated = state.queue.filter(
        (i) => i.status === "downloading" || i.status === "queued"
      );
      saveQueue(updated);
      return { queue: updated };
    });
  },
}));

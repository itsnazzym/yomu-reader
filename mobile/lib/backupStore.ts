import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as Clipboard from "expo-clipboard";
import { FAVORITES_STORAGE_KEY, initFavorites } from "./favoritesStore";
import { HISTORY_STORAGE_KEY, initHistory } from "./historyStore";
import {
  TAG_FAVORITES_STORAGE_KEY,
  initTagFavs,
} from "./tagFavoritesStore";
import {
  TAG_COLLECTIONS_STORAGE_KEY,
  initTagCollections,
} from "./tagCollectionsStore";
import {
  READER_SETTINGS_STORAGE_KEY,
  initReaderSettings,
} from "./readerSettingsStore";

export interface BackupData {
  version: number;
  exportedAt: string;
  favorites?: any[];
  history?: any[];
  tagFavorites?: Record<string, unknown>;
  tagCollections?: any[];
  readerSettings?: any;
}

const STORAGE_KEYS = {
  favorites: FAVORITES_STORAGE_KEY,
  history: HISTORY_STORAGE_KEY,
  tagFavorites: TAG_FAVORITES_STORAGE_KEY,
  tagCollections: TAG_COLLECTIONS_STORAGE_KEY,
  readerSettings: READER_SETTINGS_STORAGE_KEY,
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isValidBackupData(value: unknown): value is BackupData {
  if (!isPlainObject(value)) return false;
  if (value.version !== 1 && value.version !== 2) return false;
  if (typeof value.exportedAt !== "string" || !Number.isFinite(Date.parse(value.exportedAt))) {
    return false;
  }
  if (
    value.favorites !== undefined &&
    (!Array.isArray(value.favorites) ||
      value.favorites.some(
        (item) => !isPlainObject(item) || !Number.isFinite(Number(item.id))
      ))
  ) {
    return false;
  }
  if (
    value.history !== undefined &&
    (!Array.isArray(value.history) ||
      value.history.some(
        (item) =>
          !isPlainObject(item) ||
          !isPlainObject(item.gallery) ||
          !Number.isFinite(Number(item.gallery.id)) ||
          !Number.isFinite(Number(item.lastPage))
      ))
  ) {
    return false;
  }
  if (value.tagFavorites !== undefined && !isPlainObject(value.tagFavorites)) return false;
  if (
    value.tagCollections !== undefined &&
    (!Array.isArray(value.tagCollections) ||
      value.tagCollections.some((item) => !isPlainObject(item)))
  ) {
    return false;
  }
  if (value.readerSettings !== undefined && !isPlainObject(value.readerSettings)) return false;
  return true;
}

/**
 * Génère l'objet complet de sauvegarde
 */
export async function createBackupPayload(): Promise<BackupData> {
  const [favRaw, histRaw, tagFavRaw, tagColRaw, setRaw] = await Promise.all([
    AsyncStorage.getItem(STORAGE_KEYS.favorites),
    AsyncStorage.getItem(STORAGE_KEYS.history),
    AsyncStorage.getItem(STORAGE_KEYS.tagFavorites),
    AsyncStorage.getItem(STORAGE_KEYS.tagCollections),
    AsyncStorage.getItem(STORAGE_KEYS.readerSettings),
  ]);

  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    favorites: favRaw ? JSON.parse(favRaw) : [],
    history: histRaw ? JSON.parse(histRaw) : [],
    tagFavorites: tagFavRaw ? JSON.parse(tagFavRaw) : {},
    tagCollections: tagColRaw ? JSON.parse(tagColRaw) : [],
    readerSettings: setRaw ? JSON.parse(setRaw) : {},
  };
}

/**
 * Exporte la sauvegarde dans un fichier JSON et ouvre la feuille de partage système
 */
export async function exportBackupToFile(): Promise<{ success: boolean; path?: string; message?: string }> {
  try {
    const payload = await createBackupPayload();
    const jsonStr = JSON.stringify(payload, null, 2);
    const dateStr = new Date().toISOString().slice(0, 10);
    const fileName = `nhentai_backup_${dateStr}.json`;
    const filePath = `${FileSystem.cacheDirectory}${fileName}`;

    await FileSystem.writeAsStringAsync(filePath, jsonStr, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(filePath, {
        mimeType: "application/json",
        dialogTitle: "Exporter la sauvegarde nHentai",
        UTI: "public.json",
      });
      return { success: true, path: filePath };
    } else {
      // Fallback au presse-papier
      await Clipboard.setStringAsync(jsonStr);
      return { success: true, message: "Sauvegarde copiée dans le presse-papier" };
    }
  } catch (error: any) {
    return { success: false, message: error?.message || "Erreur lors de l'exportation" };
  }
}

/**
 * Restaure une sauvegarde depuis une chaîne JSON
 */
export async function restoreBackupFromJson(jsonString: string): Promise<{
  success: boolean;
  restoredItems: {
    favorites: number;
    history: number;
    tagFavorites: number;
    tagCollections: number;
  };
  error?: string;
}> {
  try {
    const parsed: unknown = JSON.parse(jsonString);

    if (!isValidBackupData(parsed)) {
      return {
        success: false,
        error: "Fichier de sauvegarde invalide ou version non prise en charge",
        restoredItems: { favorites: 0, history: 0, tagFavorites: 0, tagCollections: 0 },
      };
    }
    const data = parsed;

    const tasks: Promise<void>[] = [];

    if (Array.isArray(data.favorites)) {
      tasks.push(AsyncStorage.setItem(STORAGE_KEYS.favorites, JSON.stringify(data.favorites)));
    }
    if (Array.isArray(data.history)) {
      tasks.push(AsyncStorage.setItem(STORAGE_KEYS.history, JSON.stringify(data.history)));
    }
    if (isPlainObject(data.tagFavorites)) {
      tasks.push(AsyncStorage.setItem(STORAGE_KEYS.tagFavorites, JSON.stringify(data.tagFavorites)));
    }
    if (Array.isArray(data.tagCollections)) {
      tasks.push(AsyncStorage.setItem(STORAGE_KEYS.tagCollections, JSON.stringify(data.tagCollections)));
    }
    if (isPlainObject(data.readerSettings)) {
      tasks.push(AsyncStorage.setItem(STORAGE_KEYS.readerSettings, JSON.stringify(data.readerSettings)));
    }

    await Promise.all(tasks);

    // Recharger tous les stores en mémoire
    await Promise.all([
      initFavorites(true),
      initTagFavs(),
      initTagCollections(),
      initReaderSettings(),
      initHistory(true),
    ]);

    return {
      success: true,
      restoredItems: {
        favorites: Array.isArray(data.favorites) ? data.favorites.length : 0,
        history: Array.isArray(data.history) ? data.history.length : 0,
        tagFavorites: isPlainObject(data.tagFavorites) ? Object.keys(data.tagFavorites).length : 0,
        tagCollections: Array.isArray(data.tagCollections) ? data.tagCollections.length : 0,
      },
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Échec de lecture du format JSON",
      restoredItems: { favorites: 0, history: 0, tagFavorites: 0, tagCollections: 0 },
    };
  }
}

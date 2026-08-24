import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
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
import { BLACKLIST_STORAGE_KEY, initBlacklist } from "./blacklistFilter";
import {
  DOWNLOAD_SETTINGS_KEY,
  initDownloadSettings,
} from "./downloadSettingsStore";
import {
  SEARCH_HISTORY_STORAGE_KEY,
} from "./recommendationEngine";
import {
  PRIVACY_STORAGE_KEY,
  initPrivacySettings,
} from "./privacyStore";
import { LIBRARY_DIR_NAME } from "./localLibrary";
import {
  LIBRARY_COLLECTIONS_STORAGE_KEY,
  initLibraryCollections,
} from "./libraryCollectionsStore";
import {
  FOLLOWS_FEED_STORAGE_KEY,
  initFollowsFeed,
} from "./followsFeedStore";

export interface BackupRestoredCounts {
  favorites: number;
  history: number;
  tagFavorites: number;
  tagCollections: number;
  blacklist: number;
  searchHistory: number;
  libraryCollections: number;
  follows: number;
}

export interface BackupData {
  version: number;
  exportedAt: string;
  favorites?: Record<string, unknown>[];
  history?: Record<string, unknown>[];
  tagFavorites?: Record<string, unknown>;
  tagCollections?: Record<string, unknown>[];
  readerSettings?: Record<string, unknown>;
  blacklistTags?: string[];
  downloadSettings?: Record<string, unknown>;
  searchHistory?: string[];
  privacy?: Record<string, unknown>;
  libraryCollections?: Record<string, unknown>[];
  followsFeed?: Record<string, unknown>;
  localAvatarBase64?: string;
  localAvatarMime?: string;
}

const STORAGE_KEYS = {
  favorites: FAVORITES_STORAGE_KEY,
  history: HISTORY_STORAGE_KEY,
  tagFavorites: TAG_FAVORITES_STORAGE_KEY,
  tagCollections: TAG_COLLECTIONS_STORAGE_KEY,
  readerSettings: READER_SETTINGS_STORAGE_KEY,
  blacklist: BLACKLIST_STORAGE_KEY,
  downloadSettings: DOWNLOAD_SETTINGS_KEY,
  searchHistory: SEARCH_HISTORY_STORAGE_KEY,
  privacy: PRIVACY_STORAGE_KEY,
  libraryCollections: LIBRARY_COLLECTIONS_STORAGE_KEY,
  followsFeed: FOLLOWS_FEED_STORAGE_KEY,
};

const LAST_AUTOBACKUP_KEY = "@nhentai_last_autobackup_at";
const AUTOBACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
const CURRENT_BACKUP_VERSION = 3;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseJsonRecordArray(raw: string | null): Record<string, unknown>[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isPlainObject);
  } catch {
    return [];
  }
}

function parseJsonRecord(raw: string | null): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return isPlainObject(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function parseJsonStringArray(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

function isValidBackupData(value: unknown): value is BackupData {
  if (!isPlainObject(value)) return false;
  if (value.version !== 1 && value.version !== 2 && value.version !== 3) return false;
  if (typeof value.exportedAt !== "string" || !Number.isFinite(Date.parse(value.exportedAt))) {
    return false;
  }
  if (
    value.favorites !== undefined &&
    (!Array.isArray(value.favorites) ||
      value.favorites.some((item) => {
        if (!isPlainObject(item)) return true;
        const hasNumericId = Number.isFinite(Number(item.id));
        const hasGlobalId =
          typeof item.globalId === "string" && item.globalId.includes(":");
        return !hasNumericId && !hasGlobalId;
      }))
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
  if (
    value.blacklistTags !== undefined &&
    (!Array.isArray(value.blacklistTags) ||
      value.blacklistTags.some((item) => typeof item !== "string"))
  ) {
    return false;
  }
  if (value.downloadSettings !== undefined && !isPlainObject(value.downloadSettings)) return false;
  if (
    value.searchHistory !== undefined &&
    (!Array.isArray(value.searchHistory) ||
      value.searchHistory.some((item) => typeof item !== "string"))
  ) {
    return false;
  }
  if (value.privacy !== undefined && !isPlainObject(value.privacy)) return false;
  if (
    value.libraryCollections !== undefined &&
    (!Array.isArray(value.libraryCollections) ||
      value.libraryCollections.some((item) => !isPlainObject(item)))
  ) {
    return false;
  }
  if (value.followsFeed !== undefined && !isPlainObject(value.followsFeed)) return false;
  if (
    value.localAvatarBase64 !== undefined &&
    typeof value.localAvatarBase64 !== "string"
  ) {
    return false;
  }
  if (
    value.localAvatarMime !== undefined &&
    typeof value.localAvatarMime !== "string"
  ) {
    return false;
  }
  return true;
}

export async function createBackupPayload(): Promise<BackupData> {
  const [
    favRaw,
    histRaw,
    tagFavRaw,
    tagColRaw,
    setRaw,
    blacklistRaw,
    downloadRaw,
    searchRaw,
    privacyRaw,
    collectionsRaw,
    followsRaw,
  ] = await Promise.all([
    AsyncStorage.getItem(STORAGE_KEYS.favorites),
    AsyncStorage.getItem(STORAGE_KEYS.history),
    AsyncStorage.getItem(STORAGE_KEYS.tagFavorites),
    AsyncStorage.getItem(STORAGE_KEYS.tagCollections),
    AsyncStorage.getItem(STORAGE_KEYS.readerSettings),
    AsyncStorage.getItem(STORAGE_KEYS.blacklist),
    AsyncStorage.getItem(STORAGE_KEYS.downloadSettings),
    AsyncStorage.getItem(STORAGE_KEYS.searchHistory),
    AsyncStorage.getItem(STORAGE_KEYS.privacy),
    AsyncStorage.getItem(STORAGE_KEYS.libraryCollections),
    AsyncStorage.getItem(STORAGE_KEYS.followsFeed),
  ]);

  let localAvatarBase64: string | undefined;
  let localAvatarMime: string | undefined;
  try {
    const { readLocalAvatarBase64 } = await import("./avatarPersist");
    const avatar = await readLocalAvatarBase64();
    if (avatar) {
      localAvatarBase64 = avatar.base64;
      localAvatarMime = avatar.mime;
    }
  } catch (err: unknown) {
    console.warn("[backup] Failed to include local avatar:", err);
  }

  return {
    version: CURRENT_BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    favorites: parseJsonRecordArray(favRaw),
    history: parseJsonRecordArray(histRaw),
    tagFavorites: parseJsonRecord(tagFavRaw),
    tagCollections: parseJsonRecordArray(tagColRaw),
    readerSettings: parseJsonRecord(setRaw),
    blacklistTags: parseJsonStringArray(blacklistRaw),
    downloadSettings: parseJsonRecord(downloadRaw),
    searchHistory: parseJsonStringArray(searchRaw),
    privacy: parseJsonRecord(privacyRaw),
    libraryCollections: parseJsonRecordArray(collectionsRaw),
    followsFeed: parseJsonRecord(followsRaw),
    localAvatarBase64,
    localAvatarMime,
  };
}

export async function exportBackupToFile(): Promise<{
  success: boolean;
  path?: string;
  message?: string;
}> {
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
    }
    await Clipboard.setStringAsync(jsonStr);
    return { success: true, message: "Sauvegarde copiée dans le presse-papier" };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erreur lors de l'exportation";
    return { success: false, message };
  }
}

function emptyRestoredCounts(): BackupRestoredCounts {
  return {
    favorites: 0,
    history: 0,
    tagFavorites: 0,
    tagCollections: 0,
    blacklist: 0,
    searchHistory: 0,
    libraryCollections: 0,
    follows: 0,
  };
}

export async function restoreBackupFromJson(jsonString: string): Promise<{
  success: boolean;
  restoredItems: BackupRestoredCounts;
  error?: string;
}> {
  try {
    const parsed: unknown = JSON.parse(jsonString);

    if (!isValidBackupData(parsed)) {
      return {
        success: false,
        error: "Fichier de sauvegarde invalide ou version non prise en charge",
        restoredItems: emptyRestoredCounts(),
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
    if (Array.isArray(data.blacklistTags)) {
      tasks.push(AsyncStorage.setItem(STORAGE_KEYS.blacklist, JSON.stringify(data.blacklistTags)));
    }
    if (isPlainObject(data.downloadSettings)) {
      tasks.push(
        AsyncStorage.setItem(STORAGE_KEYS.downloadSettings, JSON.stringify(data.downloadSettings))
      );
    }
    if (Array.isArray(data.searchHistory)) {
      tasks.push(AsyncStorage.setItem(STORAGE_KEYS.searchHistory, JSON.stringify(data.searchHistory)));
    }
    if (isPlainObject(data.privacy)) {
      tasks.push(AsyncStorage.setItem(STORAGE_KEYS.privacy, JSON.stringify(data.privacy)));
    }
    if (Array.isArray(data.libraryCollections)) {
      tasks.push(
        AsyncStorage.setItem(STORAGE_KEYS.libraryCollections, JSON.stringify(data.libraryCollections))
      );
    }
    if (isPlainObject(data.followsFeed)) {
      tasks.push(AsyncStorage.setItem(STORAGE_KEYS.followsFeed, JSON.stringify(data.followsFeed)));
    }

    await Promise.all(tasks);

    if (typeof data.localAvatarBase64 === "string" && data.localAvatarBase64.trim() !== "") {
      try {
        const { writeLocalAvatarFromBase64 } = await import("./avatarPersist");
        const { saveAccountSession } = await import("./accountStore");
        const mime =
          typeof data.localAvatarMime === "string" ? data.localAvatarMime : "image/png";
        const uri = await writeLocalAvatarFromBase64(data.localAvatarBase64, mime);
        await saveAccountSession({ localAvatarUri: uri });
      } catch (err: unknown) {
        console.warn("[backup] Failed to restore local avatar:", err);
      }
    }

    await Promise.all([
      initFavorites(true),
      initTagFavs(true),
      initTagCollections(true),
      initReaderSettings(true),
      initHistory(true),
      initBlacklist(true),
      initDownloadSettings(true),
      initPrivacySettings(true),
      initLibraryCollections(true),
      initFollowsFeed(true),
    ]);

    return {
      success: true,
      restoredItems: {
        favorites: Array.isArray(data.favorites) ? data.favorites.length : 0,
        history: Array.isArray(data.history) ? data.history.length : 0,
        tagFavorites: isPlainObject(data.tagFavorites) ? Object.keys(data.tagFavorites).length : 0,
        tagCollections: Array.isArray(data.tagCollections) ? data.tagCollections.length : 0,
        blacklist: Array.isArray(data.blacklistTags) ? data.blacklistTags.length : 0,
        searchHistory: Array.isArray(data.searchHistory) ? data.searchHistory.length : 0,
        libraryCollections: Array.isArray(data.libraryCollections) ? data.libraryCollections.length : 0,
        follows: isPlainObject(data.followsFeed)
          ? Array.isArray(data.followsFeed.pinned)
            ? data.followsFeed.pinned.length
            : 0
          : 0,
      },
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Échec de lecture du format JSON",
      restoredItems: emptyRestoredCounts(),
    };
  }
}

export async function restoreBackupFromFile(): Promise<{
  success: boolean;
  restoredItems: BackupRestoredCounts;
  error?: string;
}> {
  try {
    const DocumentPicker = await import("expo-document-picker");
    const result = await DocumentPicker.getDocumentAsync({
      type: "application/json",
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets[0]?.uri) {
      return {
        success: false,
        error: "Import annulé",
        restoredItems: emptyRestoredCounts(),
      };
    }
    const jsonString = await FileSystem.readAsStringAsync(result.assets[0].uri, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    return restoreBackupFromJson(jsonString);
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Impossible de lire le fichier",
      restoredItems: emptyRestoredCounts(),
    };
  }
}

export async function maybeRunAutobackup(): Promise<void> {
  try {
    const lastRaw = await AsyncStorage.getItem(LAST_AUTOBACKUP_KEY);
    const lastAt = lastRaw ? Number(lastRaw) : 0;
    if (Number.isFinite(lastAt) && Date.now() - lastAt < AUTOBACKUP_INTERVAL_MS) {
      return;
    }
    const payload = await createBackupPayload();
    const dir = `${FileSystem.documentDirectory || ""}${LIBRARY_DIR_NAME}/autobackup/`;
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    await FileSystem.writeAsStringAsync(
      `${dir}nhentai_autobackup.json`,
      JSON.stringify(payload, null, 2),
      { encoding: FileSystem.EncodingType.UTF8 }
    );
    await AsyncStorage.setItem(LAST_AUTOBACKUP_KEY, String(Date.now()));
  } catch (error) {
    console.warn("[backup] Autobackup failed:", error);
  }
}

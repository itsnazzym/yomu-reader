import AsyncStorage from "@react-native-async-storage/async-storage";
import { useState, useEffect } from "react";
import * as FileSystem from "expo-file-system/legacy";
import { createInitOnce, createWriteQueue } from "./persistQueue";
import { LIBRARY_DIR_NAME } from "./localLibrary";

export const DOWNLOAD_SETTINGS_KEY = "@nhentai_download_settings_v1";
export const FOLDER_PROMPTED_KEY = "@nhentai_folder_prompted_v1";

export type DownloadFolderMode = "app" | "saf";

export interface DownloadSettings {
  mode: DownloadFolderMode;
  safDirectoryUri: string | null;
  rememberFolder: boolean;
  folderPrompted: boolean;
  wifiOnly: boolean;
}

const defaultSettings: DownloadSettings = {
  mode: "app",
  safDirectoryUri: null,
  rememberFolder: true,
  folderPrompted: false,
  wifiOnly: false,
};

let currentSettings: DownloadSettings = { ...defaultSettings };
let settingsReady = false;
const listeners = new Set<() => void>();
const writes = createWriteQueue();

function notify(): void {
  for (const listener of listeners) listener();
}

async function loadDownloadSettings(): Promise<void> {
  await writes.flush();
  try {
    const raw = await AsyncStorage.getItem(DOWNLOAD_SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<DownloadSettings>;
      currentSettings = { ...defaultSettings, ...parsed };
    }
    const prompted = await AsyncStorage.getItem(FOLDER_PROMPTED_KEY);
    if (prompted === "true") {
      currentSettings = { ...currentSettings, folderPrompted: true };
    }
  } catch {
    // Keep defaults if storage is unavailable.
  } finally {
    settingsReady = true;
    notify();
  }
}

export const initDownloadSettings = createInitOnce(loadDownloadSettings);

export async function updateDownloadSettings(patch: Partial<DownloadSettings>): Promise<void> {
  await initDownloadSettings();
  currentSettings = { ...currentSettings, ...patch };
  notify();
  const serialized = JSON.stringify(currentSettings);
  await writes.enqueue(async () => {
    await AsyncStorage.setItem(DOWNLOAD_SETTINGS_KEY, serialized);
    if (currentSettings.folderPrompted) {
      await AsyncStorage.setItem(FOLDER_PROMPTED_KEY, "true");
    }
  });
}

export function getDownloadSettings(): DownloadSettings {
  return currentSettings;
}

export function getSandboxLibraryPath(): string {
  return `${FileSystem.documentDirectory || ""}${LIBRARY_DIR_NAME}/`;
}

export function getDownloadFolderLabel(settings: DownloadSettings = currentSettings): string {
  if (settings.mode === "saf" && settings.safDirectoryUri) {
    return decodeSafLabel(settings.safDirectoryUri);
  }
  return "Stockage de l'application (privé)";
}

export function decodeSafLabel(uri: string): string {
  try {
    const decoded = decodeURIComponent(uri);
    const tree = decoded.split("tree/")[1] || decoded;
    return tree.replace(/^primary:/, "").replace(/\+/g, "/") || "Dossier choisi";
  } catch {
    return "Dossier choisi";
  }
}

export async function resetDownloadFolder(): Promise<void> {
  await updateDownloadSettings({
    mode: "app",
    safDirectoryUri: null,
  });
}

export function useDownloadSettings(): {
  settings: DownloadSettings;
  ready: boolean;
  folderLabel: string;
  sandboxPath: string;
  updateSettings: (patch: Partial<DownloadSettings>) => Promise<void>;
  resetFolder: () => Promise<void>;
} {
  const [settings, setSettings] = useState<DownloadSettings>(currentSettings);
  const [ready, setReady] = useState(settingsReady);

  useEffect(() => {
    const update = (): void => {
      setSettings({ ...currentSettings });
      setReady(settingsReady);
    };
    listeners.add(update);
    initDownloadSettings();
    return () => {
      listeners.delete(update);
    };
  }, []);

  return {
    settings,
    ready,
    folderLabel: getDownloadFolderLabel(settings),
    sandboxPath: getSandboxLibraryPath(),
    updateSettings: updateDownloadSettings,
    resetFolder: resetDownloadFolder,
  };
}

initDownloadSettings();

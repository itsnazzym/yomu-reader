import AsyncStorage from "@react-native-async-storage/async-storage";
import { useState, useEffect } from "react";
import { createInitOnce, createWriteQueue } from "./persistQueue";

export const READER_SETTINGS_STORAGE_KEY = "@nhentai_reader_settings_v2";

export interface ReaderSettings {
  defaultMode: "webtoon" | "pager";
  defaultDirection: "rtl" | "ltr";
  hideStatusBar: boolean;
  tapToTurnPage: boolean;
  fitMode: "width" | "height" | "auto";
  oledMode: boolean;
  blurNsfwCovers: boolean;
  // Advanced Reader: Dual-Page, Screen Filters & ThumbRail
  dualPageMode: boolean;
  colorFilter: "none" | "sepia" | "night" | "invert" | "high-contrast";
  readerBrightness: number;
  showThumbRail: boolean;
  // Catalog Grid Customization & UX
  catalogColumnsPhonePortrait: number;
  catalogColumnsPhoneLandscape: number;
  catalogColumnsTabletPortrait: number;
  catalogColumnsTabletLandscape: number;
  catalogMinCardWidth: number;
  infiniteScroll: boolean;
  respectActiveTags: boolean;
}

const defaultSettings: ReaderSettings = {
  defaultMode: "webtoon",
  defaultDirection: "rtl",
  hideStatusBar: true,
  tapToTurnPage: true,
  fitMode: "width",
  oledMode: false,
  blurNsfwCovers: false,
  dualPageMode: true,
  colorFilter: "none",
  readerBrightness: 1.0,
  showThumbRail: true,
  catalogColumnsPhonePortrait: 2,
  catalogColumnsPhoneLandscape: 3,
  catalogColumnsTabletPortrait: 4,
  catalogColumnsTabletLandscape: 5,
  catalogMinCardWidth: 130,
  infiniteScroll: true,
  respectActiveTags: true,
};

let currentSettings: ReaderSettings = { ...defaultSettings };
const listeners = new Set<() => void>();
const writes = createWriteQueue();

function notify() {
  for (const l of listeners) l();
}

async function loadReaderSettings() {
  await writes.flush();
  try {
    const raw = await AsyncStorage.getItem(READER_SETTINGS_STORAGE_KEY);
    if (raw) {
      currentSettings = { ...defaultSettings, ...JSON.parse(raw) };
      notify();
    }
  } catch {}
}

export const initReaderSettings = createInitOnce(loadReaderSettings);

export async function updateReaderSettings(patch: Partial<ReaderSettings>) {
  await initReaderSettings();
  currentSettings = { ...currentSettings, ...patch };
  notify();
  const serialized = JSON.stringify(currentSettings);
  await writes.enqueue(() => AsyncStorage.setItem(READER_SETTINGS_STORAGE_KEY, serialized));
}

export function getReaderSettings(): ReaderSettings {
  return currentSettings;
}

export function useReaderSettings() {
  const [settings, setSettings] = useState<ReaderSettings>(currentSettings);

  useEffect(() => {
    const update = () => setSettings({ ...currentSettings });
    listeners.add(update);
    initReaderSettings();
    return () => {
      listeners.delete(update);
    };
  }, []);

  return {
    settings,
    updateSettings: updateReaderSettings,
  };
}

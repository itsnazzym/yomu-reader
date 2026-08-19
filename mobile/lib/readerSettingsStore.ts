import AsyncStorage from "@react-native-async-storage/async-storage";
import { useState, useEffect } from "react";

const READER_SETTINGS_KEY = "@nhentai_reader_settings_v2";

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

function notify() {
  for (const l of listeners) l();
}

export async function initReaderSettings() {
  try {
    const raw = await AsyncStorage.getItem(READER_SETTINGS_KEY);
    if (raw) {
      currentSettings = { ...defaultSettings, ...JSON.parse(raw) };
      notify();
    }
  } catch {}
}

export async function updateReaderSettings(patch: Partial<ReaderSettings>) {
  currentSettings = { ...currentSettings, ...patch };
  notify();
  try {
    await AsyncStorage.setItem(READER_SETTINGS_KEY, JSON.stringify(currentSettings));
  } catch {}
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

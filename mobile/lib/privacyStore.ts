import AsyncStorage from "@react-native-async-storage/async-storage";
import { useState, useEffect } from "react";
import { createInitOnce, createWriteQueue } from "./persistQueue";

export const PRIVACY_STORAGE_KEY = "@nhentai_privacy_v1";

export interface PrivacySettings {
  incognito: boolean;
}

const defaultSettings: PrivacySettings = {
  incognito: false,
};

let currentSettings: PrivacySettings = { ...defaultSettings };
const listeners = new Set<() => void>();
const writes = createWriteQueue();

function notify(): void {
  for (const listener of listeners) listener();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function loadPrivacySettings(): Promise<void> {
  await writes.flush();
  try {
    const raw = await AsyncStorage.getItem(PRIVACY_STORAGE_KEY);
    if (!raw) return;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return;
    currentSettings = {
      incognito: parsed.incognito === true,
    };
    notify();
  } catch {
    // Keep defaults if storage is unavailable.
  }
}

export const initPrivacySettings = createInitOnce(loadPrivacySettings);

export function isIncognito(): boolean {
  return currentSettings.incognito;
}

export function getPrivacySettings(): PrivacySettings {
  return currentSettings;
}

export async function updatePrivacySettings(
  patch: Partial<PrivacySettings>
): Promise<void> {
  await initPrivacySettings();
  currentSettings = { ...currentSettings, ...patch };
  notify();
  const serialized = JSON.stringify(currentSettings);
  await writes.enqueue(() => AsyncStorage.setItem(PRIVACY_STORAGE_KEY, serialized));
}

export function usePrivacy(): {
  settings: PrivacySettings;
  incognito: boolean;
  setIncognito: (value: boolean) => Promise<void>;
} {
  const [settings, setSettings] = useState<PrivacySettings>(currentSettings);

  useEffect(() => {
    const update = (): void => {
      setSettings({ ...currentSettings });
    };
    listeners.add(update);
    void initPrivacySettings();
    return () => {
      listeners.delete(update);
    };
  }, []);

  return {
    settings,
    incognito: settings.incognito,
    setIncognito: (value: boolean) => updatePrivacySettings({ incognito: value }),
  };
}

void initPrivacySettings();

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { useEffect, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { createInitOnce, createWriteQueue } from "./persistQueue";

export const APP_LOCK_ENABLED_KEY = "@nhentai_app_lock_enabled_v1";
export const APP_LOCK_BIOMETRIC_KEY = "@nhentai_app_lock_biometric_v1";
const APP_LOCK_PIN_KEY = "nhentai_app_lock_pin_v1";

export interface AppLockSettings {
  enabled: boolean;
  biometric: boolean;
}

const defaultSettings: AppLockSettings = {
  enabled: false,
  biometric: false,
};

let currentSettings: AppLockSettings = { ...defaultSettings };
let unlocked = true;
let biometricPromptOpen = false;
const listeners = new Set<() => void>();
const writes = createWriteQueue();

function notify(): void {
  for (const listener of listeners) listener();
}

async function loadAppLock(): Promise<void> {
  await writes.flush();
  try {
    const [enabledRaw, biometricRaw] = await Promise.all([
      AsyncStorage.getItem(APP_LOCK_ENABLED_KEY),
      AsyncStorage.getItem(APP_LOCK_BIOMETRIC_KEY),
    ]);
    currentSettings = {
      enabled: enabledRaw === "1",
      biometric: biometricRaw === "1",
    };
    unlocked = !currentSettings.enabled;
    notify();
  } catch (error) {
    console.warn("[appLock] load failed:", error);
  }
}

export const initAppLock = createInitOnce(loadAppLock);

async function persistFlags(): Promise<void> {
  const enabled = currentSettings.enabled ? "1" : "0";
  const biometric = currentSettings.biometric ? "1" : "0";
  await writes.enqueue(async () => {
    await AsyncStorage.setItem(APP_LOCK_ENABLED_KEY, enabled);
    await AsyncStorage.setItem(APP_LOCK_BIOMETRIC_KEY, biometric);
  });
}

export function getAppLockSettings(): AppLockSettings {
  return currentSettings;
}

export function isAppUnlocked(): boolean {
  return unlocked;
}

export function lockApp(): void {
  if (!currentSettings.enabled) return;
  unlocked = false;
  notify();
}

export function unlockApp(): void {
  unlocked = true;
  notify();
}

export async function hasStoredPin(): Promise<boolean> {
  try {
    const pin = await SecureStore.getItemAsync(APP_LOCK_PIN_KEY);
    return Boolean(pin && pin.length >= 4);
  } catch {
    return false;
  }
}

export async function setAppLockPin(pin: string): Promise<boolean> {
  const clean = pin.replace(/\D/g, "");
  if (clean.length < 4 || clean.length > 8) return false;
  try {
    await SecureStore.setItemAsync(APP_LOCK_PIN_KEY, clean);
    return true;
  } catch (error) {
    console.warn("[appLock] pin write failed:", error);
    return false;
  }
}

export async function verifyAppLockPin(pin: string): Promise<boolean> {
  try {
    const stored = await SecureStore.getItemAsync(APP_LOCK_PIN_KEY);
    if (!stored) return false;
    return stored === pin.replace(/\D/g, "");
  } catch {
    return false;
  }
}

export async function updateAppLockSettings(
  patch: Partial<AppLockSettings>
): Promise<void> {
  await initAppLock();
  if (patch.enabled === true) {
    const hasPin = await hasStoredPin();
    if (!hasPin) {
      throw new Error("Définis un code PIN avant d'activer le verrouillage.");
    }
  }
  currentSettings = { ...currentSettings, ...patch };
  if (!currentSettings.enabled) {
    unlocked = true;
  }
  notify();
  await persistFlags();
}

export async function tryBiometricUnlock(): Promise<boolean> {
  if (!currentSettings.biometric) return false;
  try {
    biometricPromptOpen = true;
    const LocalAuth = await import("expo-local-authentication");
    const hasHardware = await LocalAuth.hasHardwareAsync();
    const enrolled = await LocalAuth.isEnrolledAsync();
    if (!hasHardware || !enrolled) return false;
    const result = await LocalAuth.authenticateAsync({
      promptMessage: "Déverrouiller Yomu Reader",
      cancelLabel: "Code PIN",
      disableDeviceFallback: true,
    });
    if (result.success) {
      unlockApp();
      return true;
    }
    return false;
  } catch (error) {
    console.warn("[appLock] biometric failed:", error);
    return false;
  } finally {
    biometricPromptOpen = false;
  }
}

export async function unlockWithPin(pin: string): Promise<boolean> {
  const ok = await verifyAppLockPin(pin);
  if (ok) unlockApp();
  return ok;
}

function onAppState(next: AppStateStatus): void {
  if (next !== "active" && currentSettings.enabled && !biometricPromptOpen) {
    lockApp();
  }
}

AppState.addEventListener("change", onAppState);

export function useAppLock(): {
  enabled: boolean;
  biometric: boolean;
  unlocked: boolean;
  setEnabled: (value: boolean) => Promise<void>;
  setBiometric: (value: boolean) => Promise<void>;
  setPin: typeof setAppLockPin;
  unlockWithPin: typeof unlockWithPin;
  tryBiometricUnlock: typeof tryBiometricUnlock;
  lock: typeof lockApp;
} {
  const [settings, setSettings] = useState<AppLockSettings>(currentSettings);
  const [isUnlocked, setIsUnlocked] = useState(unlocked);

  useEffect(() => {
    const update = (): void => {
      setSettings({ ...currentSettings });
      setIsUnlocked(unlocked);
    };
    listeners.add(update);
    void initAppLock();
    return () => {
      listeners.delete(update);
    };
  }, []);

  return {
    enabled: settings.enabled,
    biometric: settings.biometric,
    unlocked: isUnlocked,
    setEnabled: (value: boolean) => updateAppLockSettings({ enabled: value }),
    setBiometric: (value: boolean) => updateAppLockSettings({ biometric: value }),
    setPin: setAppLockPin,
    unlockWithPin,
    tryBiometricUnlock,
    lock: lockApp,
  };
}

void initAppLock();

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
let unlocked = false;
let ready = false;
let loadError: string | null = null;
let failedPinAttempts = 0;
let pinRetryAt = 0;
let biometricPromptOpen = false;
const listeners = new Set<() => void>();
const writes = createWriteQueue();

function notify(): void {
  for (const listener of listeners) listener();
}

async function loadAppLock(): Promise<void> {
  ready = false;
  unlocked = false;
  loadError = null;
  notify();
  try {
    await writes.flush();
    const [enabledRaw, biometricRaw] = await Promise.all([
      AsyncStorage.getItem(APP_LOCK_ENABLED_KEY),
      AsyncStorage.getItem(APP_LOCK_BIOMETRIC_KEY),
    ]);
    currentSettings = {
      enabled: enabledRaw === "1",
      biometric: biometricRaw === "1",
    };
    unlocked = !currentSettings.enabled;
    ready = true;
    notify();
  } catch (error) {
    loadError = "Impossible de vérifier le verrouillage. Réessayez.";
    notify();
    throw error;
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
  return ready && unlocked;
}

export function lockApp(): void {
  if (!currentSettings.enabled) return;
  unlocked = false;
  notify();
}

export function unlockApp(): void {
  if (!ready) return;
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
  if (Date.now() < pinRetryAt) return false;
  try {
    const stored = await SecureStore.getItemAsync(APP_LOCK_PIN_KEY);
    if (!stored) return false;
    const ok = /^\d{4,8}$/.test(pin) && stored === pin;
    if (ok) { failedPinAttempts = 0; pinRetryAt = 0; }
    else {
      failedPinAttempts++;
      if (failedPinAttempts >= 5) pinRetryAt = Date.now() + Math.min(300000, 1000 * 2 ** Math.min(failedPinAttempts - 5, 8));
    }
    return ok;
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
  if (!ready || !currentSettings.enabled || !currentSettings.biometric) return false;
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
  ready: boolean;
  error: string | null;
  retry: () => Promise<void>;
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
  const [loadState, setLoadState] = useState({ ready, error: loadError });

  useEffect(() => {
    const update = (): void => {
      setSettings({ ...currentSettings });
      setIsUnlocked(unlocked);
      setLoadState({ ready, error: loadError });
    };
    listeners.add(update);
    void initAppLock().catch(() => {});
    return () => {
      listeners.delete(update);
    };
  }, []);

  return {
    ...loadState,
    retry: () => initAppLock(true),
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

void initAppLock().catch(() => {});

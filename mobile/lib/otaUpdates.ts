/**
 * OTA JS via expo-updates — kill-switch Settings.
 *
 * app.json `extra.eas.projectId` / `updates.url` remain REPLACE_WITH_EAS_PROJECT_ID
 * until you create an EAS project and paste the real UUID (do not commit secrets).
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { Alert, Platform } from "react-native";
import { createInitOnce, createWriteQueue } from "./persistQueue";

export const OTA_ENABLED_STORAGE_KEY = "@nhentai_ota_updates_enabled_v1";

let otaEnabled = true;
let otaReady = false;
const listeners = new Set<() => void>();
const writes = createWriteQueue();

function notify(): void {
  for (const listener of listeners) listener();
}

async function loadOtaSettings(): Promise<void> {
  await writes.flush();
  try {
    const raw = await AsyncStorage.getItem(OTA_ENABLED_STORAGE_KEY);
    if (raw === "0" || raw === "false") {
      otaEnabled = false;
    } else if (raw === "1" || raw === "true") {
      otaEnabled = true;
    }
  } catch (err) {
    console.warn("[ota] load failed:", err);
  } finally {
    otaReady = true;
    notify();
  }
}

export const initOtaSettings = createInitOnce(loadOtaSettings);

export function isOtaEnabled(): boolean {
  return otaEnabled;
}

export async function setOtaEnabled(enabled: boolean): Promise<void> {
  await initOtaSettings();
  otaEnabled = enabled;
  notify();
  try {
    await writes.enqueue(() =>
      AsyncStorage.setItem(OTA_ENABLED_STORAGE_KEY, enabled ? "1" : "0")
    );
  } catch (err) {
    console.warn("[ota] persist failed:", err);
  }
}

export function useOtaSettings(): {
  enabled: boolean;
  ready: boolean;
  setEnabled: (enabled: boolean) => Promise<void>;
} {
  const [enabled, setEnabledState] = useState(otaEnabled);
  const [ready, setReady] = useState(otaReady);

  useEffect(() => {
    const update = (): void => {
      setEnabledState(otaEnabled);
      setReady(otaReady);
    };
    listeners.add(update);
    void initOtaSettings();
    return () => {
      listeners.delete(update);
    };
  }, []);

  return {
    enabled,
    ready,
    setEnabled: setOtaEnabled,
  };
}

export async function checkForOtaUpdate(): Promise<void> {
  await initOtaSettings();
  if (!otaEnabled) {
    Alert.alert(
      "Mise à jour",
      "Les mises à jour OTA sont désactivées dans les paramètres."
    );
    return;
  }
  if (Platform.OS === "web") {
    Alert.alert("Mise à jour", "Les mises à jour OTA ne sont pas disponibles sur le web.");
    return;
  }
  try {
    // Import dynamique : évite de casser le bundle si le module natif
    // n'est pas encore lié (dev client / Expo Go).
    const Updates = await import("expo-updates");
    if (!Updates.isEnabled) {
      Alert.alert(
        "Mise à jour",
        "Les mises à jour OTA sont désactivées dans cette build (dev ou Expo Go)."
      );
      return;
    }
    const result = await Updates.checkForUpdateAsync();
    if (!result.isAvailable) {
      Alert.alert("Mise à jour", "Vous êtes déjà à jour.");
      return;
    }
    Alert.alert(
      "Mise à jour disponible",
      "Télécharger et redémarrer l'application maintenant ?",
      [
        { text: "Plus tard", style: "cancel" },
        {
          text: "Mettre à jour",
          onPress: () => {
            void (async () => {
              try {
                await Updates.fetchUpdateAsync();
                await Updates.reloadAsync();
              } catch (err) {
                Alert.alert(
                  "Échec",
                  err instanceof Error ? err.message : "Impossible d'appliquer la mise à jour."
                );
              }
            })();
          },
        },
      ]
    );
  } catch (err) {
    Alert.alert(
      "Mise à jour",
      err instanceof Error ? err.message : "Vérification impossible."
    );
  }
}

/**
 * Vérification silencieuse (pas d'alerte si déjà à jour). Respecte le kill-switch.
 * Au plus une fois toutes les 30 minutes (foreground).
 */
let lastAutoCheckAt = 0;
const AUTO_CHECK_COOLDOWN_MS = 30 * 60 * 1000;

export async function maybeAutoCheckOtaUpdate(): Promise<void> {
  await initOtaSettings();
  if (!otaEnabled || Platform.OS === "web") return;
  const now = Date.now();
  if (now - lastAutoCheckAt < AUTO_CHECK_COOLDOWN_MS) return;
  lastAutoCheckAt = now;
  try {
    const Updates = await import("expo-updates");
    if (!Updates.isEnabled) return;
    const result = await Updates.checkForUpdateAsync();
    if (!result.isAvailable) return;
    Alert.alert(
      "Mise à jour disponible",
      "Télécharger et redémarrer l'application maintenant ?",
      [
        { text: "Plus tard", style: "cancel" },
        {
          text: "Mettre à jour",
          onPress: () => {
            void (async () => {
              try {
                await Updates.fetchUpdateAsync();
                await Updates.reloadAsync();
              } catch (err) {
                console.warn("[ota] auto apply failed:", err);
              }
            })();
          },
        },
      ]
    );
  } catch (err) {
    console.warn("[ota] auto-check skipped:", err);
  }
}

void initOtaSettings();

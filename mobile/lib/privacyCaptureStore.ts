/**
 * Préférence « Bloquer les captures d'écran ».
 *
 * Activée par défaut (contenu NSFW) : FLAG_SECURE Android bloque les captures
 * d'écran ET la vignette dans le sélecteur d'applications. La préférence est
 * persistée dans AsyncStorage et consommée par usePrivacyGuard (_layout).
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState, useSyncExternalStore } from "react";

const PRIVACY_CAPTURE_KEY = "@nhentai_privacy_screen_capture_v1";

let preventCapture = true;
let loaded = false;
const listeners = new Set<() => void>();

function notify(): void {
  for (const l of listeners) l();
}

export async function initPrivacyCaptureStore(): Promise<void> {
  if (loaded) return;
  loaded = true;
  try {
    const raw = await AsyncStorage.getItem(PRIVACY_CAPTURE_KEY);
    if (raw === "false") preventCapture = false;
    else if (raw === "true") preventCapture = true;
  } catch {
    // Défaut ON si le stockage est indisponible.
  }
  notify();
}

export function setPreventScreenCapture(value: boolean): void {
  preventCapture = value;
  loaded = true;
  notify();
  void AsyncStorage.setItem(PRIVACY_CAPTURE_KEY, String(value)).catch(() => {});
}

export function getPreventScreenCapture(): boolean {
  return preventCapture;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Hook réactif (useSyncExternalStore). */
export function usePreventScreenCapture(): boolean {
  return useSyncExternalStore(subscribe, getPreventScreenCapture, getPreventScreenCapture);
}

/**
 * Applique FLAG_SECURE tant que la préférence est active. À monter une seule
 * fois à la racine. `preventScreenCaptureAsync(key)` est idempotent côté natif
 * ; le cleanup retire le flag uniquement si ce hook était le dernier détenteur.
 */
export function usePrivacyGuard(): void {
  const enabled = usePreventScreenCapture();
  const [ready, setReady] = useState(loaded);
  useEffect(() => {
    if (!loaded) {
      void initPrivacyCaptureStore().then(() => setReady(true));
    }
  }, []);
  useEffect(() => {
    if (!ready || !enabled) return;
    let cancelled = false;
    void import("expo-screen-capture").then(({ preventScreenCaptureAsync }) => {
      if (!cancelled) void preventScreenCaptureAsync("privacy-guard");
    });
    return () => {
      cancelled = true;
      void import("expo-screen-capture").then(({ allowScreenCaptureAsync }) => {
        void allowScreenCaptureAsync("privacy-guard");
      });
    };
  }, [ready, enabled]);
}

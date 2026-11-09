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
let initialization: Promise<void> | null = null;
let nativeUpdate: Promise<void> = Promise.resolve();
const listeners = new Set<() => void>();

function notify(): void {
  for (const l of listeners) l();
}

export function initPrivacyCaptureStore(): Promise<void> {
  if (!initialization) {
    initialization = (async () => {
      try {
        const raw = await AsyncStorage.getItem(PRIVACY_CAPTURE_KEY);
        preventCapture = raw !== "false";
      } finally {
        loaded = true;
        notify();
      }
    })().catch(() => {});
  }
  return initialization;
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
    let mounted = true;
    void initPrivacyCaptureStore().then(() => { if (mounted) setReady(true); });
    return () => { mounted = false; };
  }, []);
  useEffect(() => {
    if (!ready) return;
    const apply = (prevent: boolean) => {
      nativeUpdate = nativeUpdate.catch(() => {}).then(async () => {
        const capture = await import("expo-screen-capture");
        if (prevent) await capture.preventScreenCaptureAsync("privacy-guard");
        else await capture.allowScreenCaptureAsync("privacy-guard");
      }).catch((error) => console.warn("[privacy] Protection des captures indisponible", error));
    };
    apply(enabled);
    return () => {
      apply(false);
    };
  }, [ready, enabled]);
}

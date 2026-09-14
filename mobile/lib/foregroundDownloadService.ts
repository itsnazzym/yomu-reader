/**
 * Foreground service natif pour les téléchargements (Android).
 *
 * Affiche une notification persistante (non-dismissable) avec la progression
 * globale de la file tant qu'au moins un téléchargement est actif. L'app peut
 * alors passer en arrière-plan sans que Android ne gèle les transferts.
 *
 * Prérequis natifs (module local DownloadForegroundService) :
 * - permissions FOREGROUND_SERVICE + FOREGROUND_SERVICE_DATA_SYNC ;
 * - service com.nhentaidownlo.mobile.DownloadForegroundService en dataSync.
 */

import { NativeModules, Platform } from "react-native";

export interface DownloadForegroundProgress {
  /** Galeries restantes dans la file (queued/downloading) */
  remainingGalleries: number;
  /** Pages téléchargées au total sur les galeries actives */
  downloadedPages: number;
  /** Pages totales des galeries actives */
  totalPages: number;
}

type NativeDownloadNotification = {
  start(progress: DownloadForegroundProgress): Promise<void>;
  update(progress: DownloadForegroundProgress): Promise<void>;
  stop(): Promise<void>;
};

const native = NativeModules.YomuDownloadNotification as NativeDownloadNotification | undefined;

function requireNative(): NativeDownloadNotification | null {
  // Expo Go and web deliberately degrade to in-app downloads; the release APK
  // contains the local Android module registered in MainApplication.
  return Platform.OS === "android" ? native ?? null : null;
}

/**
 * Démarre le foreground service. À appeler uniquement depuis une interaction
 * utilisateur visible (Android 14+ interdit de démarrer un FGS dataSync
 * depuis l'arrière-plan) — notre cas : l'utilisateur a ajouté/resumé des
 * téléchargements dans l'app.
 */
export async function startDownloadForeground(
  progress: DownloadForegroundProgress
): Promise<void> {
  await requireNative()?.start(progress);
}

/** Met à jour la progression (throttlé par l'appelant, ~1x/s max). */
export async function updateDownloadForeground(
  progress: DownloadForegroundProgress
): Promise<void> {
  await requireNative()?.update(progress);
}

/** Arrête le foreground service et retire la notification persistante. */
export async function stopDownloadForeground(): Promise<void> {
  await requireNative()?.stop();
}

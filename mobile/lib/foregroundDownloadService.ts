/**
 * Foreground service natif pour les téléchargements (Android).
 *
 * Affiche une notification persistante (non-dismissable) avec la progression
 * globale de la file tant qu'au moins un téléchargement est actif. L'app peut
 * alors passer en arrière-plan sans que Android ne gèle les transferts.
 *
 * Prérequis natifs (voir plugins/withNotifeeDataSync.js) :
 * - permissions FOREGROUND_SERVICE + FOREGROUND_SERVICE_DATA_SYNC ;
 * - service app.notifee.core.ForegroundService en foregroundServiceType=dataSync.
 */

import notifee, {
  AndroidImportance,
  type Notification,
} from "@notifee/react-native";

const CHANNEL_ID = "downloads";
const NOTIFICATION_ID = "yomu-download-fgs";

export interface DownloadForegroundProgress {
  /** Galeries restantes dans la file (queued/downloading) */
  remainingGalleries: number;
  /** Pages téléchargées au total sur les galeries actives */
  downloadedPages: number;
  /** Pages totales des galeries actives */
  totalPages: number;
}

let channelCreated = false;

async function ensureChannel(): Promise<void> {
  if (channelCreated) return;
  await notifee.createChannel({
    id: CHANNEL_ID,
    name: "Téléchargements",
    importance: AndroidImportance.LOW,
  });
  channelCreated = true;
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
  await ensureChannel();
  const notification: Notification = {
    id: NOTIFICATION_ID,
    title: "Téléchargement en cours",
    body: downloadForegroundText(progress),
    android: {
      channelId: CHANNEL_ID,
      asForegroundService: true,
      ongoing: true,
      onlyAlertOnce: true,
      progress: {
        max: Math.max(progress.totalPages, 1),
        current: progress.downloadedPages,
        indeterminate: progress.totalPages <= 0,
      },
      smallIcon: "ic_launcher",
    },
  };
  await notifee.displayNotification(notification);
}

/** Met à jour la progression (throttlé par l'appelant, ~1x/s max). */
export async function updateDownloadForeground(
  progress: DownloadForegroundProgress
): Promise<void> {
  await ensureChannel();
  await notifee.displayNotification({
    id: NOTIFICATION_ID,
    title: "Téléchargement en cours",
    body: downloadForegroundText(progress),
    android: {
      channelId: CHANNEL_ID,
      asForegroundService: true,
      ongoing: true,
      onlyAlertOnce: true,
      progress: {
        max: Math.max(progress.totalPages, 1),
        current: progress.downloadedPages,
        indeterminate: progress.totalPages <= 0,
      },
      smallIcon: "ic_launcher",
    },
  });
}

/** Arrête le foreground service et retire la notification persistante. */
export async function stopDownloadForeground(): Promise<void> {
  try {
    await notifee.stopForegroundService();
  } catch {
    // Service déjà arrêté (cas normal si aucun FGS n'était actif).
  }
  await notifee.cancelNotification(NOTIFICATION_ID).catch(() => {});
}

function downloadForegroundText(p: DownloadForegroundProgress): string {
  const galleries =
    p.remainingGalleries === 1
      ? "1 galerie restante"
      : `${p.remainingGalleries} galeries restantes`;
  if (p.totalPages > 0) {
    return `${galleries} · ${p.downloadedPages}/${p.totalPages} pages`;
  }
  return galleries;
}

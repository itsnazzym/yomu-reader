/**
 * Local download notifications. May no-op in Expo Go — the APK / dev client
 * is required for a visible system notification on Android 13+.
 */

let channelReady = false;

async function getNotificationsModule(): Promise<
  typeof import("expo-notifications") | null
> {
  try {
    return await import("expo-notifications");
  } catch {
    return null;
  }
}

async function ensureAndroidChannel(
  Notifications: typeof import("expo-notifications")
): Promise<void> {
  if (channelReady) return;
  try {
    await Notifications.setNotificationChannelAsync("downloads", {
      name: "Téléchargements",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
    channelReady = true;
  } catch (error) {
    console.warn("[downloadNotifications] Channel setup failed:", error);
  }
}

export async function notifyDownloadFinished(params: {
  title: string;
  ok: boolean;
  errorMessage?: string;
}): Promise<void> {
  try {
    const Notifications = await getNotificationsModule();
    if (!Notifications) return;
    await ensureAndroidChannel(Notifications);
    await Notifications.scheduleNotificationAsync({
      content: {
        title: params.ok ? "Téléchargement terminé" : "Échec du téléchargement",
        body: params.ok
          ? params.title
          : `${params.title} — ${params.errorMessage || "erreur"}`,
        sound: false,
      },
      trigger: null,
    });
  } catch (error) {
    console.warn("[downloadNotifications] Post failed:", error);
  }
}

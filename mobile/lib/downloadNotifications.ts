/**
 * Completion notifications implemented by the small in-tree Android module.
 */

import { NativeModules, Platform } from "react-native";

type NativeDownloadNotification = {
  notifyCompleted(title: string, ok: boolean, error: string | null): Promise<void>;
};

export async function notifyDownloadFinished(params: {
  title: string;
  ok: boolean;
  errorMessage?: string;
}): Promise<void> {
  try {
    if (Platform.OS !== "android") return;
    const native = NativeModules.YomuDownloadNotification as NativeDownloadNotification | undefined;
    await native?.notifyCompleted(params.title, params.ok, params.errorMessage ?? null);
  } catch (error) {
    console.warn("[downloadNotifications] Post failed:", error);
  }
}

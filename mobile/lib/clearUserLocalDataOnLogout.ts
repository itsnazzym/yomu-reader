import AsyncStorage from "@react-native-async-storage/async-storage";
import { removeCloudFavorites } from "./favoritesStore";

const KEYS: string[] = [
  "bookFavoritesOnline.v1",
  "searchHistory",
  "@online.imported.cache",
  "@online.pendingFavorites.queue",
  "tagRecents.v1",
  "tagCollections.v1",
  "comments.cache",
  "profile.me",
  "nh.me",
  "@nhentai_account_session_v1",
];

export async function clearUserLocalDataOnLogout(): Promise<void> {
  try {
    await Promise.all([
      AsyncStorage.multiRemove(KEYS),
      removeCloudFavorites(),
    ]);
  } catch (e) {
    console.warn("[auth] Failed to clear user local data:", e);
  }
}

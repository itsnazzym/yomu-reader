import AsyncStorage from "@react-native-async-storage/async-storage";

const KEYS: string[] = [
  "bookFavorites",
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
    await AsyncStorage.multiRemove(KEYS);
  } catch (e) {
    console.warn("[auth] Failed to clear user local data:", e);
  }
}

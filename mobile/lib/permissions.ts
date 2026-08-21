import { Platform, PermissionsAndroid, Linking } from "react-native";

export interface PermissionStatus {
  storageGranted: boolean;
  notificationsGranted: boolean;
  canAskAgain: boolean;
}

export async function checkStoragePermissions(): Promise<boolean> {
  if (Platform.OS !== "android") return true;

  const apiLevel = Number(Platform.Version);

  // Android 13+ (API 33+) Scoped storage
  if (apiLevel >= 33) {
    try {
      const readMedia = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES
      );
      return readMedia;
    } catch {
      return false;
    }
  }

  // Android 6 to 12 (API 23 - 32)
  try {
    const read = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE
    );
    const write = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE
    );
    return read && write;
  } catch {
    return false;
  }
}

export async function requestStoragePermissions(): Promise<boolean> {
  if (Platform.OS !== "android") return true;

  const apiLevel = Number(Platform.Version);

  // Android 13+ (API 33+)
  if (apiLevel >= 33) {
    try {
      const res = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
        {
          title: "Accès aux fichiers et médias",
          message:
            "L'application a besoin d'accéder au stockage pour enregistrer et lire vos mangas hors-ligne.",
          buttonPositive: "Autoriser",
          buttonNegative: "Refuser",
        }
      );
      return res === PermissionsAndroid.RESULTS.GRANTED;
    } catch {
      return false;
    }
  }

  // Android 6 à 12
  try {
    const results = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
      PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
    ]);

    const readOk =
      results[PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE] ===
      PermissionsAndroid.RESULTS.GRANTED;
    const writeOk =
      results[PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE] ===
      PermissionsAndroid.RESULTS.GRANTED;

    return readOk && writeOk;
  } catch {
    return false;
  }
}

export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS !== "android") return true;

  const apiLevel = Number(Platform.Version);
  if (apiLevel < 33) return true; // Les notifications sont accordées par défaut avant Android 13

  try {
    const res = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      {
        title: "Notifications de téléchargement",
        message:
          "Autorisez les notifications pour suivre l'avancement de vos téléchargements de mangas en arrière-plan.",
        buttonPositive: "Autoriser",
        buttonNegative: "Plus tard",
      }
    );
    return res === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

export function openAppSettings() {
  Linking.openSettings().catch(() => {});
}

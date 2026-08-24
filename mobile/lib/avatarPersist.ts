import { Alert } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import { getDownloadSettings } from "./downloadSettingsStore";
import {
  copySafFileToSandbox,
  requestDownloadDirectory,
  writeFileToSafTree,
} from "./safCopy";

export const LOCAL_AVATAR_FILENAME = "yomu_avatar.png";

export function getLocalAvatarSandboxUri(): string {
  return `${FileSystem.documentDirectory || ""}avatars/${LOCAL_AVATAR_FILENAME}`;
}

export function displayAvatarUri(session: {
  localAvatarUri?: string;
  profile?: { avatar_url?: string };
  username?: string;
}): string | undefined {
  if (session.localAvatarUri && session.localAvatarUri.trim() !== "") {
    return session.localAvatarUri;
  }
  if (session.profile?.avatar_url && session.profile.avatar_url.trim() !== "") {
    return session.profile.avatar_url;
  }
  return undefined;
}

async function ensureAvatarDir(): Promise<string> {
  const avatarDir = `${FileSystem.documentDirectory || ""}avatars/`;
  const info = await FileSystem.getInfoAsync(avatarDir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(avatarDir, { intermediates: true });
  }
  return avatarDir;
}

async function promptForSafDirectory(): Promise<string | null> {
  return new Promise((resolve) => {
    Alert.alert(
      "Conserver l'avatar",
      "Choisissez un dossier de téléchargement public pour garder votre photo après une réinstallation. Après réinstall, re-sélectionnez le même dossier pour la restaurer.",
      [
        {
          text: "Plus tard",
          style: "cancel",
          onPress: () => resolve(null),
        },
        {
          text: "Choisir un dossier",
          onPress: () => {
            void (async () => {
              try {
                const uri = await requestDownloadDirectory();
                if (uri) {
                  const { updateDownloadSettings } = await import("./downloadSettingsStore");
                  await updateDownloadSettings({
                    mode: "saf",
                    safDirectoryUri: uri,
                    rememberFolder: true,
                  });
                }
                resolve(uri);
              } catch {
                resolve(null);
              }
            })();
          },
        },
      ]
    );
  });
}

async function resolveSafTreeForPersist(): Promise<string | null> {
  const settings = getDownloadSettings();
  if (settings.mode === "saf" && settings.safDirectoryUri) {
    return settings.safDirectoryUri;
  }
  return promptForSafDirectory();
}

/**
 * Copy a cropped/local avatar into the sandbox as yomu_avatar.png,
 * optionally mirroring it into the public SAF download folder.
 */
export async function persistLocalAvatar(sourceUri: string): Promise<string> {
  if (!sourceUri || sourceUri.trim() === "") {
    throw new Error("URI d'avatar manquante.");
  }

  await ensureAvatarDir();
  const destUri = getLocalAvatarSandboxUri();

  try {
    await FileSystem.copyAsync({ from: sourceUri, to: destUri });
  } catch {
    const payload = await FileSystem.readAsStringAsync(sourceUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    await FileSystem.writeAsStringAsync(destUri, payload, {
      encoding: FileSystem.EncodingType.Base64,
    });
  }

  try {
    const treeUri = await resolveSafTreeForPersist();
    if (treeUri) {
      await writeFileToSafTree(treeUri, LOCAL_AVATAR_FILENAME, destUri);
    }
  } catch (err: unknown) {
    console.warn("[avatarPersist] SAF mirror failed:", err);
  }

  return destUri;
}

/**
 * Restore yomu_avatar.png from a SAF tree into the sandbox when the sandbox copy is missing.
 */
export async function restoreLocalAvatarFromSaf(treeUri: string): Promise<string | null> {
  if (!treeUri || treeUri.trim() === "") return null;

  try {
    const destUri = getLocalAvatarSandboxUri();
    const info = await FileSystem.getInfoAsync(destUri);
    if (info.exists && !info.isDirectory) {
      return destUri;
    }

    await ensureAvatarDir();
    const copied = await copySafFileToSandbox(treeUri, LOCAL_AVATAR_FILENAME, destUri);
    if (!copied) return null;

    const restored = await FileSystem.getInfoAsync(destUri);
    if (!restored.exists || restored.isDirectory) return null;
    return destUri;
  } catch (err: unknown) {
    console.warn("[avatarPersist] restore from SAF failed:", err);
    return null;
  }
}

export async function readLocalAvatarBase64(): Promise<{
  base64: string;
  mime: string;
} | null> {
  try {
    const uri = getLocalAvatarSandboxUri();
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists || info.isDirectory) return null;
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return { base64, mime: "image/png" };
  } catch {
    return null;
  }
}

export async function writeLocalAvatarFromBase64(
  base64: string,
  _mime?: string
): Promise<string> {
  if (!base64 || base64.trim() === "") {
    throw new Error("Données avatar manquantes.");
  }
  await ensureAvatarDir();
  const destUri = getLocalAvatarSandboxUri();
  await FileSystem.writeAsStringAsync(destUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return destUri;
}

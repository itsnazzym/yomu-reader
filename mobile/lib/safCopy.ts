import * as FileSystem from "expo-file-system";
import { libraryRoot } from "./localLibrary";

function mimeForName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".json")) return "application/json";
  return "image/jpeg";
}

async function listReadableFiles(dirUri: string): Promise<string[]> {
  const names = await FileSystem.readDirectoryAsync(dirUri);
  return names.filter((name) => !name.endsWith(".part") && name !== "." && name !== "..");
}

/**
 * Copy a completed sandbox gallery into a user-chosen SAF tree.
 * The sandbox copy remains the source of truth for the in-app reader.
 */
export async function copyLocalGalleryToSaf(
  localId: string,
  treeUri: string
): Promise<void> {
  if (!treeUri || !localId) return;

  const sourceDir = `${libraryRoot()}${localId}`;
  const info = await FileSystem.getInfoAsync(sourceDir);
  if (!info.exists) {
    throw new Error("Galerie locale introuvable pour la copie.");
  }

  const saf = FileSystem.StorageAccessFramework;
  const folderUri = await saf.makeDirectoryAsync(treeUri, localId);
  const files = await listReadableFiles(sourceDir);

  for (const name of files) {
    const from = `${sourceDir}/${name}`;
    const fileInfo = await FileSystem.getInfoAsync(from);
    if (!fileInfo.exists || fileInfo.isDirectory) continue;

    const destUri = await saf.createFileAsync(folderUri, name, mimeForName(name));
    const payload = await FileSystem.readAsStringAsync(from, {
      encoding: FileSystem.EncodingType.Base64,
    });
    await FileSystem.writeAsStringAsync(destUri, payload, {
      encoding: FileSystem.EncodingType.Base64,
    });
  }
}

export async function requestDownloadDirectory(): Promise<string | null> {
  try {
    const result = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
    if (!result.granted || !result.directoryUri) return null;
    return result.directoryUri;
  } catch {
    return null;
  }
}

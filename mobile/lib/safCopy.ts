import * as FileSystem from "expo-file-system/legacy";
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

function findSafEntryByFileName(entries: string[], fileName: string): string | undefined {
  const lower = fileName.toLowerCase();
  return entries.find((entry) => {
    const decoded = (() => {
      try {
        return decodeURIComponent(entry);
      } catch {
        return entry;
      }
    })();
    const leaf = decoded.split("/").pop() || decoded;
    return (
      leaf.toLowerCase() === lower ||
      decoded.toLowerCase().endsWith(`/${lower}`) ||
      decoded.toLowerCase().includes(lower)
    );
  });
}

/**
 * Write a local file into a SAF directory tree (replacing an existing same-name file when possible).
 */
export async function writeFileToSafTree(
  treeUri: string,
  fileName: string,
  fromUri: string
): Promise<void> {
  if (!treeUri || !fileName || !fromUri) {
    throw new Error("Paramètres SAF incomplets.");
  }

  const saf = FileSystem.StorageAccessFramework;

  try {
    const names = await saf.readDirectoryAsync(treeUri);
    const existing = findSafEntryByFileName(names, fileName);
    if (existing) {
      await FileSystem.deleteAsync(existing, { idempotent: true }).catch(() => undefined);
    }
  } catch {
    // Listing/deleting is best-effort; create may still succeed.
  }

  const payload = await FileSystem.readAsStringAsync(fromUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const writePayload = async (destUri: string): Promise<void> => {
    await FileSystem.writeAsStringAsync(destUri, payload, {
      encoding: FileSystem.EncodingType.Base64,
    });
  };

  try {
    const destUri = await saf.createFileAsync(treeUri, fileName, mimeForName(fileName));
    await writePayload(destUri);
  } catch (firstError: unknown) {
    try {
      const names = await saf.readDirectoryAsync(treeUri);
      const existing = findSafEntryByFileName(names, fileName);
      if (existing) {
        await FileSystem.deleteAsync(existing, { idempotent: true }).catch(() => undefined);
      }
      const destUri = await saf.createFileAsync(treeUri, fileName, mimeForName(fileName));
      await writePayload(destUri);
    } catch {
      const message =
        firstError instanceof Error ? firstError.message : "Écriture SAF impossible.";
      throw new Error(message);
    }
  }
}

/**
 * Copy a named file from a SAF tree into a sandbox file:// destination.
 * Returns true when the file was found and written.
 */
export async function copySafFileToSandbox(
  treeUri: string,
  fileName: string,
  destUri: string
): Promise<boolean> {
  if (!treeUri || !fileName || !destUri) return false;

  try {
    const names = await FileSystem.StorageAccessFramework.readDirectoryAsync(treeUri);
    const match = findSafEntryByFileName(names, fileName);
    if (!match) return false;

    const payload = await FileSystem.readAsStringAsync(match, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const parentSlash = destUri.lastIndexOf("/");
    if (parentSlash > 0) {
      const parentDir = destUri.slice(0, parentSlash + 1);
      const parentInfo = await FileSystem.getInfoAsync(parentDir);
      if (!parentInfo.exists) {
        await FileSystem.makeDirectoryAsync(parentDir, { intermediates: true });
      }
    }

    await FileSystem.writeAsStringAsync(destUri, payload, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return true;
  } catch {
    return false;
  }
}

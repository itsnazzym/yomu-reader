import * as FileSystem from "expo-file-system/legacy";
import { Image } from "expo-image";
import { libraryRoot } from "./localLibrary";
import { clearSourceGalleryCache } from "./sources/galleryLoader";

export interface FileInfoWithSize {
  exists: boolean;
  isDirectory?: boolean;
  size?: number;
  uri?: string;
}

export interface StorageBucket {
  key: string;
  label: string;
  path: string;
  sizeBytes: number;
}

export interface StorageBreakdown {
  expoCacheBytes: number;
  libraryBytes: number;
  totalBytes: number;
  topConsumers: StorageBucket[];
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 Mo";
  const k = 1024;
  const dm = 1;
  const sizes = ["Octets", "Ko", "Mo", "Go"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

function readSize(info: FileSystem.FileInfo): number {
  if (!info.exists) return 0;
  if ("size" in info && typeof info.size === "number") {
    return info.size;
  }
  return 0;
}

/**
 * Parcours récursif sans `any` — somme des FileInfo.size.
 */
export async function getDirectorySizeRecursive(dirUri: string): Promise<number> {
  try {
    const info = await FileSystem.getInfoAsync(dirUri);
    if (!info.exists) return 0;
    if (!info.isDirectory) {
      return readSize(info);
    }
    const entries = await FileSystem.readDirectoryAsync(dirUri);
    let total = 0;
    for (const name of entries) {
      const child = dirUri.endsWith("/") ? `${dirUri}${name}` : `${dirUri}/${name}`;
      try {
        const childInfo = await FileSystem.getInfoAsync(child);
        if (!childInfo.exists) continue;
        if (childInfo.isDirectory) {
          total += await getDirectorySizeRecursive(
            child.endsWith("/") ? child : `${child}/`
          );
        } else {
          total += readSize(childInfo);
        }
      } catch {
        // Fichier verrouillé / disparu : ignorer.
      }
    }
    return total;
  } catch {
    return 0;
  }
}

export async function getCacheSize(): Promise<number> {
  try {
    const cacheDir = FileSystem.cacheDirectory;
    if (!cacheDir) return 0;
    return getDirectorySizeRecursive(cacheDir);
  } catch {
    return 0;
  }
}

export async function listLibraryFolderSizes(
  limit = 12
): Promise<StorageBucket[]> {
  try {
    const root = libraryRoot();
    const info = await FileSystem.getInfoAsync(root);
    if (!info.exists) return [];
    const entries = await FileSystem.readDirectoryAsync(root);
    const buckets: StorageBucket[] = [];
    for (const name of entries) {
      const path = `${root}${name}/`;
      try {
        const sizeBytes = await getDirectorySizeRecursive(path);
        if (sizeBytes <= 0) continue;
        buckets.push({
          key: name,
          label: name.length > 42 ? `${name.slice(0, 40)}…` : name,
          path,
          sizeBytes,
        });
      } catch {
        // ignore
      }
    }
    buckets.sort((a, b) => b.sizeBytes - a.sizeBytes);
    return buckets.slice(0, limit);
  } catch {
    return [];
  }
}

export async function getStorageBreakdown(): Promise<StorageBreakdown> {
  const cacheDir = FileSystem.cacheDirectory || "";
  const [expoCacheBytes, topConsumers] = await Promise.all([
    cacheDir ? getDirectorySizeRecursive(cacheDir) : Promise.resolve(0),
    listLibraryFolderSizes(15),
  ]);
  const libraryBytes = topConsumers.reduce((sum, b) => sum + b.sizeBytes, 0);
  // Si plus de 15 dossiers, recalculer le total lib via root
  let libTotal = libraryBytes;
  try {
    const root = libraryRoot();
    const rootInfo = await FileSystem.getInfoAsync(root);
    if (rootInfo.exists) {
      libTotal = await getDirectorySizeRecursive(root);
    }
  } catch {
    // keep sum of top
  }
  return {
    expoCacheBytes,
    libraryBytes: libTotal,
    totalBytes: expoCacheBytes + libTotal,
    topConsumers,
  };
}

export async function clearAppCache(): Promise<boolean> {
  try {
    // expo-image possède ses propres caches Glide/SDWebImage ; supprimer
    // seulement cacheDirectory ne les purge pas toujours.
    const imageResults = await Promise.allSettled([
      Image.clearMemoryCache(),
      Image.clearDiskCache(),
    ]);
    clearSourceGalleryCache();
    const cacheDir = FileSystem.cacheDirectory;
    if (!cacheDir) {
      return imageResults.every((result) => result.status === "fulfilled");
    }
    const files = await FileSystem.readDirectoryAsync(cacheDir);
    for (const file of files) {
      try {
        await FileSystem.deleteAsync(`${cacheDir}${file}`, { idempotent: true });
      } catch {
        // ignore
      }
    }
    return imageResults.every((result) => result.status === "fulfilled");
  } catch {
    return false;
  }
}

export async function deleteStorageBucket(path: string): Promise<boolean> {
  try {
    if (!path || path.includes("..")) return false;
    await FileSystem.deleteAsync(path, { idempotent: true });
    return true;
  } catch (err) {
    console.warn("[cacheManager] delete bucket failed:", err);
    return false;
  }
}

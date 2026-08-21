import * as FileSystem from "expo-file-system";

export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 Mo";
  const k = 1024;
  const dm = 1;
  const sizes = ["Octets", "Ko", "Mo", "Go"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export async function getCacheSize(): Promise<number> {
  try {
    const cacheDir = FileSystem.cacheDirectory;
    if (!cacheDir) return 0;
    const dirInfo = await FileSystem.getInfoAsync(cacheDir);
    if (!dirInfo.exists) return 0;

    let totalSize = 0;
    const files = await FileSystem.readDirectoryAsync(cacheDir);
    for (const file of files) {
      try {
        const fileInfo = await FileSystem.getInfoAsync(`${cacheDir}${file}`);
        if (fileInfo.exists && (fileInfo as any).size) {
          totalSize += (fileInfo as any).size;
        }
      } catch {}
    }
    return totalSize;
  } catch {
    return 0;
  }
}

export async function clearAppCache(): Promise<boolean> {
  try {
    const cacheDir = FileSystem.cacheDirectory;
    if (!cacheDir) return true;
    const files = await FileSystem.readDirectoryAsync(cacheDir);
    for (const file of files) {
      try {
        await FileSystem.deleteAsync(`${cacheDir}${file}`, { idempotent: true });
      } catch {}
    }
    return true;
  } catch {
    return false;
  }
}

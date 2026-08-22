import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import type { Gallery } from "./api/types";
import { buildComicInfoXml, galleryDisplayTitle } from "./comicInfo";
import {
  isValidLocalId,
  libraryRoot,
  metadataPath,
  isValidLocalGalleryMetadata,
} from "./localLibrary";
import { base64ToBytes, bytesToBase64, buildZipStore, type ZipStoreEntry } from "./zipStore";

const PAGE_FILE_RE = /^Image(\d+)\.(jpg|jpeg|png|webp|gif)$/i;

export interface CbzExportResult {
  success: boolean;
  path?: string;
  pageCount: number;
  error?: string;
}

function sanitizeCbzBaseName(title: string, galleryId: number): string {
  const clean = (title || `gallery-${galleryId}`)
    .replace(/[\\/:*?"<>|]/g, "_")
    .trim()
    .slice(0, 80);
  return clean || `gallery-${galleryId}`;
}

function pageExt(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() || "jpg";
  if (ext === "jpeg") return "jpg";
  return ext;
}

export async function listLocalPageFiles(localId: string): Promise<string[]> {
  if (!isValidLocalId(localId)) return [];
  const dir = `${libraryRoot()}${localId}/`;
  let names: string[];
  try {
    names = await FileSystem.readDirectoryAsync(dir);
  } catch {
    return [];
  }
  return names
    .filter((name) => PAGE_FILE_RE.test(name))
    .sort((a, b) => {
      const na = Number(a.match(PAGE_FILE_RE)?.[1] || 0);
      const nb = Number(b.match(PAGE_FILE_RE)?.[1] || 0);
      return na - nb;
    });
}

async function readLocalGalleryMetadata(localId: string): Promise<Gallery | null> {
  try {
    const raw = await FileSystem.readAsStringAsync(metadataPath(localId));
    const parsed: unknown = JSON.parse(raw);
    if (!isValidLocalGalleryMetadata(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function exportLocalGalleryToCbz(
  localId: string
): Promise<CbzExportResult> {
  if (!isValidLocalId(localId)) {
    return { success: false, pageCount: 0, error: "Dossier local invalide" };
  }

  const gallery = await readLocalGalleryMetadata(localId);
  if (!gallery) {
    return { success: false, pageCount: 0, error: "Métadonnées introuvables" };
  }

  const pageFiles = await listLocalPageFiles(localId);
  if (pageFiles.length === 0) {
    return { success: false, pageCount: 0, error: "Aucune page locale à empaqueter" };
  }

  try {
    const entries: ZipStoreEntry[] = [
      {
        name: "ComicInfo.xml",
        data: new TextEncoder().encode(buildComicInfoXml(gallery)),
      },
    ];

    const dir = `${libraryRoot()}${localId}/`;
    for (const fileName of pageFiles) {
      const match = fileName.match(PAGE_FILE_RE);
      const pageNum = Number(match?.[1] || 0);
      const zipName = `${String(pageNum).padStart(3, "0")}.${pageExt(fileName)}`;
      const base64 = await FileSystem.readAsStringAsync(`${dir}${fileName}`, {
        encoding: FileSystem.EncodingType.Base64,
      });
      entries.push({ name: zipName, data: base64ToBytes(base64) });
    }

    const zipBytes = buildZipStore(entries);
    const cacheDir = FileSystem.cacheDirectory || FileSystem.documentDirectory || "";
    if (!cacheDir) {
      return { success: false, pageCount: pageFiles.length, error: "Cache indisponible" };
    }
    const fileName = `${sanitizeCbzBaseName(galleryDisplayTitle(gallery), gallery.id)}.cbz`;
    const path = `${cacheDir}${fileName}`;
    await FileSystem.writeAsStringAsync(path, bytesToBase64(zipBytes), {
      encoding: FileSystem.EncodingType.Base64,
    });
    return { success: true, path, pageCount: pageFiles.length };
  } catch (error: unknown) {
    return {
      success: false,
      pageCount: pageFiles.length,
      error: error instanceof Error ? error.message : "Échec de l'export CBZ",
    };
  }
}

export async function shareLocalGalleryCbz(localId: string): Promise<CbzExportResult> {
  const exported = await exportLocalGalleryToCbz(localId);
  if (!exported.success || !exported.path) return exported;
  try {
    const available = await Sharing.isAvailableAsync();
    if (!available) {
      return { ...exported, error: "Partage système indisponible" };
    }
    await Sharing.shareAsync(exported.path, {
      mimeType: "application/vnd.comicbook+zip",
      UTI: "public.zip-archive",
      dialogTitle: "Exporter le CBZ",
    });
    return exported;
  } catch (error: unknown) {
    return {
      ...exported,
      success: false,
      error: error instanceof Error ? error.message : "Partage annulé",
    };
  }
}

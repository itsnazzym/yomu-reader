import * as FileSystem from "expo-file-system";
import { Gallery } from "./api/types";

/**
 * Bibliothèque locale : accès unique aux galeries téléchargées.
 *
 * Layout disque (NHAppAndroid/) :
 *   <localId>/metadata.json  — Galerie complète (format nhentai) écrite par le worker
 *   <localId>/manifest.json  — manifeste versionné (identité stable + statut)
 *   <localId>/Image001.<ext> — pages (file://)
 *
 * Le localId (<galleryId>_<titre assaini>) EST l'identité stable : c'est le nom
 * de dossier, la clé de la bibliothèque et le paramètre /read. Les anciennes
 * galeries (sans manifest.json) restent lisibles : tout est dérivé de
 * metadata.json et du nom de dossier — inutile de migrer les fichiers.
 */

export const LIBRARY_DIR_NAME = "NHAppAndroid";

export interface LocalManifest {
  version: 1;
  localId: string;
  galleryId: number;
  title: string;
  /** "complete" = metadata.json écrit ; "partial" réservé à une reprise future */
  status: "complete" | "partial";
  updatedAt: number;
}

export interface LocalLibraryEntry {
  localId: string;
  galleryId: number;
  title: string;
  status: "complete" | "partial";
  gallery: Gallery;
  updatedAt: number;
  /** Taille du dossier au scan (non persistée). */
  sizeBytes: number;
}

export function libraryRoot(): string {
  return `${FileSystem.documentDirectory}${LIBRARY_DIR_NAME}/`;
}

export function manifestPath(localId: string): string {
  return `${libraryRoot()}${localId}/manifest.json`;
}

export function metadataPath(localId: string): string {
  return `${libraryRoot()}${localId}/metadata.json`;
}

/** Assainit un titre pour en faire un nom de dossier sûr (comportement historique). */
export function sanitizeTitle(title: string): string {
  return (title || "gallery").replace(/[\\/:*?"<>|]/g, "_").trim().slice(0, 80);
}

/** Identifiant stable d'une galerie locale (déterministe, = nom de dossier). */
export function makeLocalId(galleryId: number, title: string): string {
  return `${galleryId}_${sanitizeTitle(title)}`;
}

/**
 * Garde anti-traversée : un localId valide ne contient jamais de séparateur de
 * chemin ni ".." (il est produit par makeLocalId). Tout paramètre d'URL ou nom
 * de dossier étranger est rejeté avant de toucher au filesystem.
 */
export function isValidLocalId(id: unknown): id is string {
  if (typeof id !== "string" || !id || id.length > 120) return false;
  if (id === "." || id === ".." || id.includes("/") || id.includes("\\")) return false;
  return true;
}

export function isValidLocalGalleryMetadata(value: unknown): value is Gallery {
  if (!value || typeof value !== "object") return false;
  const gallery = value as Partial<Gallery>;
  if (!Number.isFinite(Number(gallery.id)) || Number(gallery.id) <= 0) return false;
  if (!gallery.title || typeof gallery.title !== "object") return false;
  if (!gallery.images || typeof gallery.images !== "object") return false;
  if (!Array.isArray(gallery.images.pages) || gallery.images.pages.length === 0) return false;
  return gallery.images.pages.every(
    (page) => Boolean(page) && typeof page.url === "string" && page.url.startsWith("file://")
  );
}

export async function writeLocalManifest(input: {
  localId: string;
  galleryId: number;
  title: string;
  status: "complete" | "partial";
}): Promise<void> {
  const manifest: LocalManifest = { version: 1, updatedAt: Date.now(), ...input };
  await FileSystem.writeAsStringAsync(manifestPath(input.localId), JSON.stringify(manifest), {
    encoding: FileSystem.EncodingType.UTF8,
  });
}

export async function readLocalManifest(localId: string): Promise<LocalManifest | null> {
  try {
    const info = await FileSystem.getInfoAsync(manifestPath(localId));
    if (!info.exists) return null;
    const raw = await FileSystem.readAsStringAsync(manifestPath(localId));
    const parsed = JSON.parse(raw);
    if (parsed?.version !== 1) return null;
    return parsed as LocalManifest;
  } catch {
    return null;
  }
}

/**
 * Liste la bibliothèque : scan du dossier racine réconcilié avec les
 * métadonnées (les anciennes galeries sans manifest sont dérivées), trié par
 * date de mise à jour décroissante. Les dossiers sans metadata.json (ou
 * étrangers au layout) sont ignorés.
 */
export async function listLocalLibrary(): Promise<LocalLibraryEntry[]> {
  const root = libraryRoot();
  const rootInfo = await FileSystem.getInfoAsync(root);
  if (!rootInfo.exists) return [];
  let folders: string[];
  try {
    folders = await FileSystem.readDirectoryAsync(root);
  } catch {
    return [];
  }

  const entries: LocalLibraryEntry[] = [];
  for (const folder of folders) {
    if (!isValidLocalId(folder)) continue;
    const localId = folder;

    const metaInfo = await FileSystem.getInfoAsync(metadataPath(localId));
    if (!metaInfo.exists) continue; // sans métadonnées, rien à afficher
    let gallery: Gallery;
    try {
      const parsed: unknown = JSON.parse(
        await FileSystem.readAsStringAsync(metadataPath(localId))
      );
      if (!isValidLocalGalleryMetadata(parsed)) continue;
      gallery = parsed;
    } catch {
      continue;
    }

    const manifest = await readLocalManifest(localId);
    entries.push({
      localId,
      galleryId: manifest?.galleryId ?? gallery.id,
      title:
        manifest?.title ??
        (gallery.title.pretty || gallery.title.english || `Gallery #${gallery.id}`),
      status: manifest?.status ?? "complete",
      gallery,
      updatedAt: manifest?.updatedAt ?? (metaInfo.modificationTime ?? 0),
      sizeBytes: await measureDirBytes(`${libraryRoot()}${localId}/`),
    });
  }

  return entries.sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Retrouve le localId d'une galerie téléchargée à partir de son ID nhentai. */
export async function resolveLocalByGalleryId(galleryId: number): Promise<string | null> {
  const entries = await listLocalLibrary();
  return entries.find((e) => e.galleryId === galleryId)?.localId ?? null;
}

/**
 * Lecture d'une galerie locale pour le lecteur : le localId est validé ici
 * (garde anti-traversée) puis metadata.json est lu. Erreurs stables pour l'UI.
 */
export async function readLocalGallery(
  localId: string
): Promise<{ localId: string; gallery: Gallery }> {
  if (!isValidLocalId(localId)) throw new Error("Dossier invalide");
  const metaInfo = await FileSystem.getInfoAsync(metadataPath(localId));
  if (!metaInfo.exists) throw new Error("Dossier de la galerie introuvable");
  let gallery: Gallery;
  try {
    const parsed: unknown = JSON.parse(
      await FileSystem.readAsStringAsync(metadataPath(localId))
    );
    if (!isValidLocalGalleryMetadata(parsed)) {
      throw new Error("Métadonnées de la galerie invalides");
    }
    gallery = parsed;
  } catch {
    throw new Error("Métadonnées de la galerie illisibles");
  }
  return { localId, gallery };
}

export interface LocalVerifyResult {
  ok: boolean;
  expected: number;
  found: number;
  /** Noms de fichiers de pages manquants (ex. "Image003.jpg"). */
  missing: string[];
}

/**
 * Vérifie l'intégrité d'une galerie locale : compte les fichiers de pages
 * présents dans le dossier et les compare aux métadonnées. Ne touche à rien,
 * renvoie un état pour l'UI (coche / alerte).
 */
export async function verifyLocalGallery(localId: string): Promise<LocalVerifyResult> {
  const empty: LocalVerifyResult = { ok: false, expected: 0, found: 0, missing: [] };
  if (!isValidLocalId(localId)) return empty;

  const dir = `${libraryRoot()}${localId}/`;
  const metaInfo = await FileSystem.getInfoAsync(metadataPath(localId));
  if (!metaInfo.exists) return empty;

  let gallery: Gallery;
  try {
    const parsed: unknown = JSON.parse(
      await FileSystem.readAsStringAsync(metadataPath(localId))
    );
    if (!isValidLocalGalleryMetadata(parsed)) return empty;
    gallery = parsed;
  } catch {
    return empty;
  }
  const expected = gallery.images?.pages?.length ?? 0;
  if (expected <= 0) return empty;

  let files: string[];
  try {
    files = await FileSystem.readDirectoryAsync(dir);
  } catch {
    return empty;
  }

  const found = files.filter((f) => /^Image\d+\.(jpg|jpeg|png|webp|gif)$/i.test(f));
  const missing = Array.from({ length: expected }, (_, i) => `Image${(i + 1).toString().padStart(3, "0")}`)
    .map((base) => {
      const hit = found.find((f) => f.toLowerCase().startsWith(base.toLowerCase() + "."));
      return hit ? null : `${base}.???`;
    })
    .filter((f): f is string => f !== null);

  return { ok: missing.length === 0, expected, found: found.length, missing };
}

/** Somme récursive des fichiers d'un dossier (directories = 0 octet). */
async function measureDirBytes(dirUri: string): Promise<number> {
  let names: string[];
  try {
    names = await FileSystem.readDirectoryAsync(dirUri);
  } catch {
    return 0;
  }
  let total = 0;
  for (const name of names) {
    const child = `${dirUri}${name}`;
    try {
      const info = await FileSystem.getInfoAsync(child);
      if (!info.exists) continue;
      if (info.isDirectory) {
        total += await measureDirBytes(`${child}/`);
      } else {
        total += info.size ?? 0;
      }
    } catch {}
  }
  return total;
}

/** Affichage header biblio : `1,4 Go` (virgule FR, non persisté). */
export function formatLibrarySize(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 Ko";
  const units = ["Octets", "Ko", "Mo", "Go", "To"] as const;
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const label =
    unit === 0 || value >= 10
      ? String(Math.round(value))
      : value.toFixed(1).replace(".", ",");
  return `${label} ${units[unit]}`;
}

/**
 * Supprime le dossier d'une galerie locale. Favoris et historique inchangés.
 * La file de téléchargement est nettoyée côté appelant (localId completed).
 */
export async function deleteLocalGallery(localId: string): Promise<void> {
  if (!isValidLocalId(localId)) throw new Error("Dossier invalide");
  const dir = `${libraryRoot()}${localId}`;
  await FileSystem.deleteAsync(dir, { idempotent: true });
}
import type { LocalLibraryEntry } from "./localLibrary";

export interface LibraryIndexRow {
  localId: string;
  galleryId: number;
  title: string;
  tags: string;
  sizeBytes: number;
  updatedAt: number;
}

let sqliteReady = false;
let sqliteUnavailable = false;

async function getDb(): Promise<
  | {
      execAsync: (sql: string) => Promise<void>;
      runAsync: (sql: string, params?: (string | number)[]) => Promise<unknown>;
      getAllAsync: <T>(sql: string, params?: (string | number)[]) => Promise<T[]>;
    }
  | null
> {
  if (sqliteUnavailable) return null;
  try {
    const SQLite = await import("expo-sqlite");
    const db = await SQLite.openDatabaseAsync("yomu_library_index.db");
    if (!sqliteReady) {
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS library_index (
          local_id TEXT PRIMARY KEY NOT NULL,
          gallery_id INTEGER NOT NULL,
          title TEXT NOT NULL,
          tags TEXT NOT NULL,
          size_bytes INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS library_index_title ON library_index(title);
        CREATE INDEX IF NOT EXISTS library_index_gallery ON library_index(gallery_id);
      `);
      sqliteReady = true;
    }
    return db;
  } catch (error) {
    sqliteUnavailable = true;
    console.warn("[libraryIndex] SQLite unavailable:", error);
    return null;
  }
}

function tagsText(entry: LocalLibraryEntry): string {
  const names = (entry.gallery.tags || []).map((tag) => tag.name).filter(Boolean);
  return `${entry.title} ${names.join(" ")}`.toLowerCase();
}

export async function rebuildLibraryIndex(entries: LocalLibraryEntry[]): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    await db.execAsync("BEGIN");
    await db.execAsync("DELETE FROM library_index");
    for (const entry of entries) {
      await db.runAsync(
        `INSERT INTO library_index (local_id, gallery_id, title, tags, size_bytes, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          entry.localId,
          entry.galleryId,
          entry.title,
          tagsText(entry),
          entry.sizeBytes || 0,
          entry.updatedAt || 0,
        ]
      );
    }
    await db.execAsync("COMMIT");
  } catch (error) {
    try {
      await db.execAsync("ROLLBACK");
    } catch {
      // ignore
    }
    console.warn("[libraryIndex] rebuild failed:", error);
  }
}

export async function searchLibraryIndex(query: string): Promise<string[] | null> {
  const db = await getDb();
  if (!db) return null;
  const q = query.trim().toLowerCase();
  if (!q) return null;
  try {
    const rows = await db.getAllAsync<{ local_id: string }>(
      `SELECT local_id FROM library_index
       WHERE title LIKE ? OR tags LIKE ? OR CAST(gallery_id AS TEXT) LIKE ?
       ORDER BY updated_at DESC`,
      [`%${q}%`, `%${q}%`, `%${q}%`]
    );
    return rows.map((row) => row.local_id);
  } catch (error) {
    console.warn("[libraryIndex] search failed:", error);
    return null;
  }
}

export function isLibraryIndexAvailable(): boolean {
  return sqliteReady && !sqliteUnavailable;
}

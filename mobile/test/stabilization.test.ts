import test from "node:test";
import assert from "node:assert/strict";
import AsyncStorage, { __mockReset, __mockSet } from "./mockAsyncStorage";
import { PermissionsAndroid, NativeModules } from "./mockReactNative";
import { getDnsMode, setDnsMode } from "@/lib/networkDns";
import { initPrivacyCaptureStore, getPreventScreenCapture } from "@/lib/privacyCaptureStore";
import { requestNotificationPermissions } from "@/lib/permissions";
import { initHistory, recordReadingProgress, findHistoryEntry, getHistory, flushHistoryPersist } from "@/lib/historyStore";
import { sourceGalleryToGallery } from "@/lib/sources/galleryMapper";
import { createSyncBaseline, mergeBackups, backupsEqual } from "@/lib/cloudSync/merge";
import { userFacingError } from "@/lib/userFacingError";
import type { BackupData } from "@/lib/backupStore";
import { toggleFavorite, getFavorites, initFavorites, isFavorite, removeFavorite, FAVORITES_STORAGE_KEY } from "@/lib/favoritesStore";
import type { SourceId } from "@/lib/sources/types";
import * as Persistence from "@/lib/persistQueue";
import { isValidBackupData } from "@/lib/backupValidation";
import { initAppLock, isAppUnlocked, setAppLockPin, verifyAppLockPin } from "@/lib/appLockStore";
import { notifyDownloadFinished } from "@/lib/downloadNotifications";
import { findDuplicateSourcesForGallery } from "@/lib/duplicateMatch";

test("la fiche compare 10 000 favoris sans bloquer les timers ni comparer les favoris entre eux", async (t) => {
  const opened = gallery(99, "ehentai");
  let reads = 0;
  const favorites = Array.from({ length: 10_000 }, (_, i) => {
    const g = gallery(i, "nhentai");
    Object.defineProperty(g, "title", { get() {
      reads++;
      return { pretty: `Livre unique ${i}`, english: "", japanese: "" };
    } });
    return g;
  });
  let timerRan = false;
  setTimeout(() => { timerRan = true; }, 0);
  const started = performance.now();
  const pending = findDuplicateSourcesForGallery(opened, favorites);
  assert.equal(reads, 0, "la fiche doit pouvoir s'afficher avant le premier lot");
  assert.deepEqual(await pending, []);
  assert.equal(timerRan, true);
  assert.ok(reads <= favorites.length, `lectures de titre non linéaires : ${reads}`);
  t.diagnostic(`${favorites.length} favoris : ${reads} lectures, ${Math.round(performance.now() - started)} ms, timers disponibles`);
});

test("les doublons de la fiche respectent titre, artiste, pages et source, sans modifier les favoris", async () => {
  const opened = gallery(99, "ehentai");
  const match = gallery(7, "nhentai");
  const sameSource = gallery(8, "ehentai");
  const wrongPages = { ...gallery(9, "doujins"), num_pages: 30 };
  const wrongArtist = { ...gallery(10, "hitomi"), tags: [{ id: 1, type: "artist" as const, name: "autre", url: "", count: 0 }] };
  const rows = [match, match, sameSource, wrongPages, wrongArtist];
  const before = JSON.stringify(rows);
  assert.deepEqual(await findDuplicateSourcesForGallery(opened, rows), ["nhentai"]);
  assert.equal(JSON.stringify(rows), before);
});

test("quitter une fiche interrompt la recherche facultative au prochain lot", async () => {
  const opened = gallery(99, "ehentai");
  let reads = 0;
  const rows = Array.from({ length: 10_000 }, (_, i) => {
    const g = gallery(i);
    Object.defineProperty(g, "title", { get() { reads++; return { pretty: `Livre ${i}` }; } });
    return g;
  });
  let cancelled = false;
  const pending = findDuplicateSourcesForGallery(opened, rows, () => cancelled);
  setTimeout(() => { cancelled = true; }, 0);
  assert.deepEqual(await pending, []);
  assert.ok(reads <= 128, `calcul poursuivi après navigation : ${reads}`);
});

test("les réglages DNS refusent une ancienne build sans module et les choix inconnus", async () => {
  await assert.rejects(getDnsMode(), /nouvelle version Android/);
  let calls = 0;
  NativeModules.YomuNetwork = { setDnsMode: async () => { calls++; return "system"; } };
  try {
    await assert.rejects(setDnsMode("unknown" as "system"), /invalide/);
    assert.equal(calls, 0);
  } finally { delete NativeModules.YomuNetwork; }
});

test("un échec natif de changement DNS est visible et une réponse inconnue est rejetée", async () => {
  NativeModules.YomuNetwork = {
    setDnsMode: async () => { throw new Error("Enregistrement impossible"); },
    getDnsMode: async () => "unknown",
  };
  try {
    await assert.rejects(setDnsMode("system"), /Enregistrement impossible/);
    await assert.rejects(getDnsMode(), /invalide/);
  } finally { delete NativeModules.YomuNetwork; }
});

test("l'initialisation concurrente des captures attend la préférence persistée", async () => {
  const original = AsyncStorage.getItem;
  let resolve!: (value: string) => void;
  AsyncStorage.getItem = () => new Promise<string>((done) => { resolve = done; });
  try {
    const first = initPrivacyCaptureStore();
    let finished = false;
    const second = initPrivacyCaptureStore().then(() => { finished = true; });
    await Promise.resolve();
    assert.equal(finished, false, "le deuxième appel ne doit pas annoncer prêt avant la lecture");
    resolve("false");
    await Promise.all([first, second]);
    assert.equal(getPreventScreenCapture(), false);
  } finally { AsyncStorage.getItem = original; }
});

test("le refus des notifications est respecté entre deux demandes et les appels concurrents sont dédupliqués", async () => {
  __mockReset();
  const original = PermissionsAndroid.request;
  let calls = 0;
  PermissionsAndroid.request = async () => { calls++; return "denied"; };
  try {
    assert.deepEqual(await Promise.all([requestNotificationPermissions(), requestNotificationPermissions()]), [false, false]);
    assert.equal(await requestNotificationPermissions(), false);
    assert.equal(calls, 1);
  } finally { PermissionsAndroid.request = original; }
});

function gallery(id = 7, source = "nhentai") {
  return sourceGalleryToGallery({ nativeId: String(id), globalId: `${source}:${id}`, title: "Fixture audit", coverUrl: "https://example.test/cover.webp", numPages: 16, tags: [], pageUrls: [{ url: "https://example.test/page.webp" }] }, source as "nhentai");
}

test("la progression reste commune en ligne et locale et distingue les sources", async () => {
  __mockReset(); __mockSet("@nhentai_reading_history_v1", []);
  await initHistory(true);
  await recordReadingProgress(gallery(), 3, 16, { source: "nhentai" });
  assert.equal(findHistoryEntry({ localId: "7_fixture", id: 7, source: "nhentai" })?.lastPage, 3);
  await recordReadingProgress(gallery(), 5, 16, { source: "nhentai", localId: "7_fixture" });
  assert.equal(getHistory().length, 1);
  assert.equal(findHistoryEntry({ id: 7, source: "nhentai" })?.lastPage, 5);
  await recordReadingProgress(gallery(7, "doujins"), 1, 16, { source: "doujins" });
  assert.equal(getHistory().length, 2);
  assert.equal(findHistoryEntry({ id: 7, source: "nhentai" })?.lastPage, 5);
  await flushHistoryPersist();
});

test("les anciens doublons local/en ligne gardent la progression la plus récente et la référence locale", async () => {
  const g = gallery();
  __mockSet("@nhentai_reading_history_v1", [
    { gallery: g, lastPage: 6, totalPages: 16, readAt: 20, source: "nhentai" },
    { gallery: g, lastPage: 2, totalPages: 16, readAt: 10, localId: "7_fixture", source: "nhentai" },
  ]);
  await initHistory(true);
  assert.equal(getHistory().length, 1);
  assert.equal(findHistoryEntry({ localId: "7_fixture" })?.lastPage, 6);
});

test("les dates en millisecondes sont normalisées sans année aberrante", () => {
  const base = { nativeId: "1", globalId: "3hentai:1", title: "Fixture", coverUrl: "", tags: [], numPages: 1, pageUrls: [] };
  const seconds = 1_794_096_000;
  assert.equal(sourceGalleryToGallery({ ...base, uploadDate: seconds * 1000 }, "3hentai").upload_date, seconds);
  assert.equal(sourceGalleryToGallery({ ...base, uploadDate: seconds }, "3hentai").upload_date, seconds);
  assert.equal(sourceGalleryToGallery({ ...base, uploadDate: NaN }, "3hentai").upload_date, 0);
});

function backup(patch: Partial<BackupData>): BackupData { return { version: 1, exportedAt: "2026-11-08T00:00:00.000Z", ...patch }; }
test("une suppression locale ne ressuscite pas après une modification distante", () => {
  const base = backup({ favorites: [{ id: 1, globalId: "nhentai:1", title: "avant" }] });
  const remote = backup({ favorites: [{ id: 1, globalId: "nhentai:1", title: "distant" }, { id: 2 }] });
  const local = backup({ favorites: [] });
  assert.deepEqual(mergeBackups(remote, local, createSyncBaseline(base)).favorites, [{ id: 2 }]);
});
test("une suppression distante est conservée et les nouveaux ajouts des deux appareils sont réunis", () => {
  const base = backup({ favorites: [{ id: 1 }] });
  const remote = backup({ favorites: [{ id: 2 }] });
  const local = backup({ favorites: [{ id: 1 }, { id: 3 }] });
  assert.deepEqual(mergeBackups(remote, local, createSyncBaseline(base)).favorites?.map((g) => g.id), [2, 3]);
});
test("les préférences distantes remplacent les valeurs locales inchangées et les suppressions de tags convergent", () => {
  const base = backup({ readerSettings: { defaultMode: "pager" }, blacklistTags: ["a"] });
  const remote = backup({ readerSettings: { defaultMode: "webtoon" }, blacklistTags: ["a", "b"] });
  const local = backup({ readerSettings: { defaultMode: "pager" }, blacklistTags: [] });
  const merged = mergeBackups(remote, local, createSyncBaseline(base));
  assert.equal(merged.readerSettings?.defaultMode, "webtoon");
  assert.deepEqual(merged.blacklistTags, ["b"]);
});
test("l'historique cloud utilise la source et le livre imbriqué et conserve la lecture la plus récente", () => {
  const remote = backup({ history: [{ gallery: { id: 7 }, source: "nhentai", readAt: 20, lastPage: 8 }] });
  const local = backup({ history: [{ gallery: { id: 7 }, source: "nhentai", readAt: 10, lastPage: 1 }, { gallery: { id: 7 }, source: "hitomi", readAt: 11 }] });
  const merged = mergeBackups(remote, local);
  assert.equal(merged.history?.length, 2);
  assert.equal(merged.history?.[0].lastPage, 8);
});
test("une modification faite pendant l'envoi est conservée lors de l'application locale", () => {
  const sent = backup({ favorites: [{ id: 1 }] });
  const synced = backup({ favorites: [{ id: 1 }, { id: 2 }] });
  const fresh = backup({ favorites: [{ id: 1 }, { id: 3 }] });
  const applied = mergeBackups(synced, fresh, createSyncBaseline(sent));
  assert.deepEqual(applied.favorites?.map((g) => g.id), [1, 2, 3]);
  assert.equal(backupsEqual(applied, synced), false);
  assert.equal(backupsEqual(applied, { ...applied, exportedAt: "autre date" }), true);
});
test("les erreurs visibles ne divulguent pas les adresses réseau ou les URL signées", () => {
  const visible = userFacingError(new Error("Failed to connect to cdn.example.test/[2001:db8::1]:443?token=fixture"));
  assert.match(visible, /Connexion/);
  assert.doesNotMatch(visible, /cdn\.|2001:|token=/);
});

test("les favoris conservent la source et l'identifiant natif après conversion et rechargement", async () => {
  __mockSet(FAVORITES_STORAGE_KEY, []);
  await initFavorites(true);
  for (const source of ["nhentai", "3hentai", "doujins", "hitomi", "ehentai", "rule34"] as SourceId[]) {
    const nativeId = source === "ehentai" ? "123_abcdef" : "123";
    const converted = sourceGalleryToGallery({ nativeId, globalId: `${source}:${nativeId}`, title: "Audit fixture", coverUrl: "", tags: [], numPages: 1, pageUrls: [] }, source);
    await toggleFavorite(converted);
    assert.equal(isFavorite(`${source}:${nativeId}`), true, source);
  }
  await initFavorites(true);
  assert.equal(getFavorites().length, 6);
  assert.ok(getFavorites().some(g => g.globalId === "ehentai:123_abcdef" && g.media_id === "123_abcdef"));
  await removeFavorite("hitomi:123");
  assert.equal(isFavorite("hitomi:123"), false);
  assert.equal(isFavorite("nhentai:123"), true);
});

test("la migration des favoris renseigne origin sans réattribuer une source ambiguë", async () => {
  __mockSet(FAVORITES_STORAGE_KEY, [{ ...gallery(42), origin: undefined, globalId: "hitomi:42" }]);
  await initFavorites(true);
  assert.equal(getFavorites()[0].origin, "local");
  assert.equal(getFavorites()[0].globalId, "hitomi:42");
});

test("une restauration échouée revient à l'état précédent et récupère un arrêt entre écritures", async () => {
  const create = (Persistence as Record<string, any>).createRecoverableStorage;
  assert.equal(typeof create, "function", "le stockage doit fournir une application récupérable");
  const data = new Map<string, string>([["favorites", "old-favorites"], ["history", "old-history"]]);
  let fail = true;
  const raw = {
    getItem: async (key: string) => data.get(key) ?? null,
    setItem: async (key: string, value: string) => { if (key === "history" && fail) { fail = false; throw new Error("disk failed"); } data.set(key, value); },
    removeItem: async (key: string) => { data.delete(key); },
  };
  const storage = create(raw);
  await assert.rejects(storage.replace([["favorites", "new"], ["history", "new"]]), /disk failed/);
  assert.equal(await storage.getItem("favorites"), "old-favorites");
  assert.equal(await storage.getItem("history"), "old-history");
  // Une interruption laisse le journal et une seule nouvelle valeur sur disque.
  data.set("@yomu_restore_journal_v1", JSON.stringify([["favorites", "old-favorites"], ["history", "old-history"]]));
  data.set("favorites", "interrupted");
  const restarted = create(raw);
  assert.equal(await restarted.getItem("favorites"), "old-favorites");
  await restarted.replace([["favorites", "new-favorites"], ["history", "new-history"]]);
  assert.equal(await restarted.getItem("history"), "new-history");
  assert.equal(data.has("@yomu_restore_journal_v1"), false);
});

test("l'import refuse les favoris incomplets et les réglages hors bornes avant toute écriture", () => {
  const header = { version: 3, exportedAt: "2026-11-10T10:00:00Z" };
  assert.equal(isValidBackupData({ ...header, favorites: [{ id: 123 }] }), false);
  assert.equal(isValidBackupData({ ...header, favorites: [{ ...gallery(123), globalId: "unknown:123" }] }), false);
  assert.equal(isValidBackupData({ ...header, readerSettings: { catalogColumnsPhonePortrait: -1 } }), false);
  assert.equal(isValidBackupData({ ...header, privacy: { incognito: "true" } }), false);
  assert.equal(isValidBackupData({ ...header, favorites: [gallery(123)], readerSettings: { defaultMode: "pager", catalogColumnsPhonePortrait: 3 } }), true);
});

test("la restauration et les mutations de bibliothèque sont exclusives", async () => {
  const lock = (Persistence as Record<string, any>).withLibraryMutation;
  assert.equal(typeof lock, "function");
  const events: string[] = [];
  let release!: () => void;
  const first = lock(async () => { events.push("restore"); await new Promise<void>(resolve => { release = resolve; }); events.push("restored"); });
  const second = lock(async () => { events.push("favorite"); });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(events, ["restore"]);
  release();
  await Promise.all([first, second]);
  assert.deepEqual(events, ["restore", "restored", "favorite"]);
});

test("un stockage de verrouillage indisponible garde le contenu fermé et permet de réessayer", async () => {
  await initAppLock(true);
  const original = AsyncStorage.getItem;
  AsyncStorage.getItem = async () => { throw new Error("storage unavailable"); };
  try {
    await assert.rejects(initAppLock(true), /storage unavailable/);
    assert.equal(isAppUnlocked(), false);
  } finally { AsyncStorage.getItem = original; }
  await initAppLock(true);
  assert.equal(isAppUnlocked(), true);
});

test("les essais PIN répétés imposent une attente avant même un PIN correct", async (t) => {
  let now = 100000;
  t.mock.method(Date, "now", () => now);
  await setAppLockPin("1234");
  for (let i = 0; i < 5; i++) assert.equal(await verifyAppLockPin("0000"), false);
  assert.equal(await verifyAppLockPin("1234"), false);
  now += 60000;
  assert.equal(await verifyAppLockPin("1234"), true);
});

test("les notifications de téléchargement ne transmettent pas le titre privé au système", async () => {
  let visible = "";
  NativeModules.YomuDownloadNotification = { notifyCompleted: async (title: string) => { visible = title; } };
  try {
    await notifyDownloadFinished({ title: "Private book title", ok: true });
    assert.doesNotMatch(visible, /Private book title/);
    assert.ok(visible);
  } finally { delete NativeModules.YomuDownloadNotification; }
});

test("les sauvegardes automatiques tournent sans écraser la dernière copie après une panne", async () => {
  const writeBackup = (Persistence as Record<string, any>).writeRotatingBackup;
  assert.equal(typeof writeBackup, "function");
  const files = new Map<string,string>();
  let fail = false;
  const driver = {
    writeAsStringAsync: async (path:string,value:string) => { if (fail) throw new Error("disk full"); files.set(path,value); },
    moveAsync: async ({from,to}:{from:string;to:string}) => { files.set(to,files.get(from)!); files.delete(from); },
    deleteAsync: async (path:string) => { files.delete(path); },
    readDirectoryAsync: async () => [...files.keys()].map(path=>path.slice(5)),
  };
  for (let i=1;i<=4;i++) await writeBackup(driver,"root/",`backup-${i}`,i);
  assert.equal(files.size,3);
  assert.ok([...files.values()].includes("backup-4"));
  const before = [...files]; fail=true;
  await assert.rejects(writeBackup(driver,"root/","lost",5), /disk full/);
  assert.deepEqual([...files],before);
});

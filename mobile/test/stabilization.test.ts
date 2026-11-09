import test from "node:test";
import assert from "node:assert/strict";
import AsyncStorage, { __mockReset, __mockSet } from "./mockAsyncStorage";
import { PermissionsAndroid } from "./mockReactNative";
import { initPrivacyCaptureStore, getPreventScreenCapture } from "@/lib/privacyCaptureStore";
import { requestNotificationPermissions } from "@/lib/permissions";
import { initHistory, recordReadingProgress, findHistoryEntry, getHistory, flushHistoryPersist } from "@/lib/historyStore";
import { sourceGalleryToGallery } from "@/lib/sources/galleryMapper";
import { createSyncBaseline, mergeBackups, backupsEqual } from "@/lib/cloudSync/merge";
import { userFacingError } from "@/lib/userFacingError";
import type { BackupData } from "@/lib/backupStore";

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

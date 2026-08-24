const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

async function loadGlobalId() {
  const mod = await import(
    pathToFileURL(path.join(__dirname, "..", "utils", "globalId.ts")).href
  );
  return mod;
}

test("makeGlobalId / splitGlobalId round-trip", async () => {
  const { makeGlobalId, splitGlobalId, galleryGlobalId, nativeIdAsNumber } =
    await loadGlobalId();
  assert.equal(makeGlobalId("nhentai", 123), "nhentai:123");
  assert.deepEqual(splitGlobalId("3hentai:719"), {
    source: "3hentai",
    nativeId: "719",
  });
  assert.deepEqual(splitGlobalId(482910), {
    source: "nhentai",
    nativeId: "482910",
  });
  assert.equal(galleryGlobalId({ id: 10 }), "nhentai:10");
  assert.equal(
    galleryGlobalId({ id: 10, globalId: "hitomi:abc" }),
    "hitomi:abc"
  );
  assert.equal(nativeIdAsNumber("nhentai:42"), 42);
});

test("BackupData export keeps numeric id + globalId for mobile validation", async () => {
  // Simulate favoriteToBackupRecord shape without DOM localStorage.
  const { makeGlobalId, splitGlobalId } = await loadGlobalId();
  const id = makeGlobalId("3hentai", 719);
  const { nativeId } = splitGlobalId(id);
  const numericId = Number.parseInt(nativeId, 10);
  const record = {
    id: numericId,
    globalId: id,
    title: { pretty: "Alt source book" },
  };
  assert.equal(Number.isFinite(Number(record.id)), true);
  assert.equal(record.globalId, "3hentai:719");
  assert.notEqual(record.globalId.startsWith("nhentai:"), true);
});

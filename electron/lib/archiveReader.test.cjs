"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const zlib = require("zlib");
const { createImageCache, parseNhcacheUrl } = require("./imageCache.cjs");
const {
  listArchiveContents,
  extractArchiveEntry,
  parseComicInfo,
  isSafeEntryName,
} = require("./archiveReader.cjs");

function writeStoredZip(filePath, entries) {
  const chunks = [];
  const central = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const data = Buffer.from(entry.data);
    const uncompressed = entry.uncompressedSize ?? data.length;
    const compressed = entry.compressedSize ?? data.length;
    const method = entry.method ?? 0;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(0, 14);
    local.writeUInt32LE(compressed, 18);
    local.writeUInt32LE(uncompressed, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    chunks.push(local, name, data);
    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(method, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(0, 16);
    centralHeader.writeUInt32LE(compressed, 20);
    centralHeader.writeUInt32LE(uncompressed, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    central.push(centralHeader, name);
    offset += local.length + name.length + data.length;
  }
  const centralDir = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDir.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  fs.writeFileSync(filePath, Buffer.concat([...chunks, centralDir, end]));
}

test("archiveReader liste et extrait une page à la fois", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nh-zip-"));
  const zipPath = path.join(dir, "book.cbz");
  writeStoredZip(zipPath, [
    { name: "ComicInfo.xml", data: "<ComicInfo><Title>Demo</Title><Penciller>Ada</Penciller></ComicInfo>" },
    { name: "002.jpg", data: Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xdb]), Buffer.alloc(400, 1)]) },
    { name: "001.jpg", data: Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xdb]), Buffer.alloc(400, 2)]) },
  ]);
  const listed = await listArchiveContents(zipPath);
  assert.equal(listed.images.length, 2);
  assert.equal(listed.images[0].name, "001.jpg");
  const first = await extractArchiveEntry(zipPath, "001.jpg");
  assert.ok(first.length > 100);
  assert.equal(first[3], 0xdb);
});

test("archiveReader refuse un ratio de compression explosif", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nh-zip-"));
  const zipPath = path.join(dir, "bomb.zip");
  const tiny = zlib.deflateRawSync(Buffer.alloc(64, 0));
  writeStoredZip(zipPath, [
    {
      name: "001.jpg",
      data: tiny,
      method: 8,
      compressedSize: tiny.length,
      uncompressedSize: 20 * 1024 * 1024,
    },
  ]);
  await assert.rejects(() => listArchiveContents(zipPath), /Ratio de compression/);
});

test("archiveReader refuse les chemins zip-slip", () => {
  assert.equal(isSafeEntryName("../secret.jpg"), false);
  assert.equal(isSafeEntryName("pages/001.jpg"), true);
});

test("parseComicInfo extrait titre et artiste", () => {
  const parsed = parseComicInfo("<ComicInfo><Title>Koyoi</Title><Penciller>Matsumoto</Penciller></ComicInfo>");
  assert.equal(parsed.title, "Koyoi");
  assert.equal(parsed.artist, "Matsumoto");
});

test("imageCache est borné en octets et expose des URLs nhcache", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nh-cache-"));
  const cache = createImageCache({ cacheDir: dir, maxBytes: 800 });
  cache.putBuffer("a", Buffer.alloc(500, 1), "jpg");
  const second = cache.putBuffer("b", Buffer.alloc(500, 2), "jpg");
  assert.equal(cache.stats().entries, 1);
  assert.ok(second.url.startsWith("nhcache://item/"));
  assert.equal(cache.getByKey("a"), null);
  assert.ok(cache.getByKey("b"));
  assert.deepEqual(parseNhcacheUrl(second.url), { kind: "item", id: second.id });
});

test("un CBZ de 210 pages se liste sans extraire toutes les planches", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nh-zip-"));
  const zipPath = path.join(dir, "big.cbz");
  const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xdb]), Buffer.alloc(300, 7)]);
  const pages = Array.from({ length: 210 }, (_, i) => ({
    name: `${String(i + 1).padStart(3, "0")}.jpg`,
    data: jpeg,
  }));
  writeStoredZip(zipPath, pages);
  const listed = await listArchiveContents(zipPath);
  assert.equal(listed.images.length, 210);
  const first = await extractArchiveEntry(zipPath, "001.jpg");
  const last = await extractArchiveEntry(zipPath, "210.jpg");
  assert.equal(first[0], 0xff);
  assert.equal(last[0], 0xff);
  assert.equal(first.length, jpeg.length);
});

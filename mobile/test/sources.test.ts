import { test } from "node:test";
import assert from "node:assert/strict";
import {
  makeGlobalId,
  splitGlobalId,
} from "../lib/sources/types";
import { getSource, listSources } from "../lib/sources/registry";
import {
  clearSourceGalleryCache,
  loadSourceGallery,
} from "../lib/sources/galleryLoader";

test("makeGlobalId/splitGlobalId : aller-retour", () => {
  const id = makeGlobalId("3hentai", 719690);
  assert.equal(id, "3hentai:719690");
  const { source, nativeId } = splitGlobalId(id);
  assert.equal(source, "3hentai");
  assert.equal(nativeId, "719690");
});

test("splitGlobalId: un id numérique nu (legacy) retombe sur nhentai", () => {
  assert.deepEqual(splitGlobalId("12345"), { source: "nhentai", nativeId: "12345" });
});

test("splitGlobalId: préfixe inconnu -> nhentai (pas de crash)", () => {
  assert.deepEqual(splitGlobalId("mystery:99"), { source: "nhentai", nativeId: "mystery:99" });
});

test("registry: listSources retourne les 6 sources avec métadonnées", () => {
  const metas = listSources();
  assert.equal(metas.length, 6);
  const ids = metas.map((m) => m.id).sort();
  assert.deepEqual(ids, ["3hentai", "doujins", "ehentai", "hitomi", "nhentai", "rule34"]);
});

test("registry: getSource résout depuis globalId et réutilise les instances", () => {
  const a = getSource("doujins:80117");
  const b = getSource("doujins");
  assert.strictEqual(a, b);
  assert.equal(a.meta.label, "Doujins");
});

test("galleryLoader déduplique fiche → lecteur pendant la session", async () => {
  clearSourceGalleryCache();
  const source = getSource("doujins");
  const originalGetGallery = source.getGallery;
  let calls = 0;
  source.getGallery = async (nativeId: string) => {
    calls += 1;
    await new Promise((resolve) => setTimeout(resolve, 5));
    return {
      globalId: `doujins:${nativeId}`,
      nativeId,
      title: "Cache test",
      coverUrl: "https://example.test/cover.jpg",
      numPages: 1,
      tags: [],
      pageUrls: [{ url: "https://example.test/1.jpg" }],
    };
  };

  try {
    const [detail, reader] = await Promise.all([
      loadSourceGallery("doujins", "42"),
      loadSourceGallery("doujins", "42"),
    ]);
    assert.equal(calls, 1);
    assert.strictEqual(detail, reader);
    await loadSourceGallery("doujins", "42");
    assert.equal(calls, 1, "la lecture réutilise la fiche fraîchement résolue");
  } finally {
    source.getGallery = originalGetGallery;
    clearSourceGalleryCache();
  }
});

test("galleryLoader forceRefresh ne réutilise pas une requête bloquée", async () => {
  clearSourceGalleryCache();
  const source = getSource("doujins");
  const originalGetGallery = source.getGallery;
  let calls = 0;
  let releaseFirst: (() => void) | undefined;
  source.getGallery = async (nativeId: string) => {
    calls += 1;
    if (calls === 1) await new Promise<void>((resolve) => { releaseFirst = resolve; });
    return {
      globalId: `doujins:${nativeId}`,
      nativeId,
      title: `Essai ${calls}`,
      coverUrl: "https://example.test/cover.jpg",
      numPages: 1,
      tags: [],
      pageUrls: [{ url: "https://example.test/1.jpg" }],
    };
  };

  try {
    const stalled = loadSourceGallery("doujins", "43");
    const refreshed = await loadSourceGallery("doujins", "43", undefined, { forceRefresh: true });
    assert.equal(calls, 2);
    assert.equal(refreshed.title, "Essai 2");
    releaseFirst?.();
    await stalled;
  } finally {
    source.getGallery = originalGetGallery;
    clearSourceGalleryCache();
  }
});


import { getSourceFilterSupport, hasAnyFilterSupport } from "../lib/sources/sourceFilterSupport";

test("sourceFilterSupport: E-Hentai a le filtre complet (catégories, pages, rating)", () => {
  const eh = getSourceFilterSupport("ehentai");
  assert.equal(eh.supportsCategories, true);
  assert.equal(eh.supportedCategories.length, 10);
  assert.equal(eh.supportsPages, true);
  assert.equal(eh.supportsRating, true);
});

test("sourceFilterSupport: nHentai adapte les filtres (pages et catégories OK, note exclue)", () => {
  const nh = getSourceFilterSupport("nhentai");
  assert.equal(nh.supportsCategories, true);
  assert.equal(nh.supportsPages, true);
  assert.equal(nh.supportsRating, false);
});

test("sourceFilterSupport: Hitomi adapte aux sous-types sans pages ni note", () => {
  const hit = getSourceFilterSupport("hitomi");
  assert.equal(hit.supportsCategories, true);
  assert.equal(hit.supportedCategories.length, 4);
  assert.equal(hit.supportsPages, false);
  assert.equal(hit.supportsRating, false);
});

test("sourceFilterSupport: hasAnyFilterSupport distingue les sources compatibles", () => {
  assert.equal(hasAnyFilterSupport("ehentai"), true);
  assert.equal(hasAnyFilterSupport("nhentai"), true);
  assert.equal(hasAnyFilterSupport("hitomi"), true);
  assert.equal(hasAnyFilterSupport("3hentai"), true);
  assert.equal(hasAnyFilterSupport("doujins"), false);
});

import { getSourceFilterSupport, hasAnyFilterSupport } from "../lib/sources/sourceFilterSupport";
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
import { EhentaiSource } from "../lib/sources/ehentai";
import { HitomiSource } from "../lib/sources/hitomi";

test("Hitomi respecte la valeur par défaut et les branches de gg.js", async () => {
  const original = globalThis.fetch;
  const hash = "a".repeat(61) + "001";
  globalThis.fetch = (async (url: string) => new Response(String(url).endsWith("gg.js")
    ? "gg={m:function(g){var o = 1;switch(g){case 256:o = 0; break;}return o;},b:'123/'};"
    : JSON.stringify({ id: "1", title: "Fixture", files: [{ hash }, { hash: "a".repeat(61) + "002" }] }))) as typeof fetch;
  try {
    const g = await new HitomiSource().getGallery("1");
    assert.match(g.pageUrls[0].url, /^https:\/\/w1\./);
    assert.match(g.pageUrls[1].url, /^https:\/\/w2\./);
  } finally { globalThis.fetch = original; }
});

test("E-Hentai récupère les indices suivants sans substituer la couverture", async () => {
  const original = globalThis.fetch;
  const visited: string[] = [];
  globalThis.fetch = (async (url: string) => {
    visited.push(String(url));
    if (String(url).includes("api.php")) return new Response(JSON.stringify({gmetadata:[{filecount:"2",title:"Fixture",thumb:"https://example.test/cover.jpg"}]}));
    return new Response(String(url).includes("p=1") ? '<a href="https://e-hentai.org/s/bbbbbb/123-2">2</a>' : '<a href="?p=1">suite</a><a href="https://e-hentai.org/s/aaaaaa/123-1">1</a>');
  }) as typeof fetch;
  try {
    const g = await new EhentaiSource().getGallery("123_abcdef");
    assert.ok(visited.some(u => u.endsWith("p=1")));
    assert.equal(g.pageUrls.length, 2);
    assert.ok(g.pageUrls[1].url.endsWith("123-2"));
    assert.ok(g.pageUrls.every(p => p.url !== g.coverUrl));
  } finally { globalThis.fetch = original; }
});

const ehHtml = `<h1 id="gn">Fixture gallery</h1><div id="gd1"><div style="background: url(https://example.test/cover.jpg)"></div></div>
  <td class="gdt2">2 pages</td><a href="https://e-hentai.org/s/abcdef/123-1">1</a><a href="https://e-hentai.org/s/bcdefa/123-2">2</a>`;

test("E-Hentai démarre le HTML sans attendre son API et ouvre malgré une API bloquée", async () => {
  const original = globalThis.fetch;
  let htmlRequested = false;
  let apiSignal: AbortSignal | null | undefined;
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    if (String(url).includes("api.php")) {
      apiSignal = init?.signal;
      // Simule un transport qui ignore même AbortController.
      return new Promise(() => {});
    }
    htmlRequested = true;
    return new Response(ehHtml);
  }) as typeof fetch;
  try {
    const pending = new EhentaiSource().getGallery("123_abcdef");
    await new Promise((resolve) => setTimeout(resolve, 40));
    assert.equal(htmlRequested, true, "le domaine API ne doit pas bloquer la page principale");
    const gallery = await pending;
    assert.equal(gallery.title, "Fixture gallery");
    assert.equal(gallery.numPages, 2);
    assert.equal(gallery.coverUrl, "https://example.test/cover.jpg");
    assert.equal(apiSignal?.aborted, true);
  } finally { globalThis.fetch = original; }
});

test("E-Hentai refuse une page d'erreur au lieu de mettre une galerie vide en cache", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () => new Response("Service unavailable")) as typeof fetch;
  try {
    await assert.rejects(new EhentaiSource().getGallery("123_abcdef"), /indisponible|accès/i);
  } finally { globalThis.fetch = original; }
});

test("E-Hentai borne aussi un corps HTML bloqué et annule le transport", async (t) => {
  const original = globalThis.fetch;
  let htmlSignal: AbortSignal | null | undefined;
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    if (String(url).includes("api.php")) return new Response('{"gmetadata":[]}');
    htmlSignal = init?.signal;
    return { ok: true, text: () => new Promise(() => {}) } as Response;
  }) as typeof fetch;
  t.mock.timers.enable({ apis: ["setTimeout"] });
  try {
    const pending = new EhentaiSource().getGallery("123_abcdef");
    for (let i = 0; i < 30 && !htmlSignal; i++) await Promise.resolve();
    assert.ok(htmlSignal, "la demande HTML a démarré");
    const rejected = assert.rejects(pending, /ne répond pas/);
    t.mock.timers.tick(14_000);
    await rejected;
    assert.equal(htmlSignal.aborted, true);
  } finally { globalThis.fetch = original; t.mock.timers.reset(); }
});

test("E-Hentai transmet la langue et conserve les opérateurs de recherche", async () => {
  const original = globalThis.fetch;
  let search = "";
  globalThis.fetch = (async (url: string) => {
    search = new URL(url).searchParams.get("f_search") || "";
    return new Response("");
  }) as typeof fetch;
  try {
    const source = new EhentaiSource();
    await source.search({ query: 'artist:"fixture"', language: "french" });
    assert.equal(search, 'artist:"fixture" language:french');
    await source.search({ query: "language:japanese", language: "french" });
    assert.equal(search, "language:japanese");
    await source.search({ language: "all" });
    assert.equal(search, "");
  } finally { globalThis.fetch = original; }
});

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

test("une source inconnue est refusée au lieu d'ouvrir un livre nHentai", () => {
  assert.throws(() => splitGlobalId("mystery:99"), /source/i);
  assert.throws(() => getSource("mystery:99"), /source/i);
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


test("sourceFilterSupport: E-Hentai a le filtre complet (catégories, pages, rating)", () => {
  const eh = getSourceFilterSupport("ehentai");
  assert.equal(eh.supportsCategories, true);
  assert.equal(eh.supportedCategories.length, 10);
  assert.equal(eh.supportsPages, true);
  assert.equal(eh.supportsRating, true);
  assert.equal(eh.supportsLanguage, true);
});

test("sourceFilterSupport: nHentai adapte les filtres (pages et catégories OK, note exclue)", () => {
  const nh = getSourceFilterSupport("nhentai");
  assert.equal(nh.supportsCategories, true);
  assert.equal(nh.supportsPages, true);
  assert.equal(nh.supportsRating, false);
});

test("sourceFilterSupport: Hitomi adapte aux sous-types sans pages ni note", () => {
  const hit = getSourceFilterSupport("hitomi");
  assert.equal(hit.supportsCategories, false);
  assert.equal(hit.supportedCategories.length, 4);
  assert.equal(hit.supportsPages, false);
  assert.equal(hit.supportsRating, false);
});

test("sourceFilterSupport: hasAnyFilterSupport distingue les sources compatibles", () => {
  assert.equal(hasAnyFilterSupport("ehentai"), true);
  assert.equal(hasAnyFilterSupport("nhentai"), true);
  assert.equal(hasAnyFilterSupport("hitomi"), true);
  assert.equal(hasAnyFilterSupport("3hentai"), false);
  assert.equal(hasAnyFilterSupport("doujins"), false);
});

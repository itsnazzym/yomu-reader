import test from "node:test";
import assert from "node:assert/strict";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { mergeTagCatalogs, tagSearchTarget, isTagSource, TAG_SOURCE_IDS } from "../lib/tagCatalog";
import { parseEhTagDatabase, parseHitomiTagDirectory, parseRule34TagPage, fetchRule34TagPage } from "../lib/sources/tagCatalogFetchers";
import { getSourceTags, invalidateSourceTags } from "../lib/sourceTaxonomyStore";
import { saveSourceAuth, clearSourceAuth } from "../lib/sources/authStore";
import { NhentaiSource } from "../lib/sources/nhentai";
import { DB_CATEGORIES } from "../lib/taxonomyData";
import type { SourceId } from "../lib/sources/types";

test("chaque filtre isole strictement les tags de sa source, pour les six sources", () => {
  const data = Object.fromEntries(TAG_SOURCE_IDS.map(source => [source, [{ name: `fixture-${source}` }]]));
  for (const source of TAG_SOURCE_IDS) {
    const tags = mergeTagCatalogs(data, source);
    assert.equal(tags.length, 1);
    assert.deepEqual(tags[0].sources, [source]);
    assert.equal(tags[0].name, `fixture-${source}`);
    assert.equal(isTagSource(source), true);
  }
  assert.equal(isTagSource("all"), true);
  assert.equal(isTagSource("unknown"), false);
});

test("Tout déduplique casse, espaces et underscores, tout en conservant les sources", () => {
  const tags = mergeTagCatalogs({ nhentai: [{ name: "Full Color" }], rule34: [{ name: "full_color" }], doujins: [{ name: "  full   color " }] }, "all");
  assert.equal(tags.length, 1);
  assert.deepEqual(tags[0].sources, ["nhentai", "doujins", "rule34"]);
  assert.equal(tags[0].nativeNames.rule34, "full_color");
  assert.deepEqual(tagSearchTarget(tags[0], "rule34"), { source: "rule34", query: "full_color" });
  assert.deepEqual(tagSearchTarget(tags[0], "all"), { source: "all", query: 'tag:"Full Color"' });
});

test("les espaces de noms et les types distincts ne sont pas fusionnés à tort", () => {
  const tags = mergeTagCatalogs({ ehentai: [{ name: "fixture", type: "female" }, { name: "fixture", type: "male" }, { name: "fixture", type: "artist" }], hitomi: [{ name: "FIXTURE", type: "female" }] }, "all");
  assert.equal(tags.length, 3);
  assert.equal(tags.find(tag => tag.type === "female")?.sources.length, 2);
});

test("aucun plafond de popularité ne masque les entrées du catalogue nHentai", async () => {
  const tags = await new NhentaiSource().getTags();
  assert.equal(tags.length, Object.values(DB_CATEGORIES).reduce((sum, entries) => sum + entries.length, 0));
  assert.ok(tags.length > 50000);
  assert.ok(tags.some(tag => tag.type === "artist"));
  const large = Array.from({ length: 5001 }, (_, index) => ({ name: `fixture-${index}` }));
  assert.equal(mergeTagCatalogs({ nhentai: large }, "all").length, 5001);
});

test("E-Hentai utilise les vraies entrées de son répertoire et exclut les métadonnées", () => {
  const tags = parseEhTagDatabase({ data: [{ namespace: "rows", data: { fixture: {} } }, { namespace: "artist", data: { "fixture creator": {} } }, { namespace: "female", data: { fixture: {} } }] });
  assert.equal(tags.length, 2);
  assert.ok(tags.some(tag => tag.type === "artist" && tag.name === "fixture creator"));
  assert.throws(() => parseEhTagDatabase({ data: "invalid" }));
  assert.throws(() => parseEhTagDatabase({ data: [] }));
});

test("Hitomi parse les noms natifs, les espaces de noms et les compteurs de son index", () => {
  const tags = parseHitomiTagDirectory('<a href="/tag/female%3Afixture%20name-all.html">Label</a> (1,234)<a href="/tag/male%3Afixture%20name-all.html">Label</a> (12)<a href="/alltags-b.html">b</a>');
  assert.equal(tags.length, 2);
  assert.ok(tags.some(tag => tag.type === "female" && tag.name === "fixture name" && tag.count === 1234));
  assert.ok(tags.some(tag => tag.type === "male"));
});

test("Rule34 valide les données de tags et conserve l'orthographe de recherche", () => {
  assert.deepEqual(parseRule34TagPage([{ id: 4, name: "fixture_creator", type: 1, count: "12" }]), [{ id: "4", name: "fixture_creator", type: "artist", count: 12 }]);
  assert.throws(() => parseRule34TagPage("Missing authentication"));
  assert.throws(() => parseRule34TagPage([null]));
});

test("le cache conserve plus de 2 000 tags en segments, puis permet un vrai rafraîchissement", async () => {
  await invalidateSourceTags("ehentai");
  const tags = Array.from({ length: 2501 }, (_, index) => ({ name: `cache-fixture-${index}` }));
  let calls = 0;
  const fetcher = async () => { calls++; return tags; };
  assert.equal((await getSourceTags("ehentai", fetcher)).length, 2501);
  const metadata = JSON.parse((await AsyncStorage.getItem("@src_tax_v3_ehentai"))!);
  assert.equal(metadata.chunks.length, 3);
  assert.equal((await getSourceTags("ehentai", fetcher)).length, 2501);
  await getSourceTags("ehentai", fetcher, { refresh: true });
  assert.equal(calls, 2, "une lecture en cache ne doit pas rester bloquée dans inflight");
  const fallback = await getSourceTags("ehentai", async () => { throw new Error("offline fixture"); }, { refresh: true });
  assert.equal(fallback.length, 2501);
});

test("une panne du cache ne transforme pas un téléchargement réussi en liste vide", async () => {
  await invalidateSourceTags("hitomi");
  const original = AsyncStorage.setItem;
  AsyncStorage.setItem = async () => { throw new Error("storage full fixture"); };
  try { assert.deepEqual(await getSourceTags("hitomi", async () => [{ name: "fixture" }]), [{ name: "fixture" }]); }
  finally { AsyncStorage.setItem = original; }
});

test("Rule34 parcourt les pages au-delà de 60 tags et signale la dernière page", async () => {
  const original = globalThis.fetch;
  const pages: string[] = [];
  await saveSourceAuth("rule34", { isLoggedIn: true, credentials: { userId: "42", apiKey: "fixture-key" } });
  globalThis.fetch = async input => {
    const url = new URL(String(input));
    pages.push(url.searchParams.get("pid")!);
    assert.equal(url.searchParams.get("limit"), "1000");
    const count = url.searchParams.get("pid") === "0" ? 1000 : 3;
    return new Response(JSON.stringify(Array.from({ length: count }, (_, index) => ({ id: index, name: `fixture_${index}`, count: 1 }))));
  };
  try {
    assert.equal((await fetchRule34TagPage(0)).hasMore, true);
    const last = await fetchRule34TagPage(1);
    assert.equal(last.tags.length, 3);
    assert.equal(last.hasMore, false);
    assert.deepEqual(pages, ["0", "1"]);
  } finally { globalThis.fetch = original; await clearSourceAuth("rule34"); }
});

test("une source sans répertoire ne reçoit jamais les tags d'une autre source", async () => {
  const source: SourceId = "rule34";
  await clearSourceAuth(source);
  await assert.rejects(fetchRule34TagPage(0), (error: any) => error.code === "paywalled");
  assert.equal(mergeTagCatalogs({ nhentai: [{ name: "fixture" }] }, source).length, 0);
});

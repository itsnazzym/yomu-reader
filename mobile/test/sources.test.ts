import { test } from "node:test";
import assert from "node:assert/strict";
import {
  makeGlobalId,
  splitGlobalId,
} from "../lib/sources/types";
import { getSource, listSources } from "../lib/sources/registry";

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

test("registry: listSources retourne les 3 sources avec métadonnées", () => {
  const metas = listSources();
  assert.equal(metas.length, 3);
  const ids = metas.map((m) => m.id).sort();
  assert.deepEqual(ids, ["3hentai", "doujins", "nhentai"]);
});

test("registry: getSource résout depuis globalId et réutilise les instances", () => {
  const a = getSource("doujins:80117");
  const b = getSource("doujins");
  assert.strictEqual(a, b);
  assert.equal(a.meta.label, "Doujins");
});

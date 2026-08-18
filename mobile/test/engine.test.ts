import { test } from "node:test";
import assert from "node:assert/strict";
import { __mockReset, __mockSet } from "./mockAsyncStorage";
import { __setSearchHandler } from "./mockNhentai";
import {
  generateRecommendations,
  clearRecommendationCache,
  addToSearchHistory,
  getSearchHistory,
} from "@/lib/recommendationEngine";
import type { Gallery, Tag } from "@/lib/api/types";

const FAVORITES_KEY = "@nhentai_favorites_v1";
const HISTORY_KEY = "@nhentai_reading_history_v1";
const SEARCH_KEY = "@nhentai_search_history_v1";
const BLACKLIST_KEY = "@nhentai_blacklist_tags";

function tag(name: string, type: Tag["type"] = "tag", count = 100): Tag {
  return { id: 0, type, name, url: "", count };
}

function makeGallery(id: number, tags: Tag[], num_favorites = 0): Gallery {
  return {
    id,
    media_id: String(id),
    title: { english: `Gallery ${id}`, japanese: "", pretty: `Gallery ${id}` },
    images: {
      pages: [],
      cover: null,
      thumbnail: null,
    } as unknown as Gallery["images"],
    scanlator: "",
    upload_date: 0,
    tags,
    num_pages: 10,
    num_favorites,
  };
}

// Remet le stockage mocké à zéro et vide les caches des stores (les clés `[]`
// forcent `initFavorites`/`initHistory`/`initBlacklist` à réinitialiser leurs
// listes au lieu de conserver l'état d'un test précédent).
function seedEmpty(): void {
  __mockReset();
  __mockSet(FAVORITES_KEY, []);
  __mockSet(HISTORY_KEY, []);
  __mockSet(BLACKLIST_KEY, []);
}

test("cycle complet : signaux, exclusion, classement et compteur de tag", async () => {
  seedEmpty();
  __setSearchHandler(() => [
    makeGallery(101, [tag("stockings")]), // favori → exclu
    makeGallery(102, [tag("glasses")]), // historique → exclu
    makeGallery(103, [tag("gore")]), // blacklist → exclu
    makeGallery(200, [tag("stockings")], 500), // correspondance → haut score
    makeGallery(400, [tag("unrelated")], 10), // inédit → bas score
  ]);

  __mockSet(FAVORITES_KEY, [
    makeGallery(101, [
      tag("stockings", "tag", 120),
      tag("alice", "artist", 50),
      tag("english", "language", 0),
    ]),
  ]);
  __mockSet(HISTORY_KEY, [
    {
      gallery: makeGallery(102, [tag("glasses", "tag", 80)]),
      lastPage: 3,
      totalPages: 10,
      readAt: Date.now(),
    },
  ]);
  __mockSet(SEARCH_KEY, ["milf"]);
  __mockSet(BLACKLIST_KEY, ["gore"]);

  const r = await generateRecommendations();

  assert.equal(r.profile.totalFavorites, 1, "totalFavorites");
  assert.equal(r.profile.totalHistory, 1, "totalHistory");
  assert.equal(r.profile.totalSearches, 1, "totalSearches");
  assert.equal(r.profile.hasSignals, true, "hasSignals");

  const names = r.profile.tags.map((t) => t.name);
  assert.ok(names.includes("stockings"), "tag favori détecté");
  assert.ok(names.includes("glasses"), "tag historique détecté");
  assert.ok(names.includes("milf"), "signal de recherche détecté");
  assert.ok(r.profile.languages.includes("english"), "langue détectée");

  const stockings = r.profile.tags.find((t) => t.name === "stockings");
  assert.equal(stockings?.count, 120, "compteur propagé depuis les métadonnées");

  const ids = r.books.map((b) => b.id);
  assert.deepEqual(ids, [200, 400], `ordre/ensemble des livres (got ${ids})`);
  assert.ok(r.queriesUsed.some((q) => q.includes("milf")), "recherche enregistrée utilisée");
});

test("le refresh exclut les livres déjà montrés", async () => {
  seedEmpty();
  __setSearchHandler(() => [
    makeGallery(201, [tag("stockings")]),
    makeGallery(202, [tag("glasses")]),
    makeGallery(203, [tag("gore")]),
    makeGallery(204, [tag("stockings")], 500),
    makeGallery(205, [tag("unrelated")], 10),
  ]);

  __mockSet(FAVORITES_KEY, [makeGallery(201, [tag("stockings")])]);
  __mockSet(HISTORY_KEY, [
    { gallery: makeGallery(202, [tag("glasses")]), lastPage: 0, totalPages: 10, readAt: 0 },
  ]);
  __mockSet(BLACKLIST_KEY, ["gore"]);

  const first = await generateRecommendations();
  assert.deepEqual(first.books.map((b) => b.id), [204, 205], "première passe");

  clearRecommendationCache();
  const second = await generateRecommendations();
  assert.equal(second.books.length, 0, "aucun nouveau livre après refresh");
  assert.ok(second.queriesUsed.length > 0, "les requêtes ont bien tourné");
});

test("cold start sans signal ne lance aucune requête", async () => {
  seedEmpty();
  const r = await generateRecommendations();

  assert.equal(r.books.length, 0, "pas de livres");
  assert.equal(r.queriesUsed.length, 0, "aucune requête");
  assert.equal(r.profile.hasSignals, false, "hasSignals false");
});

test("toutes les requêtes en échec lèvent une erreur explicite", async () => {
  seedEmpty();
  let calls = 0;
  __setSearchHandler(() => {
    calls += 1;
    throw new Error("network down");
  });
  __mockSet(FAVORITES_KEY, [makeGallery(301, [tag("x")])]);

  await assert.rejects(generateRecommendations(), /recommandations/i);
  assert.equal(calls, 3, "1 tentative + 2 réessais (erreur réseau = retryable)");
});

test("un 429 transitoire est réessayé puis réussit", async () => {
  seedEmpty();
  let calls = 0;
  __setSearchHandler(() => {
    calls += 1;
    if (calls === 1) throw new Error("HTTP 429 Too Many Requests");
    return [makeGallery(302, [tag("stockings")])];
  });
  __mockSet(FAVORITES_KEY, [makeGallery(303, [tag("stockings")])]);

  const r = await generateRecommendations();

  assert.ok(calls >= 2, `au moins un réessai après 429 (got ${calls})`);
  assert.ok(r.books.some((b) => b.id === 302), "résultat obtenu après réessai");
});

test("une erreur non retryable échoue immédiatement sans réessai", async () => {
  seedEmpty();
  let calls = 0;
  __setSearchHandler(() => {
    calls += 1;
    throw new Error("HTTP 404 Not Found");
  });
  __mockSet(FAVORITES_KEY, [makeGallery(304, [tag("x")])]);

  await assert.rejects(generateRecommendations(), /recommandations/i);
  assert.equal(calls, 1, "aucun réessai pour une 404");
});

test("un opérateur artist: ne crée pas de tag parasite", async () => {
  seedEmpty();
  __setSearchHandler(() => []);
  __mockSet(SEARCH_KEY, ["artist:alice"]);

  const r = await generateRecommendations();

  assert.equal(r.profile.hasSignals, true, "un artiste seul est un signal");
  assert.ok(r.profile.artists.some((a) => a.name === "alice"), "artiste détecté");
  assert.ok(!r.profile.tags.some((t) => t.name === "alice"), "pas de tag 'alice' parasite");
});

test("un nom d'artiste multi-mots non quoté ne fuit pas en tag libre", async () => {
  seedEmpty();
  __setSearchHandler(() => []);
  __mockSet(SEARCH_KEY, ["artist:siina tai"]);

  const r = await generateRecommendations();

  assert.ok(
    r.profile.artists.some((a) => a.name === "siina tai"),
    "nom complet conservé"
  );
  assert.ok(
    !r.profile.artists.some((a) => a.name === "siina"),
    "artiste non tronqué au premier mot"
  );
  assert.ok(!r.profile.tags.some((t) => t.name === "tai"), "pas de tag 'tai' parasite");
});

test("une parodie multi-mots non quotée garde son nom complet sans tag parasite", async () => {
  seedEmpty();
  __setSearchHandler(() => []);
  __mockSet(SEARCH_KEY, ["parody:blue archive"]);

  const r = await generateRecommendations();

  assert.ok(
    r.profile.parodies.some((p) => p.name === "blue archive"),
    "parodie complète détectée"
  );
  assert.ok(
    !r.profile.parodies.some((p) => p.name === "blue"),
    "parodie non tronquée au premier mot"
  );
  assert.ok(!r.profile.tags.some((t) => t.name === "archive"), "pas de tag 'archive' parasite");
});

test("un opérateur technique mono-mot n'avale pas le tag libre suivant", async () => {
  seedEmpty();
  __setSearchHandler(() => []);
  __mockSet(SEARCH_KEY, ["sort:popular anal"]);

  const r = await generateRecommendations();

  assert.ok(r.profile.tags.some((t) => t.name === "anal"), "le tag libre 'anal' survit");
  assert.equal(r.profile.parodies.length, 0, "aucune parodie inventée");
  assert.equal(r.profile.artists.length, 0, "aucun artiste inventé");
});

test("un mélange parodie quotée + tag libre préserve les deux signaux", async () => {
  seedEmpty();
  __setSearchHandler(() => []);
  __mockSet(SEARCH_KEY, ['parody:"blue archive" femdom']);

  const r = await generateRecommendations();

  assert.ok(
    r.profile.parodies.some((p) => p.name === "blue archive"),
    "parodie quotée détectée"
  );
  assert.ok(r.profile.tags.some((t) => t.name === "femdom"), "tag libre conservé");
});

test("les opérateurs techniques nHentai ne fuient pas en tag libre", async () => {
  seedEmpty();
  __setSearchHandler(() => []);
  __mockSet(SEARCH_KEY, [
    "category:doujinshi",
    "order:popular",
    "comments:>50",
    "favorites:1000",
  ]);

  const r = await generateRecommendations();

  for (const leaked of ["category:doujinshi", "doujinshi", "popular", "comments:>50", "favorites:1000"]) {
    assert.ok(!r.profile.tags.some((t) => t.name === leaked), `pas de tag '${leaked}' parasite`);
  }
});

test("les valeurs de character/date/pages sont strippées sans fuite", async () => {
  seedEmpty();
  __setSearchHandler(() => []);
  __mockSet(SEARCH_KEY, ["character:rem", "date:2023-05", "pages:10-20"]);

  const r = await generateRecommendations();

  for (const leaked of ["rem", "2023-05", "10-20", "date:2023-05", "pages:10-20"]) {
    assert.ok(!r.profile.tags.some((t) => t.name === leaked), `pas de tag '${leaked}' parasite`);
  }
  assert.equal(r.profile.artists.length, 0, "aucun artiste inventé");
  assert.equal(r.profile.parodies.length, 0, "aucune parodie inventée");
});

test("une recherche ne surpondère pas un tag déjà signalé par favori", async () => {
  seedEmpty();
  __setSearchHandler(() => []);
  __mockSet(FAVORITES_KEY, [makeGallery(401, [tag("stockings")])]);
  __mockSet(SEARCH_KEY, ["stockings"]);

  const r = await generateRecommendations();

  const stockings = r.profile.tags.find((t) => t.name === "stockings");
  assert.ok(stockings, "tag favori détecté");
  assert.equal(stockings.score, 3, "score du favori seul (pas de cumul recherche)");
  assert.ok(stockings.sources.includes("fav"), "source favori conservée");
  assert.ok(!stockings.sources.includes("search"), "source recherche non dupliquée");
});

test("une recherche ne surpondère pas un artiste déjà en favori", async () => {
  seedEmpty();
  __setSearchHandler(() => []);
  __mockSet(FAVORITES_KEY, [makeGallery(402, [tag("alice", "artist")])]);
  __mockSet(SEARCH_KEY, ["artist:alice"]);

  const r = await generateRecommendations();

  const alice = r.profile.artists.find((a) => a.name === "alice");
  assert.ok(alice, "artiste favori détecté");
  assert.equal(alice.score, 4.5, "score artiste favori seul (3 × 1.5, pas de cumul)");
});

test("une recherche seule garde son poids quand le terme n'a pas de signal fort", async () => {
  seedEmpty();
  __setSearchHandler(() => []);
  __mockSet(SEARCH_KEY, ["stockings"]);

  const r = await generateRecommendations();

  const stockings = r.profile.tags.find((t) => t.name === "stockings");
  assert.ok(stockings, "tag de recherche détecté");
  assert.equal(stockings.score, 0.75, "poids recherche conservé sans favori");
  assert.ok(stockings.sources.includes("search"), "source recherche conservée");
});

test("l'historique de recherche se déduplique et ignore les entrées courtes", async () => {
  seedEmpty();
  await addToSearchHistory("Milf");
  await addToSearchHistory("milf"); // doublon insensible à la casse
  await addToSearchHistory("a"); // trop court → ignoré

  const searches = await getSearchHistory();
  assert.equal(searches.length, 1, "dédup insensible à la casse");
  assert.equal(searches[0].toLowerCase(), "milf", "dernière requête conservée");
});

/**
 * Sonde live des sources : search -> getGallery -> HEAD sur la page 1.
 * Usage : node scripts/probe.mjs [query]
 *         node scripts/probe.mjs --id doujins:80117    (résolution directe)
 *         node scripts/probe.mjs --tags 3hentai        (liste réelle de tags)
 */

import { ThreeHentaiSource } from "../lib/sources/threehentai";
import { DoujinsSource } from "../lib/sources/doujins";
import { getSource } from "../lib/sources/registry";

// Stub Platform pour l'exécution node (mockReactNative équivalent inline).
(globalThis as any).Platform = { OS: "windows" };

interface SearchableSource {
  search(opts: any): Promise<any>;
  getGallery(id: string): Promise<any>;
}

async function probe(
  name: string,
  src: SearchableSource,
  q: string
): Promise<boolean> {
  console.log(`\n=== ${name} ===`);
  try {
    const res = await src.search({ query: q, page: 1 });
    console.log(`search "${q}": ${res.cards.length} cartes, hasMore=${res.hasMore}`);
    const first = res.cards[0];
    if (!first) {
      console.log("AUCUN RESULTAT");
      return false;
    }
    console.log(`premiere carte: ${first.globalId} — ${first.title.slice(0, 60)}`);
    const nativeId = first.globalId.split(":")[1];
    const gal = await src.getGallery(nativeId);
    console.log(`pages: ${gal.numPages}, urls: ${gal.pageUrls.length}, tags: ${gal.tags.length}`);
    if (!gal.pageUrls[0]?.url) {
      console.log("ECHEC: pas d'URL de page");
      return false;
    }
    const r = await fetch(gal.pageUrls[0].url, { method: "HEAD" });
    console.log(`HEAD page 1: ${r.status}`);
    return r.ok && gal.numPages > 0;
  } catch (e) {
    console.log(`ERREUR: ${e instanceof Error ? e.message : e}`);
    return false;
  }
}

async function probeById(globalId: string): Promise<boolean> {
  console.log(`\n=== Résolution directe ${globalId} ===`);
  try {
    const [source, nativeId] = globalId.split(":");
    const src = getSource(source);
    const gal = await src.getGallery(nativeId);
    console.log(`titre: ${gal.title.slice(0, 60)}`);
    console.log(`pages: ${gal.numPages}, urls: ${gal.pageUrls.length}, tags: ${gal.tags.length}`);
    if (!gal.pageUrls[0]?.url) {
      console.log("ECHEC: pas d'URL de page");
      return false;
    }
    const r = await fetch(gal.pageUrls[0].url, { method: "HEAD" });
    console.log(`HEAD page 1: ${r.status}`);
    return r.ok && gal.numPages > 0;
  } catch (e) {
    console.log(`ERREUR: ${e instanceof Error ? e.message : e}`);
    return false;
  }
}

async function probeTags(sourceId: string): Promise<boolean> {
  console.log(`\n=== Tags ${sourceId} ===`);
  try {
    const src = getSource(sourceId);
    if (!src.getTags) {
      console.log("ERREUR: source sans getTags()");
      return false;
    }
    const t0 = Date.now();
    const tags = await src.getTags();
    const withCount = tags.filter((t) => (t.count || 0) > 0).length;
    console.log(
      `tags: ${tags.length} (${withCount} avec comptes) en ${Date.now() - t0}ms`
    );
    console.log(`exemples: ${tags.slice(0, 5).map((t) => `${t.name}${t.count ? `(${t.count})` : ""}`).join(", ")}`);
    return tags.length > 0;
  } catch (e) {
    console.log(`ERREUR: ${e instanceof Error ? e.message : e}`);
    return false;
  }
}

(async () => {
  const idIdx = process.argv.indexOf("--id");
  if (idIdx >= 0 && process.argv[idIdx + 1]) {
    const ok = await probeById(process.argv[idIdx + 1]);
    console.log(`\nRésultat: ${ok ? "OK" : "KO"}`);
    process.exit(ok ? 0 : 1);
  }
  const tagsIdx = process.argv.indexOf("--tags");
  if (tagsIdx >= 0 && process.argv[tagsIdx + 1]) {
    let ok = true;
    for (const sid of process.argv[tagsIdx + 1].split(",")) {
      ok = (await probeTags(sid.trim())) && ok;
    }
    console.log(`\nRésultat: ${ok ? "OK" : "KO"}`);
    process.exit(ok ? 0 : 1);
  }
  const query = process.argv[2] || "nurse";
  const ok1 = await probe("3Hentai FR", new ThreeHentaiSource(), query);
  const ok2 = await probe("Doujins", new DoujinsSource(), process.argv[3] || query);
  console.log(`\nRésultat: 3hentai=${ok1 ? "OK" : "KO"} doujins=${ok2 ? "OK" : "KO"}`);
  process.exit(ok1 && ok2 ? 0 : 1);
})();

/**
 * Sonde live des sources : search -> getGallery -> HEAD sur la page 1.
 * Usage : node scripts/probe.mjs [query]
 */

import { ThreeHentaiSource } from "../lib/sources/threehentai";
import { DoujinsSource } from "../lib/sources/doujins";

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

(async () => {
  const query = process.argv[2] || "nurse";
  const ok1 = await probe("3Hentai FR", new ThreeHentaiSource(), query);
  const ok2 = await probe("Doujins", new DoujinsSource(), process.argv[3] || query);
  console.log(`\nRésultat: 3hentai=${ok1 ? "OK" : "KO"} doujins=${ok2 ? "OK" : "KO"}`);
  process.exit(ok1 && ok2 ? 0 : 1);
})();

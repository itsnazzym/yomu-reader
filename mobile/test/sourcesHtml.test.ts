import { parseEhentaiNativeId, parseEhentaiListingCards } from "../lib/sources/ehentai";
import { getEhentaiCategoryInfo, calculateCategoryBitmask } from "../lib/sources/ehentaiCategories";
import { buildRule34Title, parseRule34Tags } from "../lib/sources/rule34";
import { parseCookieString, formatCookieHeader } from "../lib/sources/authStore";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  extractMatches,
  decodeEntities,
  stripTags,
  extractAttribute,
  stripNhentaiOperators,
  translateQueryForSource,
  sanitizeMediaUrl,
} from "../lib/sources/html";
import { parseDoujinsListCards, parseDoujinsTagsPage } from "../lib/sources/doujins";
import { parseThreeHentaiDetailTags, parseThreeHentaiTagsPage } from "../lib/sources/threehentai";
import { dedupeTags } from "../lib/sources/tagUtils";
import { parseNozomiIds, thumbUrl } from "../lib/sources/hitomi";

test("extractLinks: trouve les galeries d'un listing 3hentai", () => {
  const html = `<div class="doujin-col"><div class="doujin ">
    <a href="https://fr.3hentai.net/d/719464" class="cover" style="padding:0">
        <img class="lazy" data-src="https://s1.3hentai.xyz/d2432702/thumb.jpg" width="250"/>
        <div class="title flag flag-fra">
            [Kameyama Shiruko] Sakusei Byoutou
        </div>
    </a>
</div></div>`;
  const links = extractMatches(
    html,
    /<a href="(https:\/\/fr\.3hentai\.net\/d\/(\d+))"[^>]*>[\s\S]*?data-src="([^"]+)"[\s\S]*?<div class="title[^"]*">\s*([\s\S]*?)\s*<\/div>/g
  );
  assert.equal(links.length, 1);
  assert.equal(links[0][2], "719464");
  assert.equal(links[0][3], "https://s1.3hentai.xyz/d2432702/thumb.jpg");
  assert.equal(links[0][4].trim(), "[Kameyama Shiruko] Sakusei Byoutou");
});

test("decodeEntities: décode les entités HTML courantes", () => {
  assert.equal(decodeEntities("A &amp; B &quot;C&quot; &#39;D&#39; &lt;E&gt;"), 'A & B "C" \'D\' <E>');
});

test("stripTags: retire le markup et normalise les espaces", () => {
  assert.equal(stripTags("<b>Bold</b> and   <i>italic</i>"), "Bold and italic");
});

test("extractAttribute: lit un attribut dans une balise", () => {
  const tag = '<img class="lazy" data-src="https://cdn/x.jpg" width="250"/>';
  assert.equal(extractAttribute(tag, "data-src"), "https://cdn/x.jpg");
  assert.equal(extractAttribute(tag, "width"), "250");
  assert.equal(extractAttribute(tag, "missing"), null);
});

test("stripNhentaiOperators: enlève language:english et laisse le texte libre", () => {
  assert.equal(stripNhentaiOperators("language:english"), undefined);
  assert.equal(stripNhentaiOperators("nurse language:english"), "nurse");
  assert.equal(stripNhentaiOperators("pages:>20 order:popular"), undefined);
});

test("sanitizeMediaUrl: retire le suffixe srcset 2x et décode les entités", () => {
  assert.equal(
    sanitizeMediaUrl("https://static.doujins.com/f2-abc.jpg?st=x&amp;e=1 2x"),
    "https://static.doujins.com/f2-abc.jpg?st=x&e=1"
  );
});

test("parseDoujinsListCards: href + img wrappés + titre encodé", () => {
  const html = `
    <div class="thumbnail-doujin">
      <a href="/original-doujins-series/ero-doll-natsumis-sex-partner-41192" class="">
        <img src="https://static.doujins.com/f2-dyqj6q2p.jpg?st=abc&amp;e=1" srcset="https://static.doujins.com/f2-dyqj6q2p.jpg?st=abc&amp;e=1 2x"/>
        <div class="title"><div class="text">Natsumi&#039;s Sex Partner</div></div>
      </a>
    </div>
    <a href="/pokemon/other-title-102527">
      <div class="wrap"><img src="https://static.doujins.com/f-xyz.jpg"/></div>
      <div class="title"><div class="text">Tall Aunty</div></div>
    </a>
  `;
  const cards = parseDoujinsListCards(html);
  assert.equal(cards.length, 2);
  assert.equal(cards[0].globalId, "doujins:41192");
  assert.equal(cards[0].title, "Natsumi's Sex Partner");
  assert.equal(cards[0].coverUrl, "https://static.doujins.com/f2-dyqj6q2p.jpg?st=abc&e=1");
  assert.equal(cards[1].globalId, "doujins:102527");
  assert.equal(cards[1].title, "Tall Aunty");
});

test("parseDoujinsListCards: ignore /tags/ /artists/ /series/ hrefs", () => {
  const html = `
    <a href="/tags/Hashtag-32842"><div class="text">Hashtag</div></a>
    <a href="/original-doujins-series/ero-doll-41192">
      <img src="https://static.doujins.com/f2-x.jpg"/>
      <div class="title"><div class="text">Natsumi&#039;s Sex Partner</div></div>
    </a>
  `;
  const cards = parseDoujinsListCards(html);
  assert.equal(cards.length, 1);
  assert.equal(cards[0].globalId, "doujins:41192");
  assert.equal(cards[0].title, "Natsumi's Sex Partner");
});

test("parseDoujinsListCards: ignore une carte réservée aux abonnés", () => {
  const html = `
    <a href="/original-doujins-series/locked-title-55555">
      <img src="https://static.doujins.com/f2-locked.jpg" data-link="/subscribe" />
      <div class="text">Locked title</div>
    </a>
    <a href="/original-doujins-series/free-title-55556">
      <img src="https://static.doujins.com/f2-free.jpg" />
      <div class="text">Free title</div>
    </a>
  `;
  const cards = parseDoujinsListCards(html);
  assert.deepEqual(cards.map((card) => card.globalId), ["doujins:55556"]);
});

test("translateQueryForSource: conserve les valeurs des opérateurs nhentai", () => {
  assert.equal(translateQueryForSource('tag:"vanilla"'), "vanilla");
  assert.equal(translateQueryForSource('tag:"rough translation" language:french'), "rough translation french");
  // Filtres techniques sans valeur textuelle utile : retirés.
  assert.equal(translateQueryForSource("nurse pages:>20 order:popular"), "nurse");
  // Négation : la valeur reste mais le préfixe disparaît (plein texte).
  assert.equal(translateQueryForSource('-tag:"yaoi" naruto'), "yaoi naruto");
  // Texte libre : inchangé.
  assert.equal(translateQueryForSource("bakunyu"), "bakunyu");
  assert.equal(translateQueryForSource(undefined), undefined);
});

test("parseDoujinsTagsPage: extrait nom + id depuis /tags", () => {
  const html = `
    <a href="/series">Series</a>
    <a href="/tags/Bakunyuu-14?x=13">Bakunyuu</a>
    <a href="/tags/BBW-1320?x=13">BBW</a>
    <a href="/tags/Audio-45943">Audio</a>
    <a href="/tags/Bakunyuu-14?x=13">Bakunyuu</a>
  `;
  const tags = parseDoujinsTagsPage(html);
  assert.equal(tags.length, 3);
  assert.deepEqual(tags[0], { name: "Bakunyuu", id: "14" });
  assert.deepEqual(tags[1], { name: "BBW", id: "1320" });
  assert.deepEqual(tags[2], { name: "Audio", id: "45943" });
});

test("parseDoujinsTagsPage: liste vide -> tableau vide", () => {
  assert.deepEqual(parseDoujinsTagsPage("<html><body>rien</body></html>"), []);
});

test("dedupeTags: dédup insensible à la casse et tri alphabétique", () => {
  const merged = dedupeTags([
    { name: "Vanilla" },
    { name: "vanilla" },
    { name: "Bakunyuu", count: 14 },
    { name: "Audio" },
  ]);
  assert.deepEqual(
    merged.map((t) => t.name),
    ["Audio", "Bakunyuu", "Vanilla"]
  );
});

test("parseThreeHentaiTagsPage: nom + compteur data-qty depuis /tags?letter=", () => {
  const html = `
    <div class="tag-listing-container">
      <span class="filter-elem">
        <a class="name" href="https://fr.3hentai.net/tags/abortion-female" data-qty="24">abortion (female)</a>
      </span><span class="filter-elem">
        <a class="name" href="https://fr.3hentai.net/tags/absorption-female" data-qty="413">absorption (female)</a>
      </span><span class="filter-elem">
        <a class="name" href="https://fr.3hentai.net/tags/afro-male" data-qty="7">afro (male)</a>
      </span>
    </div>
  `;
  const tags = parseThreeHentaiTagsPage(html);
  assert.equal(tags.length, 3);
  assert.deepEqual(tags[0], { name: "abortion (female)", count: 24 });
  assert.deepEqual(tags[1], { name: "absorption (female)", count: 413 });
  assert.deepEqual(tags[2], { name: "afro (male)", count: 7 });
});

test("parseThreeHentaiDetailTags: lit les sections actuelles de la fiche", () => {
  const html = `
    <div class="tag-container field-name">
      <span class="font-weight-bold">Catégories :</span>
      <span class="filter-elem tag-category"><a class="name" data-qty="213k">doujinshi</a></span>
    </div>
    <div class="tag-container field-name">
      <span class="font-weight-bold">Tags :</span>
      <span class="filter-elem"><a class="name" data-qty="1.2k">vanilla</a></span>
      <span class="filter-elem"><a class="name" data-qty="24">romance</a></span>
    </div>
    <div class="tag-container field-name">
      <span class="font-weight-bold">Artistes :</span>
      <span class="filter-elem"><a class="name">Example Artist</a></span>
    </div>
  `;
  assert.deepEqual(parseThreeHentaiDetailTags(html), [
    { name: "doujinshi", type: "category", count: 213000 },
    { name: "vanilla", type: "tag", count: 1200 },
    { name: "romance", type: "tag", count: 24 },
    { name: "Example Artist", type: "artist", count: undefined },
  ]);
});

test("parseNozomiIds: lit les IDs uint32 big-endian Hitomi", () => {
  // 0x003f354d = 4142413, 0x003f34f4 = 4142324
  const bytes = new Uint8Array([0x00, 0x3f, 0x35, 0x4d, 0x00, 0x3f, 0x34, 0xf4]);
  assert.deepEqual(parseNozomiIds(bytes.buffer), ["4142413", "4142324"]);
});

test("thumbUrl: chemin webpsmalltn atn|btn (common.js tn)", () => {
  const table = { oneSet: new Set<number>(), b: "1787551201/", fetchedAt: 0 };
  const hash =
    "aab8cbaf2625515d3c0a390f20f8e925386286214f6a4449f76ae37dc33adfeb";
  const url = thumbUrl(table, hash, "webpsmalltn");
  assert.match(
    url,
    /^https:\/\/[ab]tn\.gold-usergeneratedcontent\.net\/webpsmalltn\/b\/fe\/[0-9a-f]{64}\.webp$/
  );
});


test("parseEhentaiNativeId: sépare gid et token proprement", () => {
  assert.deepEqual(parseEhentaiNativeId("3184920/a9b8c7d6e5"), { gid: "3184920", token: "a9b8c7d6e5" });
  assert.deepEqual(parseEhentaiNativeId("3184920_a9b8c7d6e5"), { gid: "3184920", token: "a9b8c7d6e5" });
  assert.deepEqual(parseEhentaiNativeId("/3184920/a9b8c7d6e5/"), { gid: "3184920", token: "a9b8c7d6e5" });
});

test("parseEhentaiListingCards: extrait titre, gid, token, cover et metadata", () => {
  const html = `
    <table class="itg gltc">
      <tr class="gtr0">
        <td class="gl1c glcat"><div class="cn cs-doujinshi">Doujinshi</div></td>
        <td class="gl2c">2026-11-09 12:00</td>
        <td class="gl1c"><div class="ir it2" style="background-image:url(https://ehgt.org/g/sample.jpg)"><img src="https://ehgt.org/g/sample.jpg"/></div></td>
        <td class="gl3c glname">
          <a href="https://e-hentai.org/g/3184920/a9b8c7d6e5/"><div class="glink">[Circle] Sample Doujin Title</div></a>
        </td>
        <td class="gl4c glhide"><div>24 pages</div></td>
      </tr>
    </table>
  `;
  const cards = parseEhentaiListingCards(html);
  assert.equal(cards.length, 1);
  assert.equal(cards[0].globalId, "ehentai:3184920_a9b8c7d6e5");
  assert.equal(cards[0].title, "[Circle] Sample Doujin Title");
  assert.equal(cards[0].category, "Doujinshi");
  assert.equal(cards[0].numPages, 24);
  assert.equal(cards[0].coverUrl, "https://ehgt.org/g/sample.jpg");
});

test("ehentaiCategories: calcule le masque binaire f_cats et résout les couleurs", () => {
  const mask = calculateCategoryBitmask(["Doujinshi", "Manga"]);
  assert.equal(mask, 6);
  const info = getEhentaiCategoryInfo("Doujinshi");
  assert.equal(info.color, "#e63946");
  assert.equal(info.name, "Doujinshi");
  const misc = getEhentaiCategoryInfo("UnknownCategory");
  assert.equal(misc.id, "Misc");
});

test("rule34: formatte le titre et découpe les tags", () => {
  const title = buildRule34Title(9876543, "hatsune_miku vocaloid 1girl rating:questionable");
  assert.equal(title, "hatsune miku, vocaloid, 1girl (#9876543)");
  const emptyTitle = buildRule34Title(123, "");
  assert.equal(emptyTitle, "Rule34 #123");
  const tags = parseRule34Tags("hatsune_miku 1girl");
  assert.deepEqual(tags, [
    { name: "hatsune miku", type: "tag" },
    { name: "1girl", type: "tag" },
  ]);
});

test("authStore: parse et formate les cookies de session isolés", () => {
  const parsed = parseCookieString("ipb_member_id=12345; ipb_pass_hash=abcdef; igneous=panda; ");
  assert.equal(parsed.ipb_member_id, "12345");
  assert.equal(parsed.ipb_pass_hash, "abcdef");
  assert.equal(parsed.igneous, "panda");

  const formatted = formatCookieHeader({
    ipb_member_id: "12345",
    ipb_pass_hash: "abcdef",
  });
  assert.equal(formatted, "ipb_member_id=12345; ipb_pass_hash=abcdef");
});

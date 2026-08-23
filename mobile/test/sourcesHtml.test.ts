import { test } from "node:test";
import assert from "node:assert/strict";
import {
  extractMatches,
  decodeEntities,
  stripTags,
  extractAttribute,
  stripNhentaiOperators,
  sanitizeMediaUrl,
} from "../lib/sources/html";
import { parseDoujinsListCards } from "../lib/sources/doujins";

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

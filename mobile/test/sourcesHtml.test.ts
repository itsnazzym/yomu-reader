import { test } from "node:test";
import assert from "node:assert/strict";
import {
  extractMatches,
  decodeEntities,
  stripTags,
  extractAttribute,
} from "../lib/sources/html";

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

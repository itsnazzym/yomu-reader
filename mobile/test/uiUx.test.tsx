import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import test from "node:test";
import assert from "node:assert/strict";
import { CardPressable } from "@/components/ui/CardPressable";
import { ButtonLabel } from "@/components/ui/ButtonLabel";
import { getHomeSearchQuery, setHomeSearchQuery, toggleHomeSearchTerm } from "@/lib/homeSearchStore";
import { queryContainsTerm } from "@/lib/searchQuery";

test("un bouton en ligne garde icône et texte comme enfants directs de son conteneur", () => {
  const html = renderToStaticMarkup(<CardPressable style={{ flexDirection: "row", gap: 8, transform: [{ rotate: "3deg" }] }}><span>Icône</span><ButtonLabel>Mot de passe oublié</ButtonLabel></CardPressable>);
  assert.match(html, /<button[^>]*><span>Icône<\/span><span[^>]*>Mot de passe oublié<\/span><\/button>/);
  assert.match(html, /flexDirection[^>]*row/);
  assert.match(html, /rotate[^>]*3deg/);
});

test("un libellé long reste complet sans limite de lignes ni réduction automatique", () => {
  const label = "Synchroniser tous les favoris de mon compte";
  const html = renderToStaticMarkup(<ButtonLabel>{label}</ButtonLabel>);
  assert.ok(html.includes(label));
  assert.doesNotMatch(html, /data-lines=|data-shrinks=/);
  assert.match(html, /data-font-limit="1.6"/);
});

test("le bouton animé conserve son état désactivé et son nom accessible", () => {
  const html = renderToStaticMarkup(<CardPressable disabled accessibilityLabel="Enregistrer le mot de passe"><ButtonLabel>Enregistrer</ButtonLabel></CardPressable>);
  assert.match(html, /disabled=""/);
  assert.match(html, /aria-label="Enregistrer le mot de passe"/);
});

test("les ajouts et retraits successifs de tags conservent chaque action sans doublon", () => {
  const previous = getHomeSearchQuery();
  try {
    setHomeSearchQuery("");
    const terms = ["romance", "slice of life", "science fiction", "female protagonist"];
    for (const name of terms) toggleHomeSearchTerm("tag", name);
    for (const name of terms) assert.equal(queryContainsTerm(getHomeSearchQuery(), "tag", name), true);
    for (let round = 0; round < 4; round++) for (const name of terms) toggleHomeSearchTerm("tag", name);
    for (const name of terms) assert.equal(queryContainsTerm(getHomeSearchQuery(), "tag", name), true);
    for (const name of terms) toggleHomeSearchTerm("tag", name);
    assert.equal(getHomeSearchQuery(), "");
  } finally { setHomeSearchQuery(previous); }
});

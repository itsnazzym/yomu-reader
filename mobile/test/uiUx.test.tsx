import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import test from "node:test";
import assert from "node:assert/strict";
import { CardPressable } from "@/components/ui/CardPressable";
import { ButtonLabel } from "@/components/ui/ButtonLabel";
import { getHomeSearchQuery, setHomeSearchQuery, toggleHomeSearchTerm } from "@/lib/homeSearchStore";
import { queryContainsTerm } from "@/lib/searchQuery";
import { __getTouchHandlers, __setReduceMotion } from "./mockUiReactNative";
import { __getLastAnimatedValue } from "./mockReanimated";
import { GuideIllustration } from "@/components/auth/GuideIllustration";
import { AUTH_GUIDES } from "@/lib/authGuides";

for (const [id, guide] of Object.entries(AUTH_GUIDES)) {
  test(`le guide ${id} affiche ses repères complets sans chargeur d’images`, () => {
    const html = renderToStaticMarkup(<GuideIllustration guide={guide} />);
    for (const field of guide.fields) {
      assert.ok(html.includes(field.name), `Repère absent : ${field.name}`);
      assert.ok(html.includes(field.destination), `Destination absente : ${field.destination}`);
    }
    assert.ok(html.includes("Schéma explicatif"));
    assert.ok(html.includes("aucune donnée de compte affichée"));
    assert.doesNotMatch(html, /<img\b|data:image|Illustration indisponible|data-lines=/);
  });
}

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

test("le mouvement tactile conserve les callbacks et respecte la réduction des animations", () => {
  let presses = 0;
  const render = () => renderToStaticMarkup(<CardPressable onPressIn={() => presses++}><ButtonLabel>Ouvrir</ButtonLabel></CardPressable>);
  render();
  __getTouchHandlers().onPressIn({});
  assert.equal(__getLastAnimatedValue(), 0.94);
  __getTouchHandlers().onPressOut({});
  assert.equal(__getLastAnimatedValue(), 1);
  try {
    __setReduceMotion(true);
    render();
    __getTouchHandlers().onPressIn({});
    assert.equal(__getLastAnimatedValue(), 1);
    assert.equal(presses, 2);
  } finally { __setReduceMotion(false); }
});

test("un contrôle désactivé ne déclenche ni animation ni callback tactile", () => {
  let presses = 0;
  renderToStaticMarkup(<CardPressable disabled onPressIn={() => presses++}><ButtonLabel>Patienter</ButtonLabel></CardPressable>);
  __getTouchHandlers().onPressIn({});
  assert.equal(__getLastAnimatedValue(), 1);
  assert.equal(presses, 0);
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

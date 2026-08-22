import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeResumeOffset,
  classifyResumeResponse,
} from "../lib/resumableDownload";

test("calcule l'octet de reprise depuis un fichier partiel", () => {
  assert.equal(computeResumeOffset({ partialSize: 1024, totalBytes: -1 }), 1024);
});

test("repart de zéro si le partiel est vide ou négatif", () => {
  assert.equal(computeResumeOffset({ partialSize: 0, totalBytes: -1 }), 0);
  assert.equal(computeResumeOffset({ partialSize: -5, totalBytes: -1 }), 0);
});

test("repart de zéro si le partiel dépasse la taille totale (fichier corrompu)", () => {
  assert.equal(computeResumeOffset({ partialSize: 5000, totalBytes: 4096 }), 0);
  assert.equal(computeResumeOffset({ partialSize: 4096, totalBytes: 4096 }), 0);
});

test("accepte un partiel strictement inférieur à la taille totale connue", () => {
  assert.equal(computeResumeOffset({ partialSize: 100, totalBytes: 4096 }), 100);
});

test("arrondit à l'octet inférieur les tailles fractionnaires", () => {
  assert.equal(computeResumeOffset({ partialSize: 1024.7, totalBytes: -1 }), 1024);
});

test("classifyResumeResponse: 206 signifie que le serveur a repris au Range demandé", () => {
  assert.equal(classifyResumeResponse(206), "resumed");
});

test("classifyResumeResponse: 200 signifie que le serveur a ignoré le Range (redémarrage complet)", () => {
  assert.equal(classifyResumeResponse(200), "restarted");
});

test("classifyResumeResponse: les autres statuts sont des échecs", () => {
  assert.equal(classifyResumeResponse(403), "failed");
  assert.equal(classifyResumeResponse(500), "failed");
  assert.equal(classifyResumeResponse(0), "failed");
});

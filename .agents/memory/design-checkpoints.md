---
type: reference
created: 2026-08-18
updated: 2026-08-18
---

# Design Checkpoints & Revert Guide

## Checkpoint: `PRE_TACTILE_MANGA_DESIGN_V1`

### Date : 18 Août 2026

### Trigger pour Revert (Phrases magiques reconnues) :
- `revert design`
- `annule le design manga`
- `reviens au design d'avant`
- `/revert-design`

---

### Fichiers Modifiés par cette Étape :
1. `mobile/components/BookCard/index.tsx` (Cartes manga avec Tankōbon proportion, archive stamp, matte info slab)
2. `mobile/components/ui/AnimatedEmptyState.tsx` (Sceau Hanko 判子 japonais, typographie éditoriale, dalle de pierre)
3. `mobile/app/tags/index.tsx` (Taxonomie d'atelier : plume pour artists, pastille gravée parodies, chips avec [count])
4. `mobile/app/book/[id]/index.tsx` (Fiche exposition : cover shadow, bouton dalle monochrome, numérotation de planches)
5. `mobile/components/SideMenu/index.tsx` (Sommaire relié : diode réseau, filets ultra-fins 0.5px, compteurs discrets)

---

### Instructions de Revert Automatique :
Si l'utilisateur prononce l'une des phrases de revert ci-dessus :
1. Consulter ce fichier.
2. Restaurer l'ancienne version des 5 fichiers.
3. Vérifier avec `npx tsc --noEmit` et `npm test`.

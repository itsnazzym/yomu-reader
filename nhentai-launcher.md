# Plan de Réalisation : nHentai Desktop Launcher — Version Finale 1.0

> **Objectif :** Logo authentique nHentai (ailes de chauve-souris roses + typographie nHentai.net), données réelles nHentai API v2 avec clé `nhk_`, cache local en mémoire, liseuse résiliente et téléchargement CBZ.
> **Stack :** React 19 + TypeScript + Vite + Tailwind CSS + Electron + nHentai API v2 + electron-builder

---

## 🗂️ État d'Avancement des Tâches v1.0

### [Phase 1] Navigation Supérieure 2 Niveaux (Header 1:1)
- [x] **Task 1.1** : Logo authentique nHentai vectoriel avec ailes de chauve-souris roses et typographie `nHentai.net`.
- [x] **Task 1.2** : Barre de recherche centrale avec bouton carré magenta.
- [x] **Task 1.3** : Boutons rapides `Téléchargements` et `Paramètres`.
- [x] **Task 1.4** : Sélecteur de langue avec drapeaux (🇫🇷 FR, 🇬🇧 EN, 🇯🇵 JA, 🇪🇸 ES, 🇮🇹 IT, etc.).
- [x] **Task 1.5** : Sous-barre de navigation horizontale (`Aléatoire`, `Séries`, `Tags`, `Personnages`, `Artistes`, `Groupes`, `Ma Bibliothèque`, `Téléchargement par Lot`).

### [Phase 2] Données Réelles de Taxonomie & Cache Local API v2
- [x] **Task 2.1** : Paramètre `per_page=100` conforme à l'API v2.
- [x] **Task 2.2** : Système de cache local mémoire avec TTL 1h dans le processus principal Electron (`tagCache`).
- [x] **Task 2.3** : Navigation temps réel dans `TaxonomyBrowserView.tsx` (Groupes, Séries, Artistes, Tags, Personnages).

### [Phase 3] Fiche Détaillée, Miniatures & Liseuse Résiliente
- [x] **Task 3.1** : Composant `ThumbnailImage` avec auto-fallback (`1t.webp` -> `1t.jpg` -> `1t.png` -> `1.webp`).
- [x] **Task 3.2** : Composant `ReaderImage` avec chaîne de repli pour la liseuse Manga et Webtoon.
- [x] **Task 3.3** : Téléchargements CBZ avec métadonnées `ComicInfo.xml`.

### [Phase 4] Build & Compilation
- [x] **Task 4.1** : Build TypeScript et Vite validé à 100% avec 0 erreur.

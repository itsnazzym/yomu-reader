---
type: project
created: 2026-08-17
updated: 2026-08-22
---

# Mobile App — Architecture & Fichiers Clés

## Structure des répertoires importants
```
mobile/
├── app/
│   ├── _layout.tsx               ← Drawer + Stack root layout
│   ├── index.tsx                 ← HomeScreen (grille + filtres + pagination)
│   ├── settings/index.tsx        ← Settings complet (couleurs/sliders/langue)
│   ├── favorites.tsx             ← Favoris (onglets Tous/nHentai.net/Signets) + Cloud Sync
│   ├── recommendations.tsx       ← Moteur de recommandations IA local
│   ├── history.tsx               ← Historique de lecture local
│   ├── batch.tsx                 ← Gestionnaire de téléchargement par lot
│   ├── downloaded.tsx            ← Bibliothèque Hors-Ligne (lecteur local)
│   ├── tags/index.tsx            ← Taxonomie des tags / artistes / parodies
│   ├── api-keys/index.tsx        ← Gestionnaire de clés API nHentai v2
│   ├── profile.tsx               ← Profil utilisateur et statut de synchronisation
│   ├── book/[id]/index.tsx       ← Fiche détaillée manga (commentaires, tags, preview)
│   └── read.tsx                  ← Lecteur manga / webtoon (en ligne + local via `local`)
├── components/
│   ├── BookCard/index.tsx        ← Carte manga tactile (puces colorées par type)
│   ├── SearchBar.tsx             ← Barre de recherche haute interactive
│   ├── SmartImage.tsx            ← CDN Photon Edge pour bypass DNS FAI
│   ├── SideMenu/index.tsx        ← Drawer latéral tactile (fleurs, sparkles ✧✦)
│   ├── modals/
│   │   ├── SignInModal.tsx       ← Authentification v2 (refresh_token / clé API / sessionid)
│   │   ├── FilterModal.tsx       ← Filtres complets : langue, pages, date, tri
│   │   ├── ReverseImageSearchModal.tsx ← Recherche inversée d'images (SauceNAO, iqdb)
│   │   └── QuickShareModal.tsx   ← Hub de partage rapide
│   ├── onboarding/
│   │   └── OnboardingModal.tsx   ← Flow d'onboarding en 4 étapes (Welcome, Theme, Reader, Account)
│   ├── auth/
│   │   ├── CaptchaEmbed.tsx      ← Passerelle Webview Cloudflare
│   │   └── AuthPowProgressBar.tsx ← Barre de progression PoW SHA-256
│   └── ui/
│       ├── SmoothSlider.tsx      ← Slider PanResponder (bypass bug Android Fabric)
│       ├── IconBtn.tsx           ← Bouton tactile instantané
│       └── TablerIcons.tsx       ← Icônes Tabler vectorielles
├── lib/
│   ├── api/nhentai.ts            ← nativeFetch, déduplication inFlightRequests, cache mémoire
│   ├── api/imsearch.ts           ← API de recherche inversée d'images
│   ├── accountStore.ts           ← Session, gestion des tokens v2 et auto-sync
│   ├── favoritesStore.ts         ← Store favoris locaux + import cloud avec tags
│   ├── downloadQueueStore.ts     ← File de téléchargement batch (worker, URLs proxifiées)
│   ├── historyStore.ts           ← Historique de lecture avec progression de page
│   ├── recommendationEngine.ts   ← Moteur prédictif local multi-signaux
│   ├── backupStore.ts            ← Export / Import JSON v2 avec expo-sharing
│   ├── persistQueue.ts           ← File d'écriture atomique pour AsyncStorage
│   ├── imageIntegrity.ts         ← Validation des magic bytes d'images (JPEG, PNG, WebP)
│   ├── tagFavoritesStore.ts      ← Store des tags favoris
│   ├── tagCollectionsStore.ts    ← Collections de tags personnalisées
│   ├── readerSettingsStore.ts    ← Paramètres de la liseuse (sens, mode, double page)
│   ├── localLibrary.ts           ← Indexation et gestion du stockage hors-ligne
│   ├── blacklistFilter.ts        ← Filtrage des tags exclus et floutage NSFW
│   └── ThemeContext.tsx          ← Thème dark OLED (#12121a) + palette 25 teintes
└── test/
    ├── engine.test.ts            ← 21 tests unitaires complets du moteur mobile
    ├── bundle.mjs                ← Script de build esbuild pour exécuter les tests sous Node
    ├── mockReactNative.ts        ← Mocks environnementaux React Native
    └── mockSecureStore.ts        ← Mocks pour SecureStore
```

## Composants Design System (couleurs de référence)
- **Fond principal:** `#12121a` (Dark OLED)
- **Carte / Surface:** `#161622`
- **Bordures:** `#28283a`
- **Texte principal:** `#f3f4f6`
- **Texte secondaire:** `#9ca3af`
- **Accent rose par défaut:** `#c5878d`
- **Tag chips par type:**
  - `artist` → `#f472b6` (rose)
  - `group` → `#c084fc` (violet)
  - `parody` → `#a78bfa` (violet clair)
  - `character` → `#22d3ee` (cyan)
  - `tag` → `#93c5fd` (bleu)
  - `language` → `#fbbf24` (ambre)

## Moteur de Recommandations & Signaux
- `recommendationEngine.ts` analyse l'historique et les favoris.
- Pondération : Favoris récents (3x) > Termes de recherche explicites > Historique de lecture.
- Nettoyage des opérateurs syntaxiques (`pages:`, `date:`) pour éviter les tags parasites.
- Mémorisation des livres déjà montrés dans la session pour des rafraîchissements sans doublons.

## Sauvegarde & Intégrité
- `backupStore.ts` : Export complet au format JSON v2 (`expo-sharing` ou presse-papier).
- `imageIntegrity.ts` : Contrôle des magic bytes (JPEG/PNG/WebP) et seuil de taille avant validation de téléchargement.
- `persistQueue.ts` : Évite les conflits et corruptions lors des écritures concurrentes dans `AsyncStorage`.

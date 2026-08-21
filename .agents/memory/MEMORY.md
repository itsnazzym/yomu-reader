# Memory Index

## User
- [user] Développeur FR, Windows 11, PowerShell, Expo/Android Pixel 8 (`emulator-5554`) → user-preferences.md
- [user] Préfère réponses concises en français avec emojis et listes structurées → user-preferences.md
- [user] Exige réactivité instantanée, animations fluides et DA sombre manga (NHApp 1:1) → user-preferences.md

## Project
- [project] Créer systématiquement une branche dédiée (`feature/*` ou `fix/*`) avant modifications majeures → project-conventions.md
- [project] AG Kit supporte uniquement Gemini CLI et Google Antigravity → project-conventions.md
- [project] Monorepo : Desktop (Electron 43/React 19), Mobile (Expo SDK 52/RN 0.76), Proxy (Node :8787), Web (Next.js) → project-conventions.md
- [project] Sécurité .gitignore : interdiction de 'backup*' générique pour protéger backupStore.ts → project-conventions.md
- [project] Mobile : pas d'Axios (nativeFetchJson + inFlightRequests dedup + galleryCache) → project-conventions.md
- [project] Mobile : pas de slider natif, toujours SmoothSlider.tsx (PanResponder Fabric) → project-conventions.md
- [project] Mobile : pas de Pressable dans les listes → TouchableOpacity avec swipeEdgeWidth=35 Drawer → project-conventions.md
- [project] Images : CDN Photon Edge (i0.wp.com) uniquement pour *.nhentai.net (bypass blocage DNS FAI) → project-conventions.md
- [project] Proxy miroir Photon (:8787) : solveur PoW SHA-256 dynamique, failover nhentai.xxx, Range 206 → desktop-app-architecture.md
- [project] Moteur de recommandation local : signaux multi-sources (favoris 3x > recherche > historique) → mobile-app-architecture.md
- [project] Sauvegarde universelle JSON v2 : export/import complet avec expo-sharing (backupStore.ts) → mobile-app-architecture.md
- [project] Intégrité fichiers : validation binaire des magic bytes d'images (JPEG, PNG, WebP) → mobile-app-architecture.md
- [project] Écritures atomiques : persistQueue.ts pour sérialiser les écritures AsyncStorage → mobile-app-architecture.md
- [project] Desktop : DoH multi-DNS natif (Cloudflare, Google, AdGuard, Quad9) + export CBZ ComicInfo.xml → desktop-app-architecture.md
- [project] Tests de validation : npm run test:proxy (proxy) et npm test dans mobile/ (21 tests) → project-conventions.md

## Feedback
- [feedback] Alignement 1:1 avec NHApp open-source (référence UX/UI mobile) → feedback-history.md
- [feedback] Déteste : Axios, sliders natifs instables, redirections vers Settings au lieu de modales → feedback-history.md
- [feedback] Aime : dark OLED pur (#12121a), sparkles ✧✦, micro-animations, filtres riches → feedback-history.md

## Reference
- [reference] Résolveur DoH Desktop dans main.cjs (contournement FAI sans toucher à l'OS) → desktop-app-architecture.md
- [reference] Endpoints proxy : /img (HTTP 206), /api/tags/ids (cache mémoire), /api/keys (PoW SHA-256) → desktop-app-architecture.md
- [reference] Cloud sync : X-Refresh-Token ou X-Api-Key via proxy avec auto-planification 30m sans setInterval → tech-decisions.md
- [reference] Liseuse hors-ligne : downloaded.tsx → /read?local=<dossier> (metadata.json + file://) → mobile-app-architecture.md
- [reference] FlashList mobile : estimatedItemSize=240, numColumns dynamique (2 phone / 3 tablet) → tech-decisions.md
- [reference] Checkpoint Design Tactile Manga V1 & Revert Guide → design-checkpoints.md

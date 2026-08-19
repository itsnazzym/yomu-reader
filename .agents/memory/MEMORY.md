# Memory Index

## User
- [user] Développeur FR, Windows 11, PowerShell, Expo/Android → user-preferences.md
- [user] Préfère réponses concises en français avec emojis → user-preferences.md
- [user] ADB Pixel 8: `emulator-5554`, Expo Go 2.32.20 SDK 52 → user-preferences.md

## Project
- [project] Always create a new dedicated branch for major code changes → project-conventions.md
- [project] AG Kit only supports Gemini CLI and Google Antigravity → project-conventions.md
- [project] Mobile working dir: `nhentaidownlo/mobile` (React Native Expo SDK 52) → project-conventions.md
- [project] NO Axios → nativeFetchJson + inFlightRequests dedup + galleryCache → project-conventions.md
- [project] NO @react-native-community/slider → SmoothSlider.tsx (PanResponder) → project-conventions.md
- [project] NO Pressable in lists → TouchableOpacity + swipeEdgeWidth=35 Drawer → project-conventions.md
- [project] Images via Photon CDN: i0.wp.com/t.nhentai.net/{path} bypass DNS blocage FAI FR → project-conventions.md
- [project] Architecture complète des fichiers mobiles → mobile-app-architecture.md
- [project] Tag chips colorés par type (artist=rose, group=violet, etc.) → mobile-app-architecture.md
- [project] nhentai.net bloqué (SSL) → proxy miroir `npm run proxy` port 8787, bascule nhentai.to → nhentai.xxx → tech-decisions.md + project-conventions.md
- [project] Fallback API mobile : v2 → v1 → proxy miroir (10.0.2.2:8787 émulateur) → mobile-app-architecture.md
- [project] IDs DIFFÈRENT entre miroirs → pas de bascule sur 404 → tech-decisions.md
- [project] Téléchargement batch via proxy miroir (worker downloadQueueStore, pages via /img, ext. déduite de l'URL) → mobile-app-architecture.md
- [project] Lecture hors-ligne : downloaded.tsx → /read?local=<dossier> (metadata.json + pages file://, couverture = page 1 locale) → mobile-app-architecture.md
- [reference] Stores useSyncExternalStore : snapshot DOIT changer de référence (fix getDownloadQueueSnapshot) → tech-decisions.md

## Feedback
- [feedback] Préfère alignement 1:1 avec NHApp open-source → feedback-history.md
- [feedback] Déteste: Axios, sliders natifs, redirections vers Settings, interactions lentes → feedback-history.md
- [feedback] Aime: dark premium design, sparkles ✧✦, animations smooth, filtres complets → feedback-history.md

## Tech Decisions
- [project] Component metadata SemVer, toolkit releases CalVer → tech-decisions.md
- [reference] SmoothSlider PanResponder: seul slider fiable sur Fabric/Bridgeless Android → tech-decisions.md
- [reference] Cloud sync: sessionid cookie → /api/v2/favorites + merge Map<id,Gallery> → tech-decisions.md
- [reference] FlashList estimatedItemSize=240, numColumns dynamique (2 phone / 3 tablet) → tech-decisions.md
- [reference] Checkpoint Design Tactile Manga V1 & Revert Guide → design-checkpoints.md

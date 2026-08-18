---
type: project
created: 2026-05-25
updated: 2026-08-17
---

# Project Conventions

## Git Workflow
- Always create a new dedicated branch for major code changes.
- Branch name format should follow: `feature/[task-slug]` or `fix/[bug-slug]`.

## Supported AI platforms (AG Kit)
- AG Kit **only supports Gemini CLI and Google Antigravity**.
- Do not claim compatibility with Claude Code, Cursor, Copilot, Windsurf, or other assistants unless the user explicitly expands scope.
- Copy on the website, docs, FAQ, README, and marketing should describe AG Kit as a toolkit for Gemini CLI / Antigravity-style agent setups.

## Mobile App (nhentai-launcher) — React Native / Expo
- **Working directory:** `c:\Users\entre\Documents\Dev\nhentaidownlo\mobile`
- **Platform:** Android (Pixel 8 emulator `emulator-5554`), Expo Go 2.32.20, SDK 52.
- **Lancer l'app:** `npx expo start --localhost` dans `mobile/`.
- **Proxy miroir (nhentai.net bloqué) :** `npm run proxy` à la RACINE du repo → port `8787`. L'app mobile bascule automatiquement dessus (v2 → v1 → miroir) quand nhentai.net est injoignable.
- **Reload ADB:** `adb -s emulator-5554 shell am start -a android.intent.action.VIEW -d "exp://127.0.0.1:8081" host.exp.exponent`
- **Après une édition de code :** si Metro sert un bundle périmé, redémarrer avec `npx expo start --clear` (watcher pas toujours fiable sur ce poste).
- **Émulateur qui ne boote pas (crash OpenGL) :** relancer avec `-gpu host` (`emulator -avd Pixel_8 -gpu host -no-snapshot -no-boot-anim`).
- **NO Axios:** Remplacé par `nativeFetchJson` natif + déduplication `inFlightRequests` + cache `galleryCache`.
- **Sliders:** Toujours utiliser `SmoothSlider.tsx` (PanResponder) jamais `@react-native-community/slider` (bug Android/Fabric).
- **Touchables:** Toujours utiliser `TouchableOpacity` avec `activeOpacity`, JAMAIS `Pressable` avec closures imbriquées (latence).
- **Haptics:** Ne JAMAIS utiliser `expo-haptics` sur le fil principal (latence 50-150ms Android).
- **Drawer:** `swipeEdgeWidth={35}` obligatoire pour éviter l'interception des gestes tactiles sur tout l'écran.
- **Images:** CDN Photon Edge `https://i0.wp.com/t.nhentai.net/{path}` pour bypass blocage DNS FAI français, UNIQUEMENT pour les hôtes `*.nhentai.net`. `SmartImage.tsx` passe les autres URLs (dont `/img` du proxy miroir) telles quelles.
- **API:** nHentai API v2 — résultats dans `result[]`, `english_title` contient `[Circle (Artist)] Title (Parody) [Language]`. Cascade de secours : v2 → v1 → proxy miroir local (`10.0.2.2:8787` sur émulateur).

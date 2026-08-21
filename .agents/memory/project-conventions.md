---
type: project
created: 2026-05-25
updated: 2026-08-22
---

# Project Conventions

## Git Workflow & Repository Rules
- Always create a new dedicated branch for major code changes: `feature/[task-slug]` or `fix/[bug-slug]`.
- **.gitignore Safety:** Ne JAMAIS utiliser de pattern générique `backup*` (qui ignorerait des sources comme `backupStore.ts`). Cibler strictement `*.bak`, `*.backup`, `*.tmp`, `backupdepackagejson.txt`.
- Tous les scripts de tests et de validation doivent passer avant validation de release.

## Supported AI platforms (AG Kit)
- AG Kit **only supports Gemini CLI and Google Antigravity**.
- Do not claim compatibility with Claude Code, Cursor, Copilot, Windsurf, or other assistants unless the user explicitly expands scope.
- Copy on the website, docs, FAQ, README, and marketing should describe AG Kit as a toolkit for Gemini CLI / Antigravity-style agent setups.

## Monorepo Architecture & Environments
1. **Desktop App:** `c:\Users\entre\Documents\Dev\nhentaidownlo` (Electron 43 + React 19 + Tailwind v4 + Vite 7).
2. **Mobile App:** `c:\Users\entre\Documents\Dev\nhentaidownlo\mobile` (React Native 0.76 + Expo SDK 52 + Expo Router v4).
3. **Proxy Miroir Photon:** `c:\Users\entre\Documents\Dev\nhentaidownlo\proxy` (Node.js port 8787, solveur PoW SHA-256).
4. **Web Portal:** `c:\Users\entre\Documents\Dev\nhentaidownlo\web` (Next.js App Router).

## Mobile App Conventions (React Native / Expo SDK 52)
- **Target Platform:** Android (Pixel 8 emulator `emulator-5554`), Expo Go 2.32.20, SDK 52.
- **Lancer l'app:** `npx expo start --localhost` dans `mobile/`.
- **Proxy miroir local :** `npm run proxy` à la RACINE du repo → port `8787`. Cascade automatique (v2 → v1 → miroir `10.0.2.2:8787`).
- **Reload ADB:** `adb -s emulator-5554 shell am start -a android.intent.action.VIEW -d "exp://127.0.0.1:8081" host.exp.exponent`
- **Après une édition de code :** si Metro sert un bundle périmé, redémarrer avec `npx expo start --clear`.
- **Émulateur qui ne boote pas (crash OpenGL) :** relancer avec `-gpu host` (`emulator -avd Pixel_8 -gpu host -no-snapshot -no-boot-anim`).
- **NO Axios:** Remplacé par `nativeFetchJson` natif + déduplication `inFlightRequests` + cache `galleryCache`.
- **Sliders:** Toujours utiliser `SmoothSlider.tsx` (PanResponder) jamais `@react-native-community/slider` (bug Android/Fabric).
- **Touchables:** Toujours utiliser `TouchableOpacity` avec `activeOpacity`, JAMAIS `Pressable` avec closures imbriquées (latence).
- **Haptics:** Ne JAMAIS utiliser `expo-haptics` sur le fil principal (latence 50-150ms Android).
- **Drawer:** `swipeEdgeWidth={35}` obligatoire pour éviter l'interception des gestes tactiles sur tout l'écran.
- **Images:** CDN Photon Edge `https://i0.wp.com/t.nhentai.net/{path}` pour bypass blocage DNS FAI français, UNIQUEMENT pour les hôtes `*.nhentai.net`. `SmartImage.tsx` passe les autres URLs (dont `/img` du proxy miroir) telles quelles.
- **Stores `useSyncExternalStore` :** Snapshot DOIT impérativement renvoyer une nouvelle référence (`Object.is`) lors d'une mutation d'état.

## Commandes de Tests & Validation
- **Tests Proxy :** `npm run test:proxy` (Node test runner natif)
- **Tests Mobile :** `cd mobile && npm test` (bundle esbuild + node --test)
- **Vérification Types :** `npx tsc --noEmit` et `cd mobile && npx tsc --noEmit`
- **Build Desktop :** `npm run dist:win` (Electron Builder)

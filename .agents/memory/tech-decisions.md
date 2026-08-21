---
type: project
created: 2026-08-17
updated: 2026-08-22
---

# Tech Decisions

## Monorepo & Versioning
- **AG Kit Versioning :** Component metadata uses SemVer while toolkit releases use CalVer.
- **Monorepo Architecture :** Desktop (Electron 43 + React 19), Mobile (Expo SDK 52 + RN 0.76), Proxy (Node.js :8787), Web (Next.js App Router).

## Mobile — React Native (Expo SDK 52, Bridgeless/Fabric)
- **Slider:** `SmoothSlider.tsx` (PanResponder) car `@react-native-community/slider` est instable sur Fabric/Bridgeless Android.
- **Touchables:** `TouchableOpacity` (pas `Pressable`) pour éviter les délais de reconciliation et freezes dans FlashList.
- **Réseau:** `fetch` natif via `nativeFetchJson` + déduplication `inFlightRequests` + cache mémoire (pas Axios).
- **Images:** CDN Photon Edge WordPress (`i0.wp.com`) pour bypass blocage DNS FAI (Orange/Free/SFR/Bouygues) sur hôtes `*.nhentai.net`.
- **Liste principale:** `@shopify/flash-list` avec `estimatedItemSize={240}` et `numColumns` dynamique (2 sur téléphone, 3 sur tablette).
- **Navigation:** `expo-router` file-based routing + `react-native-drawer-layout` pour le drawer tactile (`swipeEdgeWidth={35}`).
- **Stockage & Atomicité:** `@react-native-async-storage/async-storage` combiné à `persistQueue.ts` (file d'écriture séquentielle pour éviter les corruptions lors d'écritures concurrentes).
- **Stores `useSyncExternalStore` :** Snapshot DOIT renvoyer une nouvelle référence (`Object.is`) lors d'une mutation (ex. `getDownloadQueueSnapshot`).
- **Thème & Design:** `ThemeContext` avec teinte `hue` réglable (0-360°), fond noir pur OLED `#12121a` et palette 25 teintes.

## Moteur de Recommandation Local Multi-Signaux (`recommendationEngine.ts`)
- **Pondération des signaux :** Favoris récents (poids fort 3x) > Termes de recherche explicites > Historique de lecture.
- **Déduplication & Normalisation :** Extraction stricte des artistes (`artist:`), parodies (`parody:`), exclusion des opérateurs techniques (pages, date) et stripping des tags parasites.
- **Protection Cold-Start :** Aucun appel réseau inutile si l'utilisateur n'a aucun signal enregistré.
- **Exclusion des doublons :** Les galeries déjà affichées dans la session courante sont mémorisées et exclues lors des actualisations.

## Sauvegarde & Restauration Universelle (`backupStore.ts`)
- **Format JSON v2 :** Export/Import complet des favoris, de l'historique de lecture, des tags favoris, des collections de tags et des préférences de lecture.
- **Validation stricte :** `isValidBackupData()` vérifie les types scalaires, timestamps ISO et structures d'objets pour prévenir les injections ou corruptions.
- **Partage natif :** Utilisation de `expo-sharing` (`Sharing.shareAsync`) pour l'export de fichiers JSON avec repli automatique vers `expo-clipboard` si non disponible.

## Intégrité Binaire des Fichiers Téléchargés (`imageIntegrity.ts`)
- **Validation Magic Bytes :** Vérification des signatures binaires (JPEG `FF D8 FF`, PNG `89 50 4E 47`, WebP `RIFF...WEBP`).
- **Seuil de taille minimale :** Rejet des payloads HTML d'erreur (ex. pages 403 Cloudflare ou fichiers 0 octet) avant archivage ou lecture.

## Miroir Proxy Local Photon (`proxy/nhentai-mirror.mjs`)
- **Solveur PoW SHA-256 :** Résolution dynamique des défis cryptographiques (`action=create_api_key`, etc.) par calcul local de nonce en ~10ms.
- **Support HTTP 206 (Partial Content) :** Prise en charge des en-têtes `Range`, `Accept-Ranges` et `Content-Range` sur l'endpoint `/img` pour permettre la reprise des téléchargements via `createDownloadResumable`.
- **Résolution des Tags par ID :** Endpoint `/api/tags/ids` avec cache mémoire pour mapper instantanément les IDs numériques des favoris v2 vers leurs noms textuels.
- **Failover Intelligent :** Basculement automatique de `nhentai.to` vers `nhentai.xxx` avec mise en quarantaine et backoff exponentiel.
- **Règle des IDs :** Les IDs diffèrent entre miroirs (`nhentai.xxx/g/123` ≠ `nhentai.to/g/123`) → un 404 ne provoque PAS de bascule vers un autre miroir pour préserver la cohérence des données.

## Cloud Sync & Authentification Moderne
- **Authentification v2 :** Support des jetons `X-Refresh-Token`, des clés API `X-Api-Key` et de l'ancien cookie `X-Sessionid`.
- **Synchro reprenable :** Sauvegarde de l'état `syncProgress = {lastPage, maxPages, fetchedCount, failedPages}` après chaque page réussie.
- **Rate Limiting Respectueux :** Espacement de 5s par page pour respecter le quota officiel de 15 req/min et backoff dynamique sur 429 (`retryAfter`).
- **Planification Auto-Sync :** `scheduleAutoSync` via `setTimeout` chaîné (PAS de `setInterval`) décalé de 30 min après la fin réelle de la synchronisation.

---
type: project
created: 2026-08-17
updated: 2026-08-17
---

# Tech Decisions

## Component metadata uses SemVer while toolkit releases use CalVer
- Décision initiale de versioning du projet AG Kit.

## Mobile — React Native (Expo SDK 52, Bridgeless/Fabric)
- **Slider:** `SmoothSlider.tsx` (PanResponder) car `@react-native-community/slider` est buggué sur Fabric/Bridgeless Android.
- **Pressable:** `TouchableOpacity` (pas `Pressable`) pour éviter les délais de reconciliation dans FlashList.
- **Réseau:** `fetch` natif avec `nativeFetchJson` + déduplication `inFlightRequests` (pas Axios).
- **Images:** CDN Photon Edge WordPress (`i0.wp.com`) pour bypass blocage DNS FAI (Orange/Free/SFR/Bouygues).
- **Liste principale:** `@shopify/flash-list` avec `estimatedItemSize={240}` et `numColumns` dynamique.
- **Navigation:** `expo-router` file-based routing + `react-native-drawer-layout` pour le drawer.
- **Stockage local:** `@react-native-async-storage/async-storage` pour favoris, session, blacklist.
- **Stores `useSyncExternalStore` :** le getter de snapshot doit renvoyer une NOUVELLE référence quand l'état change (comparaison par `Object.is`). Bug réel corrigé : `getDownloadQueueSnapshot()` renvoyait le même objet `state` (muté en place) → l'écran batch ne se re-rendait jamais (figé sur « Téléchargement... »). Correctif : snapshot mis en cache, recréé seulement si `items`/`maxConcurrent`/`isProcessing` changent.
- **Thème:** `ThemeContext` avec `hue` (0-360°) pour générer couleur d'accent, palette 25 swatches.
- **Lecture hors-ligne :** `downloaded.tsx` ouvre `/read?local=<dossier>` (paramètre `local` de `read.tsx`) qui lit `NHAppAndroid/<dossier>/metadata.json` du disque et rend les pages `file://` (webp ou jpg). Avant : un tap ouvrait `/book/[id]` (réseau) → aucune lecture hors-ligne possible. La couverture des cartes de la Bibliothèque Hors-Ligne utilise la page 1 locale (`images.pages[0].url`), pas l'URL réseau du proxy.

## Miroir proxy local (nhentai.net bloqué sur le réseau de l'utilisateur)
- **Problème :** `nhentai.net` + `i3/t3.nhentai.net` injoignables (erreur SSL, même depuis l'hôte) ; les CDN des miroirs (`zrocdn.xyz`, `i{n}.nhentaimg.com`) sont joignables depuis l'hôte mais PAS depuis l'émulateur Android (TLS Cloudflare).
- **Solution :** `proxy/nhentai-mirror.mjs` (racine repo, `npm run proxy`, port 8787). Scrape l'HTML server-rendered de miroirs (cheerio) et sert du JSON au format nhentai (v1/v2). L'app mobile l'utilise en 3e palier après v2/v1 (`FALLBACK_API_BASE`, `10.0.2.2:8787` sur émulateur).
- **Bascule automatique :** `nhentai.to` → `nhentai.xxx`. Quarantaine avec backoff (30s→120s) sur échec réseau, HTTP 429/5xx, challenge Cloudflare ou coquille JS. Détection de challenge affinée : `challenge-platform` est injecté par Cloudflare sur TOUTES ses pages (même valides) → ne pas s'y fier seul ; vérifier `just a moment` / `challenge-form` / `cf_chl_opt` / `challenge-running`.
- **⚠️ IDs différents entre miroirs :** `nhentai.xxx/g/177013` ≠ `nhentai.to/g/177013` (même ID, contenu différent). Conséquence : un 404 n'entraîne PAS de bascule (renvoyer un autre contenu sous le même ID serait trompeur). La navigation reste cohérente car liste et détail viennent du même miroir.
- **Images :** réécriture d'URL des CDN miroirs vers `/img?u=...` (pass-through + cache mémoire, `Cache-Control` 1 jour) ; l'hôte est déduit du `Host` header de la requête, donc `10.0.2.2:8787` côté émulateur comme `localhost:8787` côté web.
- **Téléchargements en lot :** le worker (`mobile/lib/downloadQueueStore.ts`) passe par `getGallery()` (cascade → miroir) puis télécharge les pages via les URLs proxifiées `p.url` (`/img`). Extension de fichier déduite de l'URL (`detectPageExt`), pas du champ `t`. Le proxy `/img` supporte `Range` (206 + `Accept-Ranges`/`Content-Range`) pour les téléchargements reprenables d'expo-file-system (`createDownloadResumable`).
- **App mobile :** résolveurs d'URL acceptent les URLs déjà résolues (`url`/`urlThumb`) ; `SmartImage` ne transforme que les hôtes `*.nhentai.net`.

## Cloud Sync nHentai Officiel
- Méthode préférée : Cookie `sessionid` extrait du navigateur → inject dans headers `fetch`.
- Endpoint : `https://nhentai.net/api/v2/favorites?page=X`.
- Fallback si 401/403 : parse HTML `/favorites/` et extraire les IDs via regex `/g/(\d+)/`.
- Merge sans doublons via `Map<number, Gallery>` dans `importFavorites()`.

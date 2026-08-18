---
type: project
created: 2026-08-17
updated: 2026-08-17
---

# Mobile App — Architecture & Fichiers Clés

## Structure des répertoires importants
```
mobile/
├── app/
│   ├── _layout.tsx          ← Drawer + Stack root layout
│   ├── index.tsx            ← HomeScreen (grille + filtres)
│   ├── settings/index.tsx   ← Settings complet (couleurs/sliders/langue)
│   ├── favorites.tsx        ← Favoris + Cloud Sync button
│   ├── book/[id]/index.tsx  ← Fiche manga
│   ├── read.tsx             ← Lecteur manga (en ligne + local via param `local`)
│   ├── downloaded.tsx       ← Bibliothèque Hors-Ligne (lecteur local au tap)
│   └── ...
├── components/
│   ├── BookCard/index.tsx   ← Carte manga (puces colorées par type)
│   ├── SearchBar.tsx        ← Barre haut (remplacée par header inline)
│   ├── SmartImage.tsx       ← CDN Photon Edge pour bypass DNS FAI
│   ├── SideMenu/index.tsx   ← Drawer latéral (fleurs, sparkles ✧✦)
│   ├── modals/
│   │   ├── SignInModal.tsx  ← Auth + Cloud sync (sessionid/cookies)
│   │   └── FilterModal.tsx  ← Filtres: langue, pages, date, tri (NHApp 1:1)
│   └── ui/
│       ├── CardPressable.tsx ← TouchableOpacity léger SANS haptics
│       ├── IconBtn.tsx       ← Bouton icône instant
│       └── SmoothSlider.tsx  ← Slider PanResponder (bypass bug Android)
└── lib/
    ├── api/nhentai.ts        ← nativeFetch, déduplication, cache, parseTitleMetadata, FALLBACK miroir
    ├── accountStore.ts       ← Session + syncCloudFavorites (sessionid)
    ├── favoritesStore.ts     ← AsyncStorage + importFavorites (merge cloud)
    ├── downloadQueueStore.ts ← File de téléchargement batch (worker, pages via proxy miroir)
    ├── blacklistFilter.ts    ← Tags exclus + useBlacklist hook
    ├── DrawerContext.tsx     ← Context global openDrawer/closeDrawer
    └── ThemeContext.tsx      ← Thème + hue accent rose/palette 25 couleurs

> Le proxy miroir vit à la **racine du repo** (`proxy/nhentai-mirror.mjs`), PAS dans `mobile/`.
```

## Composants Design System (couleurs de référence)
- **Fond principal:** `#12121a`
- **Carte/Page:** `#161622`
- **Bordures:** `#28283a`
- **Texte principal:** `#f3f4f6`
- **Texte secondaire:** `#9ca3af`
- **Accent rose default:** `#c5878d`
- **Badge NEW:** couleur accent de l'utilisateur
- **Tag chips par type:**
  - artist → `#f472b6` (rose)
  - group → `#c084fc` (violet)
  - parody → `#a78bfa` (violet clair)
  - character → `#22d3ee` (cyan)
  - tag → `#93c5fd` (bleu)
  - language → `#fbbf24` (ambre)

## Réseau & Fallback (nhentai.net bloqué)

**Contexte :** `nhentai.net` et ses CDN (`i3/t3.nhentai.net`) sont injoignables depuis le réseau de l'utilisateur (blocage SSL/TLS, même depuis l'hôte). Deux miroirs complets sont joignables : `nhentai.to` (primaire) et `nhentai.xxx` (secondaire).

- **Proxy miroir local :** `proxy/nhentai-mirror.mjs` à la racine → `npm run proxy` (port **8787**). Scrape l'HTML server-rendered des miroirs (cheerio) et sert du JSON au format nhentai (v1/v2).
- **URL dans l'app :** `FALLBACK_API_BASE` dans `mobile/lib/api/nhentai.ts` → `http://10.0.2.2:8787` (émulateur Android) / `http://localhost:8787` (web/iOS). `10.0.2.2` = loopback hôte depuis l'émulateur, PAS de `adb reverse` nécessaire.
- **Cascade :** `searchGalleries` / `getGallery` / `getComments` / `getRandomGallery` essaient v2 → v1 → proxy miroir. Timeout `REQUEST_TIMEOUT_MS` = 8s (AbortController) pour que la bascule reste rapide.
- **Résolveurs d'URL :** `resolveCoverUrl` / `resolveThumbnailUrl` / `resolvePageUrl` / `resolvePageThumbUrl` respectent une URL déjà résolue (`imgOrCover?.url` / `?.urlThumb`) — le proxy fournit des URLs absolues (couvertures, pages, miniatures).
- **Images :** les URLs des CDN miroirs (`zrocdn.xyz`, `i{n}.nhentaimg.com`) sont réécrites par le proxy vers son endpoint `/img?u=...` (pass-through + cache) car l'émulateur ne peut pas les joindre directement (TLS Cloudflare) alors que l'hôte si.
- **`SmartImage.tsx` :** ne transforme que les hôtes `*.nhentai.net` (contournement Photon Edge). Toute URL non-nhentai (dont les URLs `/img` du proxy) est passée telle quelle — NE PAS réintroduire la transformation CDN pour les URLs du proxy.
- **Téléchargements en lot :** le worker (`downloadQueueStore.ts`) appelle `getGallery()` (cascade → miroir) puis télécharge chaque page via `p.url` (URL proxifiée `/img`). L'extension de fichier est déduite de l'URL (`detectPageExt`), PAS du champ `t` (webp vs jpg). Le proxy `/img` supporte `Range` (206) pour les reprises d'expo-file-system.
- **Bascule automatique :** en cas d'échec de nhentai.to (429/5xx/challenge/shell JS), le proxy passe sur nhentai.xxx avec quarantaine temporaire + backoff. ⚠️ Les **IDs diffèrent entre miroirs** → pas de bascule sur 404 (un ID inconnu renvoie 404 directement).

## Lecture hors-ligne (Bibliothèque Hors-Ligne)
- `downloaded.tsx` liste les dossiers `NHAppAndroid/<id>_<titre>/` et mémorise le **dossier** de chaque galerie (pas seulement les métadonnées). Un tap sur une carte ouvre `/read` avec `params: { local: <dossier> }` — jamais l'écran réseau `/book/[id]`.
- `read.tsx` : si le paramètre `local` est présent, il lit `NHAppAndroid/<local>/metadata.json` depuis le disque (expo-file-system) au lieu d'appeler `getGallery()`. Les URLs `file://` des pages (déjà résolues dans `metadata.json` par le worker) sont rendues telles quelles par `SmartImage` (aucune transformation CDN pour les URLs non-`*.nhentai.net`). État d'erreur avec bouton Retour si le dossier est introuvable.
- **Couverture locale :** `downloaded.tsx` remplace l'URL de couverture (réseau/proxy) par la **page 1 locale** (`images.pages[0].url`) via un objet `Gallery` reconstruit — la grille s'affiche hors-ligne sans passer par le proxy.
- Fonctionne pour **webp ET jpg** (expo-image décode les deux) ; vérifié dans l'émulateur : zéro requête réseau pendant la lecture (compteur `/img` du proxy inchangé).

## Patterns obligatoires
- **Stores `useSyncExternalStore` :** le getter de snapshot DOIT renvoyer une **nouvelle référence** quand l'état change (`useSyncExternalStore` compare par `Object.is`). `getDownloadQueueSnapshot()` met en cache un snapshot et n'en crée un nouveau que si `items` / `maxConcurrent` / `isProcessing` ont changé — sans ça, l'écran batch restait figé sur son rendu initial.
- **Fusion des favoris cloud idempotente + enrichissement :** `favoritesStore.importFavorites()` ajoute les favoris du site **absents localement** (source `"cloud"`) et **remplace** un favori existant dont le titre est un placeholder `« Gallery #id »` (données pauvres de l'ancien proxy) par la copie cloud riche. Un favori local (source `"local"`, vrai titre) n'est **jamais** remplacé — on ne fait que combler ses tags s'ils sont vides. Migration au `initFavorites` : un favori sans champ `source` est classé `cloud` si son titre est un placeholder, `local` sinon. Relancer une synchro ne change rien aux favoris déjà complets.
- **Favoris cloud : titres réels + tags (API v2) :** l'API v2 `/api/v2/favorites` renvoie les titres en champs **top-level** (`english_title`/`japanese_title`), une vignette relative (`thumbnail`) et les tags en **`tag_ids` numériques** (PAS `g.title.*` ni `g.tags`) — l'ancien mapping du proxy affichait tout « Gallery #id » avec zéro tag. Le proxy (`mapFavoriteGalleries`) mappe désormais ces champs et conserve `tag_ids` ; l'app les résout en tags nommés via le **nouvel endpoint `/api/tags/ids`** du proxy (relais de `GET /api/v2/tags/ids?ids=...` — public, max 100/requête, 15/min/IP — avec **cache en mémoire** par id : le premier passage paie l'API, les suivants sont gratuits). `resolveFavoriteTags()` (app) morcelle par 100 avec pacing ~4 s et échec soft. La résolution a lieu **avant** `importFavorites`. Un store contenant encore des placeholders force une **synchro complète** (le resume est désactivé tant que `hasPlaceholderFavorites()` est vrai) — c'est le passage de rattrapage unique. Validé : 2 008 favoris = 2 007 cloud + 1 local, **0 placeholder, 100 % avec tags** (ex. 670037 → titre réel + `artist:tearontaron`).
- **Séparation favoris nhentai.net / signets locaux :** écran Favoris avec 3 onglets **« Tous / nHentai.net / Signets »** (comptes par provenance via `g.source`) ; filtre texte corrigé : il cherche dans le titre (pretty/english/japanese), l'ID **et tous les tags/artistes** — avant, les favoris « Gallery #id » sans tags ne matchaient jamais → liste vide. Validé émulateur : onglets 2008/2007/1 corrects, filtre « netorare » (tag) et « kuma » (titre/artiste) renvoient des résultats.
- **Gestion des clés API (écran `/api-keys`, drawer « Clés API ») :** lister/créer/révoquer via `/api/v2/user/keys` (auth **User Token**) relayé par le proxy (`GET/POST /api/keys`, `DELETE /api/keys/{id}` ; headers `X-Refresh-Token` ou `X-Access-Token`). La **création exige un PoW** : `GET /api/v2/pow?action=create_api_key` → `{challenge, difficulty}` → nonce tel que `sha256(challenge+nonce)` commence par `ceil(difficulty/4)` zéros hex (difficulty 16 → ~10k essais, ~10 ms) → POST `{name, purpose, pow_challenge, pow_nonce, captcha_response:""}`. La clé complète n'est renvoyée qu'une fois (modale avec Text sélectable). Contrainte : une **clé API ne peut pas en créer d'autres** — l'écran exige une session `credentialType:"refresh"` et affiche un prompt de connexion sinon.
- **Rate limit favoris (officiel) :** l'API v2 `/api/v2/favorites` limite à **15 req/min** (`x-ratelimit-limit`) avec 429 + `retry-after: 60` (headers présents seulement sur 429). La synchro complète (comptes avec des milliers de favoris, ~80 pages) espace à **5 s/page (~12 req/min)** et, sur 429, attend `retryAfter` (min 30 s) avant de réessayer (jusqu'à 6 tentatives/page). Le proxy relaie `rateLimitRemaining`/`rateLimitLimit`/`retryAfter` dans le JSON (200 et erreur). Une synchro de 1 991 favoris prend ~6-7 min — l'UI montre la progression page X/80. Validé : 1 991 favoris synchronisés, 0 doublon.
- **Synchro reprenable & compteur exact :** `syncCloudFavorites()` persiste `syncProgress = {lastPage, maxPages, fetchedCount, failedPages}` dans la session après **chaque page réussie**. Au lancement suivant, seules les pages manquantes sont re-fetchées (`lastPage+1..maxPages` + `failedPages`), la page 1 restant toujours refetchée pour `maxPages`/nouveaux favoris — mais non re-comptée. `fetchedCount` cumule les favoris reçus sur **toutes** les exécutions : c'est lui qui alimente `cloudFavoritesCount`, sinon une synchro reprise affichait le compte partiel du run (ex. 1 341 au lieu de 1 991). Une progression sans `fetchedCount` (ancien format) force une synchro complète. Des pages échouées → la progression est **gardée** (pas de perte silencieuse) et `{success:false}` avec message « Synchronisation partielle » ; la synchro reprend au prochain lancement. Validé émulateur : interruption à la page 33 → relance → requêtes `1, 34..80` (2–33 non re-fetchées) → drawer « Online favorites (1991) », écran « 1992 manga(s) enregistré(s) ».
- **Jauge de progression de synchro :** `accountStore` expose un état global `SyncProgressInfo {active, msg, current, total}` via `useSyncProgress()` — alimenté par TOUTE exécution de `syncCloudFavorites` (manuelle, connexion, auto), pas seulement par le bouton. L'écran Favoris affiche une jauge (barre + « Synchronisation page X/80... » + pourcentage) tant qu'une synchro est active ; `finally` remet `active:false`. Validé émulateur : jauge « page 30/80... 38% » visible pendant la synchro, disparue à la fin (bouton « Sync Cloud » rétabli, `lastSync` à jour).
- **Synchronisation auto (lancement + périodique, auto-planifiée) :** `accountStore.startAutoSync()` (appelé après `initAccountSession()` au module load) → synchro immédiate si un compte est connecté, puis **`scheduleAutoSync()` (setTimeout auto-planifié, PAS de `setInterval`)** : la prochaine exécution est planifiée 30 min après la **fin réelle** de la synchro (jamais empilée sur une synchro en cours). Si le tick tombe pendant une synchro en cours (`isSyncInProgress()` — manuelle, connexion, ou auto), le cycle est **différé de 5 min** (`AUTO_SYNC_DEFER_MS`) au lieu d'être perdu — jamais deux syncs simultanées, le quota officiel (15 req/min) n'est jamais consommé deux fois. Sans credential, le rythme est conservé (connexion possible plus tard sans redémarrage). Gardes : `autoSyncInFlight` + `syncInProgress` (le bouton manuel pendant une auto-sync renvoie « Une synchronisation est déjà en cours. »). Silencieux (pas d'alert UI). Validé émulateur : relance → synchro auto repart ; tap manuel pendant la synchro → garde + aucune requête parallèle (stream séquentiel unique).
- **Synchronisation Cloud (auth moderne du site) :** nhentai.net n'utilise **plus** de cookie `sessionid` — le site moderne (API v2 officielle) authentifie par `Authorization: User <access_token>` ou `Key <api_key>`, avec un cookie `refresh_token` (httpOnly) échangé via `POST /api/v2/auth/refresh` (body `{refresh_token}`). L'app envoie son credential dans un header dédié au **proxy miroir** : `X-Refresh-Token` (recommandé, le proxy fait l'échange), `X-Api-Key` (`Key <api_key>`), ou `X-Sessionid` (legacy cookie + repli scraping HTML `/favorites/`). Le proxy relaie à `https://nhentai.net/api/v2/favorites?page=N` (API v2 d'abord, repli HTML uniquement pour sessionid) et remonte les erreurs officielles (`Invalid or expired refresh token`, `Authentication required (HTTP 401)`) → `importFavorites()` merge dans le store local. La modale SignIn offre un sélecteur **Clé API / refresh_token** (le champ soumet via `onSubmitEditing`). Les sessionId factices `auth_<timestamp>` (ancien onglet « Identifiants ») sont rejetés avec un message guidant vers le bon credential. `nhentai.net` direct reste bloqué depuis l'émulateur ; seul le proxy (hôte) le joint.
- **Tags blacklist:** `isGalleryBlacklisted(g)` filtre avant rendu FlashList
- **Pagination:** `page` + `totalPages` dans HomeScreen, barre du bas absolute
- **FilterModal:** sous-menus `language` / `pages` / `date` + section SORT avec radio buttons

## Problèmes résolus dans cette session
- Aucun lecteur local dans l'app mobile : un tap sur une galerie téléchargée ouvrait `/book/[id]` (réseau, échoue hors-ligne) → `read.tsx` lit désormais `metadata.json` local via le paramètre `local`, `downloaded.tsx` ouvre `/read?local=...` et utilise la page 1 locale comme couverture
- Écran batch figé sur « Téléchargement... » (aucune progression affichée) → snapshot `useSyncExternalStore` renvoyant une nouvelle référence à chaque changement
- Pages téléchargées en `.jpg` alors que le contenu est du webp (nhentai.to) → `detectPageExt()` déduit l'extension de l'URL (y compris le paramètre `u=` des URLs proxifiées)
- Téléchargement reprenable (`createDownloadResumable`) ignorait `Range` → le proxy `/img` répond en 206 avec `Accept-Ranges`/`Content-Range`
- nhentai.net + CDN i3/t3 bloqués (SSL) → proxy miroir local (`proxy/nhentai-mirror.mjs`, port 8787) + cascade v2 → v1 → miroir
- zrocdn.xyz/nhentaimg.com injoignables depuis l'émulateur (TLS) mais joignables depuis l'hôte → pass-through `/img` avec réécriture d'URL dans le proxy
- SmartImage cassait les URLs du proxy (transformation CDN systématique) → pass-through des URLs non-`*.nhentai.net`
- Metro qui servait un bundle périmé après édition → redémarrer avec `npx expo start --clear` (le watcher peut ne pas détecter les changements sur ce poste)
- Émulateur qui crash au boot (échec OpenGL) → relancer avec `-gpu host`
- 403 Cloudflare → nativeFetch + Photon CDN
- Sliders bugués Android → SmoothSlider PanResponder
- Clics manqués/lents → CardPressable TouchableOpacity, swipeEdgeWidth Drawer
- Menu hamburger sans effet → DrawerContext + openDrawer()
- Titres/artistes mal affichés → parseTitleMetadata() sur english_title
- Sign in → settings (mauvais) → SignInModal directe
- Synchro cloud limitée à **125 favoris** malgré ~2 000 sur le site : plafond `Math.min(maxPages, 5)` dans `syncCloudFavorites` → suppression du plafond + espacement 5 s/page + backoff `retryAfter` sur 429 + pages défaillantes comptées (warn) au lieu de silencieuses + message d'erreur générique (fini « Recollez votre cookie sessionid »)
- Synchro cloud renvoyait « 0 favoris » : sessionId factice `auth_<timestamp>` (onglet « Identifiants », aucune auth réelle) + appel direct à nhentai.net (bloqué) + **schéma sessionid obsolète** (le site n'émet plus que `refresh_token`) → relais proxy `/api/favorites` avec 3 types de credentials (`X-Refresh-Token` / `X-Api-Key` / `X-Sessionid` legacy) + rejet des IDs factices + suppression de l'onglet Identifiants (sélecteur Clé API / refresh_token)
- Chargement infini → élimination boucle getGallery dans BookCard

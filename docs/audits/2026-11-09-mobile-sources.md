# Audit mobile Yomu 2.0.6 — sources, lecture et téléchargement

Date : 9 novembre 2026. Code examiné : `edffca6`. Aucun correctif de production appliqué pendant cet audit.

## Verdict

**La version actuelle ne satisfait pas une validation complète de lecture multi-source.** Les incidents ne proviennent pas tous du DNS. Deux défauts bloquants sont reproduits : mauvaise identité au passage fiche → lecteur nHentai et mauvais serveur d’images Hitomi. Des pertes d’identité et de pages empêchent aussi de garantir lecture, reprise et téléchargement e-hentai.

Les 140 tests automatisés passent alors que ces défauts existent : leur succès ne certifie pas ces parcours réels.

## Périmètre et preuves

- Revue des six adaptateurs, du catalogue, des filtres, de la fiche, du lecteur, des images/préchargements, de l’historique, des favoris, de la file de téléchargement, du stockage hors ligne et de la politique DNS native.
- Sondes HTTP réelles depuis le PC entre `2026-11-09T19:19:27Z` et `19:19:39Z` : deux pages de catalogue, deux galeries par source accessible, première/milieu/dernière image. 10 galeries et 30 échantillons d’images. Vérification du statut, du type MIME et de la signature binaire ; aucun fichier de page conservé.
- Les signatures portent sur un début de réponse : elles ne certifient ni le décodage Android ni l’intégrité d’un téléchargement complet.
- Le code des adaptateurs est réellement exécuté ; seuls le stockage et les modules natifs sont simulés pour leur exécution Node. Aucun compte ni secret utilisateur chargé.
- Émulateur Android : APK x86_64 2.0.6 existant, parcours nHentai fiche → Lire, et Doujins catalogue → fiche → lecteur.
- Téléphone physique : captures et retours de l’utilisateur. Aucun téléphone connecté à ADB pendant l’audit.
- Pas d’essai authentifié Rule34, ExHentai ou abonnement Doujins. Pas de téléchargement complet suivi d’une lecture en mode avion : ces parcours restent non certifiés.

Preuves exportées :

- [Sondes des six sources](2026-11-09-mobile-sources-live.json).
- [Comparaison des serveurs Hitomi](2026-11-09-hitomi-reference.json).
- [Comparaison des chemins CDN nHentai](2026-11-09-nhentai-cdn.json).

Le champ `placeholder` du relevé HTTP signifie « URL égale à la couverture ou blank.gif ». Chez Doujins, la couverture peut être la première page : cette égalité seule ne démontre pas une erreur. Chez e-hentai, le remplacement est confirmé par la boucle de construction des pages.

## Résultats par source

| Source | Catalogue PC | Fiches PC | Pages PC échantillonnées | Parcours Android | Conclusion |
|---|---|---|---|---|---|
| nHentai | 25 + 25 cartes, aucun chevauchement | 2 fiches, 33 et 34 pages | 6/6 vraies images WebP, HTTP 206 | Fiche 695537 ouverte ; Lire demande 4312316 et échoue | Source accessible ; navigation de l’application cassée |
| 3Hentai FR | 25 + 25 cartes, aucun chevauchement | 2 fiches, 31 et 25 pages | 6/6 vraies images JPEG, HTTP 206 | Utilisateur : fonctionne | Meilleur résultat observé ; téléchargement/hors ligne non certifiés |
| Doujins | 99 puis 208 cartes, aucun chevauchement | 2 fiches, 26 et 13 pages | 6/6 vraies images JPEG/WebP, HTTP 206 | Catalogue, fiche 105988 et lecteur « Page 1 / 26 » ouverts ; aucun libellé d’erreur image visible | Incident téléphone non reproduit ; pas de certification du rendu de chaque page |
| E-Hentai | 25 + 25 cartes, aucun chevauchement | 76 pages déclarées pour 20 liens réels ; autre fiche de 18 pages complète | Première page réelle ; milieu/fin de la grande galerie remplacés par sa couverture | Utilisateur : accès partiel et erreurs selon galerie | Pagination et identité incomplètes |
| Hitomi | 25 + 25 cartes, aucun chevauchement | 2 fiches, 43 et 75 pages | 6/6 HTTP 404, corps HTML | Utilisateur : fiche accessible, images en échec | Défaut de calcul des serveurs confirmé |
| Rule34 | Refus explicite sans identifiants | Non testé | Non testé | Aucun compte de test fourni | Prérequis de connexion, pas une preuve de panne DNS |

## Défauts bloquants

### F01 — P0 — « Lire » utilise le media_id à la place du gallery_id nHentai

Code : `mobile/app/book/[id]/index.tsx:239`, `mobile/app/read.tsx:152`.

La fiche envoie `gallery.media_id || String(gallery.id)` au lecteur. Le lecteur traite ensuite cette valeur comme un identifiant de galerie et appelle `getGallery(id)`.

Reproduction native exacte :

1. Ouvrir `yomureader://gallery/nhentai/695537`.
2. La fiche s’affiche.
3. Appuyer sur « Lire Maintenant ».
4. Le lecteur affiche « Galerie #4312316 indisponible. Vérifiez votre connexion puis réessayez. »

C’est exactement le numéro présent dans la capture du téléphone. Les images de cette galerie répondent pourtant en HTTP 206 depuis le PC. Un changement DNS ne peut pas corriger la mauvaise identité envoyée.

Correction requise : distinguer explicitement source, identifiant natif de galerie et identifiant de média ; tester les paramètres de navigation, puis l’ouverture du lecteur sur le même livre.

### F02 — P0 — Hitomi interprète à l’envers la table de distribution des images

Code : `mobile/lib/sources/hitomi.ts:147`, `:175`, `:187`, `:204`.

Le parseur collecte les branches `case` de `gg.js` dans `oneSet`, puis suppose que ces branches renvoient 1 et que la valeur par défaut vaut 0. Le script publié lors de l’audit contient au contraire `var o = 1` et des branches affectant `o = 0`.

Références primaires récupérées pendant l’audit : [table de distribution Hitomi](https://ltn.gold-usergeneratedcontent.net/gg.js) et [construction des URL](https://ltn.gold-usergeneratedcontent.net/common.js). Ces scripts sont évolutifs ; le relevé JSON conserve les valeurs et résultats observés.

Conséquence : les URL w1/w2 générées ciblent le mauvais serveur. Deux galeries, six pages : six réponses 404 HTML. Sur deux de ces mêmes images, en conservant hash et chemin et en utilisant la valeur de distribution publiée, la réponse devient 206 avec signature WebP valide.

Cette hypothèse concerne aussi les miniatures atn/btn qui réutilisent `ggM`. Leur rendu natif n’a pas été certifié.

Correction requise : parser la valeur par défaut et celle des branches ; ne pas figer l’inversion actuelle comme nouvelle constante. Tester les deux variantes de table et la signature réelle d’au moins une image.

## Défauts importants

### F03 — P1 — E-Hentai fabrique des entrées de pages absentes

Code : `mobile/lib/sources/ehentai.ts:470`, `:527`.

Seul `?p=0` est demandé. La boucle crée ensuite `totalPages` entrées et remplace chaque lien absent par `meta.thumb` ou `blank.gif`.

Preuve : galerie `4317653_3d09d659bb`, 76 pages annoncées, seulement 21 URL distinctes : 20 liens de lecture et une couverture répétée 56 fois. Les échantillons 39 et 76 reçoivent une image valide au sens HTTP, mais il s’agit de la couverture, pas de la page attendue.

Correction requise : récupérer les autres pages de vignettes, ou résoudre chaque page à la demande ; vérifier la couverture complète des numéros de pages. Ne jamais remplacer silencieusement une page manquante par la couverture.

### F04 — P1 — Le token E-Hentai est perdu au téléchargement et à la reprise

Code : `mobile/lib/sources/galleryMapper.ts:21`, `mobile/app/book/[id]/index.tsx:225`, `mobile/lib/downloadQueueStore.ts:35`, `:382`, `mobile/app/history.tsx:44`, `mobile/app/index.tsx:633`.

Le modèle convertit `4317653_3d09d659bb` en `id` numérique 4317653. Le token reste dans `media_id`/`globalId`, mais l’ajout à la file et la reprise depuis l’historique transmettent `gallery.id` seul. Le worker appelle alors l’adaptateur avec ce seul nombre ; `parseEhentaiNativeId` exige pourtant gid et token.

Correction requise : conserver l’identité native complète dans la navigation, la file persistée et l’historique, avec migration compatible des anciennes données. Tester fermeture/réouverture de l’application, pas seulement le passage direct fiche → lecteur qui peut bénéficier du cache.

### F05 — P1 — La résolution d’une page HTML est spécifique à SmartImage

Code : `mobile/components/SmartImage.tsx:112`, `mobile/lib/sources/ehentai.ts:267`, `mobile/lib/downloadQueueStore.ts:416`.

Une URL `/s/...` est une page HTML de lecture, pas une image. SmartImage sait la résoudre ; le worker de téléchargement la transmet directement à FileSystem. La validation d’intégrité peut alors rejeter le HTML reçu.

De plus, une résolution autonome sans en-têtes fournis emploie seulement `nw=1`, sans recharger la session source. Les accès authentifiés ExHentai ne sont donc pas garantis par cette voie. Le téléchargement utilise par défaut un Referer nHentai pour E-Hentai et Rule34.

Correction requise : un résolveur commun aux images affichées, préchargées et téléchargées, avec session et en-têtes adaptés à la source. Garder la validation des signatures de fichiers.

### F06 — P1 — Les voyants de santé et les rechargements du catalogue sont trompeurs

Code : `mobile/lib/sources/probeHealth.ts:17`, `:76`, `mobile/lib/sourceHealthStore.ts:91`, `mobile/app/index.tsx:508`, `:519`.

- La sonde utilise la recherche artificielle `a` et la première galerie seulement. Un résultat vide ou réservé aux abonnés peut être assimilé à une panne de la source.
- Pour E-Hentai, elle teste directement l’URL `/s/...` comme une image : le HTML peut produire un état « down » malgré une page résoluble par le lecteur.
- Chaque changement de `sourceHealth` recrée `fetchGalleries`, ce qui relance son effet de chargement. Plusieurs sondes indépendantes peuvent donc invalider et répéter un chargement de catalogue en cours.
- Un résultat « down » peut déclencher un changement automatique de source. Les points rouges ne distinguent pas DNS, authentification, galerie indisponible et rupture de parseur.

Correction requise : statuts par étape et par type d’échec ; source choisie stable ; sondes isolées des dépendances du chargement utilisateur.

### F07 — P1 — Doujins : l’incident téléphone reste ouvert

Code : `mobile/lib/sources/doujins.ts:125`, `:396`, `:413`, `:489`.

Le catalogue et les deux galeries testées fonctionnent depuis le PC. Sur l’émulateur, la grille Doujins, la fiche 105988 et l’état lecteur « Page 1 / 26 » apparaissent. Cela contredit une panne générale du site, sans invalider le retour du téléphone.

Les échecs des chemins HTML sont absorbés ; `getGallery` peut poursuivre avec HTML vide et, avec certaines entrées déjà en cache, retourner une galerie sans pages. Le chargement catalogue n’a pas de limite indépendante au niveau de l’écran ; il dépend de l’annulation du transport et peut être relancé par F06. Chaque carte programme aussi une lecture/réécriture complète du cumul des tags observés.

À relever sur téléphone : durée et statut de `/folders`, corps JSON ou page de protection, durée du parsing, identité sélectionnée et résultat de la fiche. **Cause téléphone non confirmée.** Aucun contournement de protection ou d’abonnement n’est proposé.

### F08 — P1 — Le téléchargement n’utilise pas le même client DNS que fetch et les images

Code : `mobile/native/YomuNetworkModule.kt:35`, `mobile/lib/downloadQueueStore.ts:3` ; dépendance installée `expo-file-system/android/src/main/java/expo/modules/filesystem/legacy/FileSystemLegacyModule.kt:1004`.

La politique choisie dans Yomu est installée pour fetch et Glide/Expo Image. Le worker utilise FileSystem legacy, qui crée son propre `OkHttpClient.Builder()` avec des délais de 60 secondes et sans cette politique DNS. Le réglage affiché ne couvre donc pas ce transport.

Correction requise : intégrer explicitement le transport de téléchargement à la politique choisie, ou afficher et documenter sa portée réelle ; tester le même fichier via affichage et téléchargement sur Android.

## Cohérence et couverture

### F09 — P2 — Filtres annoncés et filtres réellement appliqués divergent

`sourceFilterSupport.ts` annonce la langue pour 3Hentai, mais son adaptateur utilise les chemins `language/french` et ignore `opts.language`. Hitomi annonce des catégories dans l’interface, mais son adaptateur n’utilise pas `opts.categories`. Sa recherche filtre les métadonnées de la seule page d’index récupérée ; elle ne représente pas une recherche globale équivalente à celle du site.

Correction requise : vérifier chaque filtre annoncé par comparaison de résultats et pagination, ou masquer le filtre non implémenté.

### F10 — P2 — Les chemins de préchargement, d’erreur et de stockage divergent

- `preloadSmartImage` précharge une URL sans les en-têtes source utilisés par SmartImage et ne résout pas les pages HTML E-Hentai. Une erreur de préchargement ne prouve pas une erreur d’affichage, mais cette divergence réduit la fiabilité.
- Le CDN direct, le CDN canonique et Photon nHentai répondent tous correctement sur l’échantillon PC testé : aucune panne générale de ces trois chemins n’est démontrée.
- Le lecteur affiche une erreur générique sans réessai, alors que la fiche en possède un. Plusieurs erreurs de parsing/accès sont présentées comme des problèmes de connexion.
- L’identité de dossier local `makeLocalId(gallery.id, title)` n’inclut pas la source. Deux livres de sources différentes partageant numéro et titre peuvent viser le même dossier ; risque confirmé dans le calcul, collision destructive non exercée.
- La file valide les signatures des pages avant finalisation et conserve les fichiers partiels : ces protections sont présentes. Une galerie téléchargée intégralement puis relue en mode avion n’a pas été validée pendant cet audit.

## Contrôles locaux relancés

| Contrôle | Résultat |
|---|---|
| `npm test` dans mobile | 140 tests passent |
| `npx tsc --noEmit` | Passe |
| `npm run ui:check` | 0 erreur, 1 avertissement |
| `npm run lint` | Échec : 1 erreur et 5 avertissements |

Erreur lint : `scripts/gofile-upload.js:27`, `Blob` non déclaré pour ESLint. Les avertissements concernent deux imports inutilisés dans l’accueil, deux valeurs inutilisées dans SmartImage et une dépendance d’effet dans FilterModal. Cette erreur lint n’explique pas les incidents de lecture.

## Ordre de correction et critères d’acceptation

1. **Identité de bout en bout** : galerie/source/média séparés ; fiche, lecture, reprise et téléchargement d’un même livre ; vérifier le cas 695537 ≠ 4312316 et le token E-Hentai après redémarrage.
2. **Résolution des pages** : table Hitomi conforme au script publié, pagination E-Hentai exhaustive, résolution HTML commune aux consommateurs. Vérifier première, milieu et dernière page, sans accepter une couverture de remplacement.
3. **Chargements et transports** : supprimer les rechargements causés par les sondes ; diagnostiquer Doujins sur le téléphone ; appliquer les en-têtes, délais et DNS à tous les transports concernés.
4. **Acceptation réelle par source** : catalogue paginé, filtres, fiche, lecture de plusieurs pages, échec/réessai, téléchargement complet, interruption/reprise et lecture en mode avion, puis redémarrage avec la grande bibliothèque de favoris.

Les essais authentifiés nécessitent une session autorisée de l’utilisateur. Une source externe peut refuser une galerie ou un réseau : l’application doit alors produire un état précis et récupérable, sans annoncer un succès complet.

**Livraison de cet audit : constats, preuves et critères de correction. Aucun nouvel APK présenté comme corrigé ou « 100 % fonctionnel ».**

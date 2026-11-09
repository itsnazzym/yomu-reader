# Yomu Reader — audit des sources et de la connexion

Date : 9 novembre 2026. Base examinée : `f47a8ab`.

## Périmètre et méthode

Revue du récapitulatif E-Hentai/Rule34, des formulaires nHentai et sources,
des guides illustrés, du stockage des sessions et des états d’erreur. Lecture
des appelants après interrogation du graphe local Graphify ; les relations
du graphe ont été vérifiées dans les sources concernées. Aucune refonte du
lecteur ou de la synchronisation cloud.

Les vérifications natives utilisent `emulator-5554`, Android 15/API 35,
résolution 1170 × 2532, en portrait et paysage. Police système 100 %, puis
130 % avec redémarrage de l’application. Ce matériel ne reproduit pas One UI
sur le Galaxy S25 sous Android 17 signalé par l’utilisateur.

## Défauts trouvés et corrections

| Priorité | Constat initial et impact | Correction |
| --- | --- | --- |
| P1 | SourceAuth : champs à 44 dp, actions à 46 dp, onglets sans retour à la ligne. Des actions sont hors de la fenêtre visible dans la hiérarchie native. | Hauteurs minimales avec padding, libellés complets, onglets adaptatifs. Les champs ont des labels permanents et accessibles. |
| P1 | Les deux formulaires ne configurent l’évitement du clavier que sur iOS. Le clavier masque les champs et réduit fortement l’espace utile. | Conteneur commun `AuthModalShell` : ajustement Android/iOS, insets système, en-tête séparé et formulaire défilant. Le contenu connecté nHentai devient également défilant. |
| P1 | Cookies E-Hentai et clés Rule34 enregistrés dans AsyncStorage, erreurs de persistance ignorées, état connecté publié avant sauvegarde. | Stockage sécurisé existant réutilisé ; migration de l’ancien stockage après écriture sécurisée réussie. Publication après persistance. Opérations sérialisées par source pour éviter une résurrection après déconnexion. |
| P1 | `loginRule34` considère un HTTP 200 comme une validation de la clé, même si le corps refuse l’authentification. Une réponse non JSON en recherche devient une fausse liste vide. | Validation commune de la réponse, distinction refus/erreur/liste vide, vérification des éléments reçus et délai maximal de 12 s pour la connexion. |
| P2 | Import Rule34 réparti seulement lors de la validation et opérateurs parfois capturés au milieu d’un autre paramètre. | Répartition dès le collage dans l’un ou l’autre champ ; parsing avec bornes de paramètres. |
| P2 | Accumulation de rouge/vert/bleu, aides aussi saillantes que l’action principale, compte nHentai mélangé aux onglets. | Surfaces neutres, action principale claire à fort contraste, aides discrètes, deux onglets de sources et accès nHentai séparé. |
| P2 | Message Rule34 « navigation publique anonyme » incompatible avec la demande de clé dans l’adaptateur. | Le formulaire explique la nécessité d’une clé API. |
| P2 | Vignette E-Hentai : extraction `.glthumb` trop dépendante de la fermeture de deux div ; filtrage incomplet des icônes hors du chemin `/g/`. | Extraction tolérante du conteneur, priorité à `data-src`, contrôle des URL HTTP(S), exclusion des trois icônes par nom de fichier. |
| P2 | Notes E-Hentai : un espace après `background-position:` empêche le parsing. | Espaces CSS acceptés ; test de régression sur couverture, GID et note. |
| P2 | Guides : titre limité, zones tactiles courtes, dimensions d’image inadéquates et absence de repli en cas d’image indisponible. La mention « capture exacte » n’est pas étayée par une capture vérifiée du site actuel. | Titre libre, fermeture à 48 dp, dimensionnement explicite proportionnel, chargeur d’images Expo déjà utilisé par l’application et message de repli conservant les instructions. L’illustration est présentée comme indicative. Le guide F12 E-Hentai précise l’usage d’un ordinateur. |

## Vérification des affirmations du récapitulatif

- Les GID E-Hentai sont séparés par `_` dans les identifiants globaux. Le
  badge de carte retire bien slash/token. Les tests vérifient les formes
  slash et underscore, ainsi que la forme produite par le listing.
- La résolution `/s/` et le cache mémoire sont présents dans l’adaptateur et
  utilisés par SmartImage. Leur présence dans le code ne certifie pas la
  disponibilité actuelle de chaque serveur d’images externe.
- La clé personnelle Rule34 est demandée par l’application ; les erreurs
  correspondantes sont désormais validées aussi à la connexion.
- Les guides sont des ressources locales. Ils ne constituent pas une preuve
  de l’apparence actuelle des pages externes ni une garantie de connexion.
- Les anciens résultats 98/98 et 12/12 ne sont pas repris comme preuve de
  cette livraison : les suites ont été exécutées à nouveau.

## Validation locale

- Tests mobiles : **103/103** ; tests Electron : **12/12**.
- TypeScript mobile : aucune erreur.
- ESLint : aucune erreur ; deux avertissements préexistants dans SmartImage
  (`privacyReady`, `effectiveRecyclingKey`), hors des modifications.
- Audit UI du dépôt : aucune erreur ni avertissement.
- APK release ARM64 compilé ; signature contrôlée par `apksigner verify`.
- Vérifications natives : ouverture des formulaires et guides, fermeture et
  retour, défilement, saisie dans User ID et clé Rule34, mot de passe nHentai,
  masquage des secrets, clavier ouvert, police agrandie et paysage.
- Les champs focalisés restent au-dessus du clavier dans les hiérarchies
  inspectées. Les textes d’action reviennent à la ligne dans les captures
  à 130 %. Un élément situé hors du viewport d’une liste défilante n’est
  pas assimilé à un texte rogné.
- Nouveaux tests : icônes/couverture/note E-Hentai, collage Rule34, refus HTTP
  200/401/403, réponse illisible, vraie liste vide, données invalides,
  migration sécurisée, isolation des sources et ordre sauvegarde/déconnexion.

## Limites et état de livraison

Le rendu et la saisie sur le S25 physique restent à vérifier avec l’APK.
L’émulateur a affiché un échec de vérification Cloudflare pour nHentai :
aucune connexion nHentai réelle n’est déclarée validée. Aucun identifiant
personnel Rule34/E-Hentai n’a été demandé ni utilisé pour un test distant.
TalkBack et la performance sur téléphone réel n’ont pas été mesurés.

**Résolu après l’audit : illustrations des guides en release.** Le repli
« Illustration indisponible » a été reproduit sur l’APK installé. Les
ressources PNG et leur résolution d’URI ont été retirées des guides. Un
composant natif affiche désormais les repères, les correspondances avec les
champs de Yomu et une séquence lisible pour chaque source. Aucun écran de
site authentifié ni valeur de compte fictive n’est présenté comme une
capture réelle. Les quatre guides ont été ouverts sur l’émulateur release ;
les repères E-Hentai, Rule34, forum et sessionid sont présents dans les
hiérarchies natives. Les nouveaux tests vérifient leurs champs et leur rendu
sans chargeur d’images : **109/109 tests mobiles passent**. Contrôle effectué
également en largeur de téléphone réduite et avec la police système à 130 %.

Les petites pastilles colorées des sources dans les paramètres généraux
restent celles de l’interface existante ; la réduction de couleur porte sur
les fenêtres de connexion et d’aide. Le badge Rule34 des paramètres indique
désormais « Non lié » au lieu d’annoncer un accès anonyme.

La livraison initiale de cet audit était locale : code, rapport et APK
installable, sans publication GitHub, OTA ou Gofile. La publication Gofile
demandée ensuite est distincte et son URL est communiquée dans le chat. Les fichiers préexistants
`GEMINI.md` et `prompt.txt` ne font pas partie du correctif.

# Yomu — exécution de la stabilisation

Objectif : résoudre les 18 constats de l’audit du 10 novembre 2026, en conservant lecteur, bibliothèque, adaptateurs, reprise et chiffrement. **Exécution en cours ; jalons cochés validés localement, contrôles sur appareil réservés au jalon 10.**

Préparation : préserver les changements locaux ; établir les contrôles de référence ; cartographier avec Graphify les contrats modifiés et lire leurs appelants. Chaque jalon sera découpé en actions vérifiables de 2–5 minutes pendant son exécution. Aucun sous-agent ; commits conventionnels atomiques, sans changements étrangers ni secrets.

## Task 1

- [x] **1. Identité des livres — audit 1, 17.** Corriger `sources/types.ts`, `galleryMapper.ts`, `favoritesStore.ts` et leurs appelants : conserver source/ID natif/globalId, corriger `origin`, rejeter une source inconnue hors migration legacy. **Vérifier :** ajout/lecture/retrait sur six sources, collisions numériques et ID E-Hentai complet ; ne pas réattribuer les anciens favoris ambigus sans preuve.
## Task 2

- [x] **2. Données récupérables — audit 2, 8, 9.** Dans `backupStore.ts` et les stores : validation versionnée/bornée, aperçu avant remplacement, attente des écritures, exclusion des mutations concurrentes et journal de restauration récupérable au redémarrage. **Vérifier :** panne sur chaque écriture et arrêt entre étapes ; état initial récupéré ou nouvel état complet, export contenant les dernières modifications.
## Task 3

- [x] **3. Verrouillage et images — audit 3, 12.** Corriger `appLockStore.ts`, `AppLockGate.tsx`, `_layout.tsx`, `SmartImage.tsx` : contenu masqué avant initialisation, erreur récupérable, délai après PIN incorrect, attente du flou et clé de recyclage transmise. **Vérifier :** stockage lent/illisible, reprise et défilement rapide sans exposition du contenu protégé.
## Task 4

- [x] **4. Dépendances — audit 4 et suppressions.** Revalider les avis puis corriger Next/Sharp et dépendances concernées ; séparer runtime et outillage Expo. Retirer `adm-zip` et l’IPC base64 obsolète après vérification exhaustive des usages. **Vérifier :** installations reproductibles, tests/builds réussis, alertes applicables traitées ; aucune correction forcée globale.
## Task 5

- [x] **5. Téléchargements — audit 5, 6, 15.** Dans `downloadQueueStore.ts`, `imageIntegrity.ts` et la copie SAF : suspendre à la perte Wi-Fi, contrôler entre pages, conserver reprise et taille finale, contrôler les images suspectes ; proposer une relance de copie externe distincte du téléchargement. **Vérifier :** changement réseau, fichier tronqué, interruption et copie échouée sans perte d’original.
## Task 6

- [x] **6. Confidentialité et sauvegardes — audit 7, 11.** Source d’image directe prioritaire, relais tiers choisi explicitement, cache privé adapté, notifications discrètes ; sauvegardes rotatives avec remplacement récupérable, export externe et option chiffrée compatible avec l’import JSON. **Vérifier :** absence de relais non choisi, titres masqués, récupération après interruption et aller-retour chiffré avec rejet d’une mauvaise clé.
## Task 7

- [ ] **7. Résilience des sources — audit 13, 14.** Corriger `sourceHealthStore.ts`, `probeHealth.ts`, `galleryLoader.ts` et adaptateurs : préserver le dernier résultat, distinguer réseau/authentification/source, cibler les sondes, borner les octets et propager annulation/échéance. **Vérifier :** succès → hors ligne → reconnexion, navigation annulée et serveur ignorant Range.
## Task 8

- [ ] **8. Capacité cloud — audit 10.** Mesurer 10 000 favoris réalistes, compacter les métadonnées, séparer l’avatar et afficher volume/limite ; segmenter le coffre seulement si nécessaire, avec migration récupérable. Préserver chiffrement, fusion et révisions. **Vérifier :** synchronisation à deux appareils, suppressions/éditions concurrentes, dépassement expliqué et permissions SQL si modifiées.
## Task 9

- [ ] **9. Simplification — audit 16–18 et ergonomie.** Extraire progressivement les responsabilités critiques d’Electron, de l’accueil et des réglages ; recentrer la navigation et distinguer signets/nHentai/Cloud ; produire un manifeste version/architecture/empreinte des installateurs. Archiver Tauri uniquement si ses usages permettent son retrait ; nettoyer mentions anciennes et sorties locales à ignorer sans effacer de données utiles. **Vérifier :** parcours hors ligne, retours, ARM64/universel, versions et workflows ; conserver les identifiants d’installation.
## Task 10

- [ ] **10. Validation finale.** Racine : `check:electron`, `test:electron`, `test:proxy`, `build` ; mobile : `release:check` ; web : `lint`, `build` ; audits des trois lockfiles. Après prebuild, vérifier plugins natifs idempotents, DNS et protection Android. Préparer un APK de validation et tester sur appareil : réseau, arrêt/reprise, navigation, texte agrandi, paysage, sources authentifiées et cloud à deux appareils. Contrôler différences/secrets ; préparer commits et notes de livraison. Si Rust est modifié et conservé, effectuer ses contrôles adaptés.

**Ordre :** 1 → 2 → 5/6 → 7 → 8 → 9 → 10 ; 3 et 4 sont indépendants et prioritaires avant la simplification. Chaque jalon reçoit ses tests ciblés ; les contrôles complets terminent le travail. Un retrait non justifié devient une conservation explicitement motivée.

**Terminé lorsque :** critères applicables attestés, aucun contrôle manquant présenté comme réussi ; validation locale, CI, appareil et production distinguées. Publication et migrations distantes restent des opérations distinctes, sans déclenchement automatique.

Respecter l’ADR-041 Yomu de SecondBrain ; actualiser une décision structurante seulement si elle est effectivement retenue. Aucune fiche Yomu trouvée dans `01_Projects`.

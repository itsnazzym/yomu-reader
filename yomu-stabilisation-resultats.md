# Yomu — résultat de l’exécution, 11 novembre 2026

Les lots 1 à 9 du plan sont implémentés et validés localement. Le lot 10 reste ouvert : aucun APK final n’a été construit, aucun téléphone physique ni parcours authentifié à deux appareils n’a été validé. Aucune publication ni migration distante n’a été effectuée.

Travail conservé sur `codex/yomu-stabilisation`, dans `C:/Users/entre/.codex/worktrees/yomu-stabilisation/nhdl`. Le répertoire initial `C:/Users/entre/Documents/Dev/nhdl` a été préservé. Le commit `b294570` est un instantané des changements locaux préexistants ; les corrections de cette exécution commencent après cet instantané. Vérifier ce découpage avant une intégration ultérieure.

## Modifications livrées

| Lot | Résultat |
| --- | --- |
| Identité | Favoris et historique conservent source, globalId et identifiant natif complet ; sources inconnues rejetées ; collisions E-Hentai évitées. |
| Bibliothèque | Écritures et instantanés sérialisés, journal de restauration récupérable, validation bornée avant remplacement, erreurs de lecture récupérables sans sauvegarder un faux état vide. |
| Verrouillage | Contenu non monté avant déverrouillage, reprise après erreur, temporisation des PIN incorrects ; préférence de flou attendue avant images sensibles. |
| Dépendances | Next/Sharp et dépendances compatibles actualisés ; `adm-zip` et ancien IPC d’archives base64 retirés. Alertes restantes explicitement conservées ci-dessous. |
| Téléchargements | Pause Wi-Fi, reprise sans écrasement par un ancien worker, contrôle de fichiers tronqués, nouvelle tentative de copie externe sans retéléchargement. |
| Confidentialité | Source d’image directe, relais tiers sur choix explicite, incognito sans nouvelles écritures de cache, notifications génériques, trois sauvegardes automatiques et exports chiffrés. |
| Sources | État hors ligne distinct d’une panne, sondes ciblées et bornées, propagation de l’annulation et des délais. |
| Cloud | Métadonnées compactées, compression authentifiée bornée, maintien du format ancien pour petits coffres, protection contre l’écrasement par un ancien client. Migration SQL préparée. |
| Simplification | Modules Electron critiques séparés, conversion des cartes partagée, sauvegarde chiffrée séparée des réglages, navigation clarifiée, manifeste de livraison avec architecture et empreinte. |

La revue finale a été effectuée par l’auteur, conformément à l’interdiction de sous-agents. Elle est moins indépendante qu’une revue par une autre personne. Les défauts importants trouvés pendant cette revue ont été reproduits par tests puis corrigés : erreurs initiales de stockage, course à la reconnexion Wi-Fi, favoris anciens incomplets, identités natives et historique, classification x86 des installateurs. Aucun défaut mineur de code n’a été reporté.

## Validation locale

| Contrôle | Résultat |
| --- | --- |
| Tests mobiles | 169/169 réussis |
| Typage mobile et lint | Réussis, sans erreur ni avertissement lint |
| Audit statique d’interface | 0 erreur, 0 avertissement |
| Expo Doctor | 18/18 contrôles réussis ; dépendances compatibles avec le SDK |
| Tests desktop | 17/17 réussis |
| Test proxy | 1/1 réussi |
| Vérification Electron et build desktop | Réussis |
| Lint et build web | Réussis |
| SQL local, PostgreSQL compatible/PGlite | Propriétaire, révisions concurrentes, limites et refus de rétrogradation vérifiés |
| Prebuild Android | Réussi ; tests d’idempotence des plugins inclus ; protection de fenêtre et DNS retrouvés dans les sources générées |
| Lint natif Android | Non terminé : déclenche la même compilation native en échec ; arrêt après confirmation de cette erreur |
| APK release ARM64/x86_64 | Échec de compilation native Windows ; aucun APK final validé |
| Téléphone, comptes réels, CI et production | Non validés dans cette exécution |

Charge synthétique : 10 000 favoris riches, 25 200 141 caractères avant compactage, 10 332 305 après compactage, 345 174 caractères dans la charge chiffrée. Identités et tags préservés par aller-retour. Ces données sont synthétiques ; cela ne mesure pas la mémoire et la fluidité d’un téléphone réel.

Audits des lockfiles, dépendances de production, relancés le 11 novembre :

| Projet | Critiques | Élevées | Modérées | Faibles |
| --- | ---: | ---: | ---: | ---: |
| Desktop | 0 | 0 | 3 | 0 |
| Mobile | 0 | 1 | 15 | 1 |
| Web | 0 | 0 | 0 | 0 |

Le classement npm inclut l’outillage Expo dans les dépendances de production. L’alerte élevée restante concerne `image-size`, utilisé par Metro pour les images locales lors du build ; elle n’est pas déclarée corrigée. Les alertes modérées concernent notamment glob/minimatch et leur chaîne Expo/archiver. Aucun changement majeur forcé du SDK ou de cette chaîne n’a été effectué. Les entrées locales de build non fiables restent un risque de déni de service.

## Blocage Android et contrôles restants

Trois stratégies de compilation ont été essayées, sans boucle supplémentaire :

1. Chemin normal : Ninja échoue après régénérations répétées de `build.ninja` dans `react-native-nitro-google-signin`.
2. Lecteur temporaire raccourci : conflit entre chemins canoniques C: et Y: pendant le codegen.
3. Chemin normal et dossier CMake de travail raccourci via script local : Ninja échoue à créer un répertoire d’objets Google Sign-In contenant le chemin absolu des sources (`mkdir … No such file or directory`).

Le troisième essai échoue après 3 min 23 s. Le réglage d’essai n’est pas ajouté au produit. Le lecteur Y: temporaire a été retiré. Les caches ont été conservés sous des noms distincts lorsqu’une suppression automatique était refusée. Les journaux sont préservés dans `.superpowers/sdd/yomu-stabilisation-execution/` ; ce dossier reste utile au lot 10 inachevé.

La documentation Android permet de déplacer le dossier CMake de travail, ce qui justifiait le troisième essai ; cette option n’a pas suffi ici : [référence Android Cmake](https://developer.android.com/reference/tools/gradle-api/8.0/com/android/build/api/dsl/Cmake).

Avant une livraison : résoudre ce blocage de chaîne Android, produire et vérifier un APK, puis contrôler sur téléphone Wi-Fi/réseau mobile, arrêt/reprise, copie SAF, verrouillage au démarrage et en arrière-plan, grand texte, paysage et navigation. Tester les sources avec authentification réelle, ainsi que conflits et suppressions du cloud sur deux appareils. La migration `supabase/migrations/20261110120000_compressed_vault_compatibility.sql` doit être revue/appliquée avant de déployer la synchronisation des grands coffres. Ne pas utiliser cette exécution comme preuve de déploiement.

## Arbitrages et conséquences

1. **Répertoire de travail isolé et instantané initial** : préserver les modifications préexistantes ; coût éventuel, un commit initial à distinguer lors de l’intégration.
2. **Titres du plan adaptés aux outils** : présentation seulement ; aucun changement de périmètre.
3. **Aucun sous-agent** : respecter la demande ; coût, absence de regard indépendant lors de la revue.
4. **Corrections locales autorisées** : changements réversibles ; opérations distantes et suppressions destructives séparées.
5. **AsyncStorage et journal conservés** : éviter une migration de moteur ; coût, espace temporaire pour anciennes et nouvelles données.
6. **Expo SDK 54 et archiver 8 conservés** : éviter des remplacements incompatibles ; coût, alertes résiduelles et risque sur entrées de build non fiables.
7. **scrypt et XChaCha20-Poly1305 existants réutilisés** : pas de nouvelle dépendance cryptographique ; coût, environ 64 Mio temporaires sur téléphone ancien, non mesurés sur appareil.
8. **Incognito sans purge de l’ancien cache** : préserver les fichiers ; coût, images précédemment mises en cache présentes jusqu’au nettoyage explicite.
9. **Sondes sans flux laissées indéterminées** : éviter une lecture arbitrairement volumineuse ; coût, certaines sources fonctionnelles peuvent rester sans statut jusqu’à leur utilisation.
10. **Compression plutôt que segmentation du coffre** : mesure des 10 000 favoris sous la limite, écriture atomique conservée ; coût, coffres plus gros ou peu compressibles encore limités à 4 Mio/32 Mio.
11. **Avatar cloud local à l’appareil** : sauvegardes manuelles complètes conservées ; coût, modifications d’avatar non synchronisées.
12. **Tauri conservé, marqué expérimental** : usages frontend/CI toujours présents ; coût, deux moteurs desktop à maintenir.
13. **Catalogue web conservé** : absence de preuve justifiant sa suppression ; coût, maintenance de ses API.
14. **Aucun déploiement, migration distante ou signature de production** : livrer des changements vérifiables localement ; coût, migration nécessaire avant activation des grands coffres.
15. **Anciens téléchargements partiels conservés** : ne pas déplacer des identités ambiguës ; coût, certains téléchargements anciens devront être recommencés, fichiers existants préservés.

Décision structurante enregistrée dans SecondBrain : `ADR-042_Yomu_Recoverable_Restores_and_Compressed_Vaults`, reliée à ADR-041 et au hub.

## Reprise

Le plan reste dans `yomu-stabilisation-execution.md`, lot 10 non coché. Les commits de corrections sont atomiques, après l’instantané initial. La branche et le répertoire isolé sont conservés, sans fusion ni push. Les sources de l’ancien répertoire ne sont pas la version corrigée de cette branche.

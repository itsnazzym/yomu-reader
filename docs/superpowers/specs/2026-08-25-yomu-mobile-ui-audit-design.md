# Yomu Reader Mobile UI Audit & Fix

## Contexte

L'application mobile Yomu Reader (React Native / Expo) présente des bugs d'affichage récurrents sur plusieurs écrans :

- **Textes tronqués** : labels de sources (3Hentai FR, Doujins) coupés sur petits écrans
- **Boutons vides ou mal alignés** : icônes au-dessus du texte au lieu d'à côté, texte manquant
- **Fautes d'orthographe** : "Telecharger" sans accent, "Parametres" sans accent (dans certains rendus)
- **Impression de vide** : boutons trop larges sans contenu, empty states mal cadrés

Ces bugs apparaissent sur :
- Home / index (`sourceChipsRow`)
- Page détail galerie (`actionsContainer` avec Favori / Lire / Télécharger)
- Cards `BookCard` (badge source, titre)
- Empty states (`AnimatedEmptyState`)

## Objectif

Corriger de façon systématique les problèmes de layout et de texte sur mobile, puis ajouter un mécanisme de prévention pour éviter les régressions.

## Scope

**Inclus :**
- `mobile/app/index.tsx` — chips de sources
- `mobile/app/book/[id]/index.tsx` — boutons d'action
- `mobile/components/BookCard/index.tsx` — badge source et titre
- `mobile/components/ui/AnimatedEmptyState.tsx` — textes empty state
- `mobile/app/tags/index.tsx` — chips de sources (dupliqué)
- Nouveau : `mobile/scripts/ui-audit.cjs` — script de vérification

**Exclu :**
- Desktop (src/) — les patterns sont déjà corrects
- Refactor complet du design system — trop risqué pour l'instant
- Modifications de l'API ou de la logique métier

## Design détaillé

### 1. Chips de sources (`index.tsx` + `tags/index.tsx`)

**Problème :** `flexShrink: 0` sur `sourceChipText` empêche le texte de se compresser sur petits écrans.

**Solution :**
```typescript
sourceChipText: {
  fontSize: 12,
  fontWeight: "700",
  flexShrink: 1,        // Changé de 0 à 1
  paddingRight: 3,
  includeFontPadding: false,
  numberOfLines: 1,     // Ajouté
  ellipsizeMode: "tail", // Ajouté
}
```

**Vérification :** "3Hentai FR" s'affiche en entier ou avec "…" sur écran 360px.

### 2. Boutons d'action galerie (`book/[id]/index.tsx`)

**Problème :** `btnInner` avec `flexShrink: 0` peut compresser le texte. `adjustsFontSizeToFit` crée des tailles incohérentes.

**Solution :**
```typescript
btnInner: {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  flexShrink: 1,        // Changé de 0 à 1
  minWidth: 0,          // Ajouté
},
primaryReadBtnText: {
  color: "#fff",
  fontWeight: "800",
  fontSize: 14,
  flexShrink: 1,        // Changé de 0 à 1
  numberOfLines: 1,     // Ajouté
  ellipsizeMode: "tail", // Ajouté
  // Retirer adjustsFontSizeToFit
},
secondaryBtnText: {
  fontWeight: "700",
  fontSize: 13,
  flexShrink: 1,        // Changé de 0 à 1
  numberOfLines: 1,     // Ajouté
  ellipsizeMode: "tail", // Ajouté
},
secondaryBtn: {
  flex: 1,
  paddingVertical: 12,
  paddingHorizontal: 12,
  borderRadius: 12,
  borderWidth: 1,
  minHeight: 46,
  minWidth: 100,        // Ajouté pour éviter les boutons trop étroits
  justifyContent: "center",
}
```

**Vérification :** "Télécharger" et "Collection" tiennent sur une ligne sans coupure.

### 3. Card BookCard (`components/BookCard/index.tsx`)

**Problème :** `sourceBadge` avec `maxWidth: 90` trop petit pour "3Hentai FR". Titre avec `flexShrink: 0`.

**Solution :**
```typescript
sourceBadge: {
  maxWidth: 110,        // Changé de 90 à 110
  borderRadius: 4,
  paddingHorizontal: 5,
  paddingVertical: 1.5,
},
sourceText: {
  color: "#0b0b10",
  fontSize: 8.5,
  fontWeight: "900",
  numberOfLines: 1,     // Déjà présent
  ellipsizeMode: "tail", // Ajouté
},
title: {
  fontSize: 11.5,
  fontWeight: "700",
  color: "#f3f4f6",
  lineHeight: 15,
  flexShrink: 1,        // Changé de 0 à 1
  paddingRight: 2,
  includeFontPadding: false,
  numberOfLines: 2,     // Déjà présent
  ellipsizeMode: "tail", // Ajouté
}
```

**Vérification :** Badge "3Hentai FR" ne déborde pas, titres longs coupent avec "…".

### 4. Empty states (`components/ui/AnimatedEmptyState.tsx`)

**Problème :** Titre "Bibliothèque Hors-Ligne Vide" ne correspond pas aux attentes utilisateur ("Aucun téléchargement").

**Solution :**
```typescript
downloads: {
  icon: IconCloudDownload,
  kanji: "庫",
  defaultTitle: "Aucun téléchargement",  // Changé
  defaultDesc: "Téléchargez des tomes entiers pour les dévorer partout sans connexion.",
  sealColor: "#34c759",
}
```

**Vérification :** Le titre affiche "Aucun téléchargement" avec accents corrects.

### 5. Script de vérification UI (`mobile/scripts/ui-audit.cjs`)

**Problème :** Pas de mécanisme de prévention des régressions.

**Solution :** Script Node qui scanne les fichiers et détecte :
- `flexShrink: 0` sur `Text` avec `numberOfLines` → warning
- `maxWidth` < 100 sur des labels/badges → warning
- Textes français sans accents (`Telecharger`, `Parametres`, etc.) → erreur
- Boutons avec `flexDirection: "column"` contenant icône + texte → warning

**Usage :**
```json
// mobile/package.json
"scripts": {
  "ui:check": "node scripts/ui-audit.cjs"
}
```

**Vérification :** Le script détecte les bugs actuels avant fix, et passe après fix.

## Plan d'implémentation

### Task 1 : Corriger les chips de sources
- Modifier `mobile/app/index.tsx` et `mobile/app/tags/index.tsx`
- Ajouter `flexShrink: 1`, `numberOfLines: 1`, `ellipsizeMode: "tail"` sur `sourceChipText`
- Tester sur émulateur Android 360px

### Task 2 : Corriger les boutons d'action galerie
- Modifier `mobile/app/book/[id]/index.tsx`
- Ajuster `btnInner`, `primaryReadBtnText`, `secondaryBtnText`, `secondaryBtn`
- Retirer `adjustsFontSizeToFit` du bouton principal
- Tester avec textes longs et courts

### Task 3 : Corriger BookCard
- Modifier `mobile/components/BookCard/index.tsx`
- Ajuster `sourceBadge`, `sourceText`, `title`
- Tester avec "3Hentai FR" et titres longs

### Task 4 : Corriger AnimatedEmptyState
- Modifier `mobile/components/ui/AnimatedEmptyState.tsx`
- Changer le titre "downloads" en "Aucun téléchargement"
- Vérifier les accents sur Android

### Task 5 : Créer le script ui-audit
- Créer `mobile/scripts/ui-audit.cjs`
- Ajouter la commande dans `mobile/package.json`
- Tester que le script détecte les bugs et passe après fix

### Task 6 : Vérification finale
- Lancer `npm run ui:check` dans mobile/
- Vérifier tous les écrans sur émulateur
- Commit et push

## Critères de succès

- [ ] Aucun texte tronqué sur les écrans testés (360px et 400px)
- [ ] "3Hentai FR" s'affiche correctement dans les chips et badges
- [ ] "Télécharger" et "Collection" tiennent dans les boutons
- [ ] "Aucun téléchargement" avec accents corrects
- [ ] `npm run ui:check` passe sans erreur
- [ ] Pas de régression visuelle sur les autres écrans

## Risques et mitigation

| Risque | Probabilité | Mitigation |
|--------|-------------|------------|
| Régression sur autres écrans | Moyenne | Tester manuellement chaque écran après modif |
| Script ui-audit trop strict | Faible | Commencer en mode warning, pas erreur |
| Polices Android sans accents | Faible | Utiliser les polices système par défaut |

## Notes

- Les accents sont déjà corrects dans le code source — les screenshots peuvent montrer des problèmes de rendu police
- Ne pas toucher au desktop (src/) — les patterns y sont déjà corrects
- Le script ui-audit est un bonus de prévention, pas bloquant pour la release

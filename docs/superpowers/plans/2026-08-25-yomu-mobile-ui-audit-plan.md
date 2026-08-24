# Yomu Reader Mobile UI Audit & Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corriger les bugs d'affichage mobile (textes tronqués, boutons mal alignés, empty states) et ajouter un script de prévention.

**Architecture:** Modifications ciblées sur 5 fichiers existants + création d'un script d'audit. Pas de refactor structurel.

**Tech Stack:** React Native, Expo, TypeScript, Node.js (pour le script d'audit)

## Global Constraints

- Ne pas modifier la logique métier ou les appels API
- Garder les mêmes noms de composants et de styles
- Tester sur émulateur Android 360px minimum
- Le script d'audit doit être exécutable via `npm run ui:check`
- Pas de nouvelle dépendance npm

---

### Task 1: Corriger les chips de sources (home + tags)

**Files:**
- Modify: `mobile/app/index.tsx` (lignes ~1347-1352)
- Modify: `mobile/app/tags/index.tsx` (lignes ~919-922)

**Interfaces:**
- Consumes: Styles existants `sourceChipText`
- Produces: Styles corrigés avec truncation propre

- [ ] **Step 1: Modifier le style sourceChipText dans index.tsx**

```typescript
// Avant
sourceChipText: {
  fontSize: 12,
  fontWeight: "700",
  flexShrink: 0,
  paddingRight: 3,
  includeFontPadding: false,
},

// Après
sourceChipText: {
  fontSize: 12,
  fontWeight: "700",
  flexShrink: 1,
  paddingRight: 3,
  includeFontPadding: false,
  numberOfLines: 1,
  ellipsizeMode: "tail",
},
```

- [ ] **Step 2: Modifier le style sourceChipText dans tags/index.tsx**

Même modification que Step 1.

- [ ] **Step 3: Vérifier visuellement**

Lancer l'app sur émulateur Android 360px et vérifier que "3Hentai FR" s'affiche correctement ou avec "…".

- [ ] **Step 4: Commit**

```bash
git add mobile/app/index.tsx mobile/app/tags/index.tsx
git commit -m "fix(mobile): allow source chips text to shrink and truncate"
```

---

### Task 2: Corriger les boutons d'action galerie

**Files:**
- Modify: `mobile/app/book/[id]/index.tsx` (lignes ~985-1006)

**Interfaces:**
- Consumes: Styles existants `btnInner`, `primaryReadBtnText`, `secondaryBtnText`, `secondaryBtn`
- Produces: Styles corrigés avec meilleure gestion du texte

- [ ] **Step 1: Modifier btnInner**

```typescript
// Avant
btnInner: {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  flexShrink: 0,
},

// Après
btnInner: {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  flexShrink: 1,
  minWidth: 0,
},
```

- [ ] **Step 2: Modifier primaryReadBtnText**

```typescript
// Avant
primaryReadBtnText: {
  color: "#fff",
  fontWeight: "800",
  fontSize: 14,
  flexShrink: 0,
  paddingRight: 6,
  includeFontPadding: false,
},

// Après
primaryReadBtnText: {
  color: "#fff",
  fontWeight: "800",
  fontSize: 14,
  flexShrink: 1,
  numberOfLines: 1,
  ellipsizeMode: "tail",
},
```

- [ ] **Step 3: Modifier secondaryBtnText**

```typescript
// Avant
secondaryBtnText: {
  fontWeight: "700",
  fontSize: 13,
  flexShrink: 0,
  paddingRight: 4,
  includeFontPadding: false,
},

// Après
secondaryBtnText: {
  fontWeight: "700",
  fontSize: 13,
  flexShrink: 1,
  numberOfLines: 1,
  ellipsizeMode: "tail",
},
```

- [ ] **Step 4: Modifier secondaryBtn**

```typescript
// Avant
secondaryBtn: {
  flex: 1,
  paddingVertical: 12,
  paddingHorizontal: 12,
  borderRadius: 12,
  borderWidth: 1,
  minHeight: 46,
  justifyContent: "center",
},

// Après
secondaryBtn: {
  flex: 1,
  paddingVertical: 12,
  paddingHorizontal: 12,
  borderRadius: 12,
  borderWidth: 1,
  minHeight: 46,
  minWidth: 100,
  justifyContent: "center",
},
```

- [ ] **Step 5: Retirer adjustsFontSizeToFit du bouton principal**

Dans le JSX, supprimer `adjustsFontSizeToFit` et `minimumFontScale={0.8}` du Text du bouton principal.

- [ ] **Step 6: Vérifier visuellement**

Vérifier que "Télécharger" et "Collection" tiennent sur une ligne.

- [ ] **Step 7: Commit**

```bash
git add mobile/app/book/[id]/index.tsx
git commit -m "fix(mobile): improve gallery action buttons text layout"
```

---

### Task 3: Corriger BookCard (badge source + titre)

**Files:**
- Modify: `mobile/components/BookCard/index.tsx` (lignes ~303-308, ~319-326)

**Interfaces:**
- Consumes: Styles existants `sourceBadge`, `sourceText`, `title`
- Produces: Styles corrigés avec truncation propre

- [ ] **Step 1: Modifier sourceBadge**

```typescript
// Avant
sourceBadge: {
  maxWidth: 90,
  borderRadius: 4,
  paddingHorizontal: 5,
  paddingVertical: 1.5,
},

// Après
sourceBadge: {
  maxWidth: 110,
  borderRadius: 4,
  paddingHorizontal: 5,
  paddingVertical: 1.5,
},
```

- [ ] **Step 2: Modifier sourceText**

```typescript
// Avant
sourceText: {
  color: "#0b0b10",
  fontSize: 8.5,
  fontWeight: "900",
},

// Après
sourceText: {
  color: "#0b0b10",
  fontSize: 8.5,
  fontWeight: "900",
  numberOfLines: 1,
  ellipsizeMode: "tail",
},
```

- [ ] **Step 3: Modifier title**

```typescript
// Avant
title: {
  fontSize: 11.5,
  fontWeight: "700",
  color: "#f3f4f6",
  lineHeight: 15,
  flexShrink: 0,
  paddingRight: 2,
  includeFontPadding: false,
},

// Après
title: {
  fontSize: 11.5,
  fontWeight: "700",
  color: "#f3f4f6",
  lineHeight: 15,
  flexShrink: 1,
  paddingRight: 2,
  includeFontPadding: false,
  numberOfLines: 2,
  ellipsizeMode: "tail",
},
```

- [ ] **Step 4: Vérifier visuellement**

Vérifier que le badge "3Hentai FR" ne déborde pas et que les titres longs coupent avec "…".

- [ ] **Step 5: Commit**

```bash
git add mobile/components/BookCard/index.tsx
git commit -m "fix(mobile): improve BookCard source badge and title truncation"
```

---

### Task 4: Corriger AnimatedEmptyState

**Files:**
- Modify: `mobile/components/ui/AnimatedEmptyState.tsx` (ligne ~72)

**Interfaces:**
- Consumes: Configuration existante `TYPE_CONFIGS`
- Produces: Texte corrigé pour "downloads"

- [ ] **Step 1: Modifier le titre downloads**

```typescript
// Avant
downloads: {
  icon: IconCloudDownload,
  kanji: "庫",
  defaultTitle: "Bibliothèque Hors-Ligne Vide",
  defaultDesc: "Téléchargez des tomes entiers pour les dévorer partout sans connexion.",
  sealColor: "#34c759",
},

// Après
downloads: {
  icon: IconCloudDownload,
  kanji: "庫",
  defaultTitle: "Aucun téléchargement",
  defaultDesc: "Téléchargez des tomes entiers pour les dévorer partout sans connexion.",
  sealColor: "#34c759",
},
```

- [ ] **Step 2: Vérifier visuellement**

Vérifier que l'écran Téléchargements affiche "Aucun téléchargement" avec accents.

- [ ] **Step 3: Commit**

```bash
git add mobile/components/ui/AnimatedEmptyState.tsx
git commit -m "fix(mobile): update downloads empty state title"
```

---

### Task 5: Créer le script ui-audit

**Files:**
- Create: `mobile/scripts/ui-audit.cjs`
- Modify: `mobile/package.json` (ajouter script)

**Interfaces:**
- Consumes: Fichiers source dans `mobile/components/` et `mobile/app/`
- Produces: Rapport d'audit avec warnings/erreurs

- [ ] **Step 1: Créer le script ui-audit.cjs**

```javascript
#!/usr/bin/env node
/**
 * UI Audit Script for Yomu Reader Mobile
 * Détecte les patterns problématiques dans les composants React Native
 */

const fs = require("fs");
const path = require("path");

const MOBILE_ROOT = path.join(__dirname, "..");
const COMPONENTS_DIR = path.join(MOBILE_ROOT, "components");
const APP_DIR = path.join(MOBILE_ROOT, "app");

let errors = 0;
let warnings = 0;

function log(type, file, line, message) {
  const prefix = type === "error" ? "❌" : "⚠️";
  console.log(`${prefix} ${file}:${line} — ${message}`);
  if (type === "error") errors++;
  else warnings++;
}

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split("\n");
  const relativePath = path.relative(MOBILE_ROOT, filePath);

  lines.forEach((line, index) => {
    const lineNum = index + 1;

    // Check for flexShrink: 0 on Text with numberOfLines
    if (line.includes("flexShrink: 0") && content.includes("numberOfLines")) {
      log("warning", relativePath, lineNum, "flexShrink: 0 with numberOfLines may cause overflow");
    }

    // Check for maxWidth < 100 on badges/labels
    const maxWidthMatch = line.match(/maxWidth:\s*(\d+)/);
    if (maxWidthMatch && parseInt(maxWidthMatch[1]) < 100) {
      log("warning", relativePath, lineNum, `maxWidth ${maxWidthMatch[1]} may be too small for labels`);
    }

    // Check for French text without accents
    const frenchPatterns = [
      /Telecharger/g,
      /Parametres/g,
      /Bibliotheque/g,
      /telechargement/g,
      /Aucun\s+telechargement/g,
    ];
    frenchPatterns.forEach((pattern) => {
      if (pattern.test(line)) {
        log("error", relativePath, lineNum, `French text without accent: ${line.trim()}`);
      }
    });

    // Check for flexDirection: column with icon+text (potential layout issue)
    if (line.includes('flexDirection: "column"') || line.includes("flexDirection: 'column'")) {
      const nearbyLines = lines.slice(Math.max(0, index - 5), Math.min(lines.length, index + 5)).join("\n");
      if (nearbyLines.includes("Icon") && nearbyLines.includes("Text")) {
        log("warning", relativePath, lineNum, "flexDirection: column with icon+text may cause layout issues");
      }
    }
  });
}

function scanDirectory(dir) {
  if (!fs.existsSync(dir)) return;

  const items = fs.readdirSync(dir);
  items.forEach((item) => {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      scanDirectory(fullPath);
    } else if (item.endsWith(".tsx") || item.endsWith(".ts")) {
      scanFile(fullPath);
    }
  });
}

console.log("🔍 Yomu Reader Mobile UI Audit\n");

scanDirectory(COMPONENTS_DIR);
scanDirectory(APP_DIR);

console.log(`\n📊 Results: ${errors} errors, ${warnings} warnings`);

if (errors > 0) {
  console.log("❌ Audit failed — fix errors before committing");
  process.exit(1);
} else if (warnings > 0) {
  console.log("⚠️ Audit passed with warnings");
  process.exit(0);
} else {
  console.log("✅ Audit passed");
  process.exit(0);
}
```

- [ ] **Step 2: Ajouter le script dans package.json**

```json
// mobile/package.json
"scripts": {
  "ui:check": "node scripts/ui-audit.cjs"
}
```

- [ ] **Step 3: Tester le script**

```bash
cd mobile
npm run ui:check
```

Le script doit détecter les warnings actuels (flexShrink: 0, etc.).

- [ ] **Step 4: Commit**

```bash
git add mobile/scripts/ui-audit.cjs mobile/package.json
git commit -m "feat(mobile): add UI audit script for layout regression prevention"
```

---

### Task 6: Vérification finale et ajustements

**Files:**
- Tous les fichiers modifiés

**Interfaces:**
- Consumes: Toutes les modifications précédentes
- Produces: Application validée

- [ ] **Step 1: Lancer l'audit**

```bash
cd mobile
npm run ui:check
```

Vérifier que les warnings sont résolus ou acceptables.

- [ ] **Step 2: Test visuel complet**

Lancer l'app sur émulateur et vérifier :
- [ ] Home : chips sources lisibles
- [ ] Détail galerie : boutons bien alignés
- [ ] Cards : badges et titres corrects
- [ ] Téléchargements : "Aucun téléchargement" affiché
- [ ] Tags : chips sources lisibles

- [ ] **Step 3: Test TypeScript**

```bash
cd mobile
npx tsc --noEmit
```

- [ ] **Step 4: Test unitaire**

```bash
cd mobile
npm test
```

- [ ] **Step 5: Commit final**

```bash
git add -A
git commit -m "fix(mobile): complete UI audit and layout fixes"
```

---

## Notes pour l'exécuteur

- Les numéros de ligne sont approximatifs — chercher les noms de style exacts
- Ne pas modifier les fichiers desktop (src/)
- Le script ui-audit peut être ajusté si trop de faux positifs
- Tester sur émulateur Android 360px de large minimum
- Les accents français sont déjà corrects dans le code — vérifier le rendu police

## Dépendances entre tâches

```
Task 1 (chips) ──┐
                 ├──> Task 6 (vérification)
Task 2 (boutons)─┤
                 │
Task 3 (cards)───┤
                 │
Task 4 (empty)───┤
                 │
Task 5 (audit)───┘
```

Toutes les tâches sont indépendantes sauf Task 6 qui dépend de toutes les autres.

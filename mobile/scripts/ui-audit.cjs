#!/usr/bin/env node
/**
 * UI Audit Script for Yomu Reader Mobile
 * Détecte textes/boutons/chips tronqués (flexShrink, includeFontPadding, ellipsis)
 * + inventaire des affichages de tags (TagLabel / GalleryTagChip)
 */

const fs = require("fs");
const path = require("path");

const MOBILE_ROOT = path.join(__dirname, "..");
const COMPONENTS_DIR = path.join(MOBILE_ROOT, "components");
const APP_DIR = path.join(MOBILE_ROOT, "app");

const TAG_DISPLAY_SITES = [
  { file: "app/book/[id]/index.tsx", required: ["GalleryTagChip"] },
  { file: "components/BookCard/index.tsx", required: ["TagLabel"] },
  { file: "app/tags/index.tsx", required: ["TagLabel"] },
  { file: "app/index.tsx", required: ["TagLabel"] },
  { file: "app/recommendations.tsx", required: ["TagLabel"] },
  { file: "components/modals/CollectionPickerModal.tsx", required: ["TagLabel"] },
  { file: "app/settings/index.tsx", required: ["TagLabel"] },
  { file: "components/ui/GalleryTagChip.tsx", required: ["TagLabel"] },
];

/** Styles de nom de tag (audit tag dédié) */
const TAG_TEXT_STYLE_RE =
  /^(tagChipText|tagName|termName|suggestionName|blackTagText|selectTagText|colTagBadgeText|preferenceChipText)$/;

/** Styles texte/bouton génériques */
const UI_TEXT_STYLE_RE =
  /(?:Text|Title|Label|BtnText|Name|Sub|Hint|ChipText|BannerText|MenuText|RowText|ActionText)$/;

/** En-têtes courts — flexShrink: 0 acceptable */
const TEXT_STYLE_ALLOW_SHRINK0 =
  /^(sortHeader|sectionTitle|headerTitle|headerSub|categoryBadgeText|countLabel|tagChipCount)$/;

const RAW_TAG_NAME_RE = /\{(?:t|tag|item|f)\.name\}/;

let errors = 0;
let warnings = 0;

function log(type, file, line, message) {
  const prefix = type === "error" ? "❌" : "⚠️";
  const loc = line ? `${file}:${line}` : file;
  console.log(`${prefix} ${loc} — ${message}`);
  if (type === "error") errors++;
  else warnings++;
}

function getStyleBlock(lines, startIndex) {
  let depth = 0;
  let started = false;
  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];
    depth += (line.match(/\{/g) || []).length;
    depth -= (line.match(/\}/g) || []).length;
    if (line.includes("{")) started = true;
    if (started && depth <= 0) {
      return lines.slice(startIndex, i + 1).join("\n");
    }
  }
  return lines.slice(startIndex, Math.min(lines.length, startIndex + 8)).join("\n");
}

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split("\n");
  const relativePath = path.relative(MOBILE_ROOT, filePath).replace(/\\/g, "/");

  if (relativePath.includes("test/") || relativePath.endsWith(".test.tsx")) {
    return;
  }

  lines.forEach((line, index) => {
    const lineNum = index + 1;

    // --- includeFontPadding: false (rogne les glyphes Android) ---
    if (
      line.includes("includeFontPadding: false") &&
      !line.trim().startsWith("*") &&
      !line.trim().startsWith("//")
    ) {
      log(
        "error",
        relativePath,
        lineNum,
        "includeFontPadding: false — rogne les lettres sur Android"
      );
    }

    const styleKeyMatch = line.match(/^\s+([a-zA-Z][a-zA-Z0-9]*):\s*\{/);
    if (styleKeyMatch) {
      const key = styleKeyMatch[1];
      const block = getStyleBlock(lines, index);

      if (
        (TAG_TEXT_STYLE_RE.test(key) || (UI_TEXT_STYLE_RE.test(key) && !TEXT_STYLE_ALLOW_SHRINK0.test(key))) &&
        /flexShrink:\s*0/.test(block)
      ) {
        log(
          "error",
          relativePath,
          lineNum,
          `Style « ${key} » utilise flexShrink: 0 — risque de troncature mid-word`
        );
      }

      if (TAG_TEXT_STYLE_RE.test(key) && /includeFontPadding:\s*false/.test(block)) {
        log(
          "error",
          relativePath,
          lineNum,
          `Style tag « ${key} » utilise includeFontPadding: false`
        );
      }
    }

    // numberOfLines={1} sans ellipsizeMode (risque de coupure mid-word)
    if (line.includes("numberOfLines={1}") || line.includes("numberOfLines={ 1 }")) {
      const window = lines.slice(index, Math.min(lines.length, index + 4)).join("\n");
      if (!window.includes("ellipsizeMode")) {
        log(
          "warning",
          relativePath,
          lineNum,
          "numberOfLines={1} sans ellipsizeMode — préférer ellipsizeMode=\"tail\""
        );
      }
    }

    if (RAW_TAG_NAME_RE.test(line)) {
      const window = lines.slice(Math.max(0, index - 3), Math.min(lines.length, index + 3)).join("\n");
      if (window.includes("<Text") && !window.includes("TagLabel") && !window.includes("GalleryTagChip")) {
        log("warning", relativePath, lineNum, "Nom de tag via <Text> brut — préférer <TagLabel>");
      }
    }

    // French without accents
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
  });
}

function scanDirectory(dir) {
  if (!fs.existsSync(dir)) return;
  for (const item of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) scanDirectory(fullPath);
    else if (item.endsWith(".tsx") || item.endsWith(".ts")) scanFile(fullPath);
  }
}

function auditTagDisplaySites() {
  console.log("\n🏷️  Inventaire affichage tags\n");
  for (const site of TAG_DISPLAY_SITES) {
    const fullPath = path.join(MOBILE_ROOT, site.file);
    if (!fs.existsSync(fullPath)) {
      log("error", site.file, 0, "Fichier tag display manquant");
      continue;
    }
    const content = fs.readFileSync(fullPath, "utf8");
    const missing = site.required.filter((sym) => !content.includes(sym));
    if (missing.length > 0) {
      log("error", site.file, 0, `Composant tag manquant: ${missing.join(", ")}`);
    } else {
      console.log(`✅ ${site.file} → ${site.required.join(", ")}`);
    }
  }
}

console.log("🔍 Yomu Reader Mobile UI Audit (textes, boutons, tags)\n");

scanDirectory(COMPONENTS_DIR);
scanDirectory(APP_DIR);
auditTagDisplaySites();

console.log(`\n📊 Results: ${errors} errors, ${warnings} warnings`);

if (errors > 0) {
  console.log("❌ Audit failed — fix errors before committing");
  process.exit(1);
}
if (warnings > 0) {
  console.log("⚠️ Audit passed with warnings");
  process.exit(0);
}
console.log("✅ Audit passed");
process.exit(0);

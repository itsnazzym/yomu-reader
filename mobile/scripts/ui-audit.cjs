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

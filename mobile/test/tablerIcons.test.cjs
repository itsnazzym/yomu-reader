const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const mobileRoot = path.resolve(__dirname, "..");

function walkTsFiles(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (
      entry.name === "node_modules" ||
      entry.name === "android" ||
      entry.name === ".expo" ||
      entry.name === "TablerIcons.tsx"
    ) {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkTsFiles(full, acc);
    } else if (/\.(tsx|ts)$/.test(entry.name)) {
      acc.push(full);
    }
  }
  return acc;
}

function collectImportedIcons() {
  const imported = new Set();
  const files = ["app", "components", "lib"].flatMap((dir) =>
    walkTsFiles(path.join(mobileRoot, dir))
  );

  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    if (!text.includes("@tabler/icons-react-native")) continue;
    const blocks =
      text.match(
        /import\s*(?:type\s*)?\{[\s\S]*?\}\s*from\s*['"]@tabler\/icons-react-native['"]/g
      ) || [];
    for (const block of blocks) {
      if (/import\s+type/.test(block)) continue;
      for (const name of block.match(/Icon[A-Za-z0-9]+/g) || []) {
        imported.add(name);
      }
    }
  }
  return imported;
}

function collectExportedIcons() {
  const src = fs.readFileSync(
    path.join(mobileRoot, "components", "ui", "TablerIcons.tsx"),
    "utf8"
  );
  return new Set(
    (src.match(/export const (Icon[A-Za-z0-9]+)/g) || []).map((line) =>
      line.replace("export const ", "")
    )
  );
}

test("esbuild mock for @tabler/icons-react-native is committed", () => {
  assert.equal(
    fs.existsSync(path.join(__dirname, "mockTablerIcons.cjs")),
    true,
    "mobile/test/mockTablerIcons.cjs missing — CI bundle.mjs cannot alias Tabler icons"
  );
});

test("TablerIcons wrapper exports every icon imported by the app", () => {
  const imported = collectImportedIcons();
  const exported = collectExportedIcons();
  const missing = [...imported].filter((name) => !exported.has(name)).sort();
  assert.deepEqual(
    missing,
    [],
    `Missing TablerIcons exports (undefined in APK): ${missing.join(", ")}`
  );
});

#!/usr/bin/env node
/**
 * Affiche les alias d'un keystore existant (sans écrire release.properties).
 *
 * Usage :
 *   npm run verify:signing
 *   node scripts/verify-keystore.cjs --store-pass "..."
 */
const fs = require("fs");
const path = require("path");
const readline = require("readline");
const { listKeystoreAliases } = require("../releaseSigning.cjs");

const mobileRoot = path.join(__dirname, "..");
const keystorePath = path.join(mobileRoot, "keys", "release-key.keystore");

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--store-pass") out.storePass = argv[++i];
  }
  return out;
}

function prompt(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!fs.existsSync(keystorePath)) {
    console.error(`❌ Keystore manquant : ${keystorePath}`);
    process.exit(1);
  }

  const stat = fs.statSync(keystorePath);
  console.log(`✅ Keystore : keys/release-key.keystore (${stat.size} octets)`);

  const storePass =
    args.storePass || (await prompt("KEYSTORE_PASSWORD (mot de passe du keystore) : "));
  if (!storePass) {
    console.error("❌ Mot de passe keystore requis.");
    process.exit(1);
  }

  try {
    const aliases = listKeystoreAliases(keystorePath, storePass);
    if (aliases.length === 0) {
      console.log("⚠️  Keystore valide mais aucun alias détecté.");
      process.exit(1);
    }
    console.log(`\nAlias trouvé(s) : ${aliases.join(", ")}`);
    if (aliases.length === 1) {
      console.log(`\nUtilisez KEY_ALIAS=${aliases[0]} dans setup:signing`);
    }
  } catch (err) {
    console.error("❌ Mot de passe incorrect ou keytool indisponible.");
    if (err instanceof Error && err.message) {
      console.error(`   ${err.message.split("\n")[0]}`);
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

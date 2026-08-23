#!/usr/bin/env node
/**
 * Crée mobile/keys/release.properties pour signer les APK locaux
 * avec la même clé que GitHub Actions.
 *
 * Usage :
 *   npm run setup:signing
 *   npm run setup:signing -- --from-env
 *   node scripts/setup-release-signing.cjs --store-pass xxx --alias yyy --key-pass zzz
 */
const fs = require("fs");
const path = require("path");
const readline = require("readline");
const {
  PROP_KEYS,
  writePropertiesFile,
  applyReleaseSigning,
  listKeystoreAliases,
  verifyReleaseKeystore,
} = require("../releaseSigning.cjs");

const mobileRoot = path.join(__dirname, "..");
const propsPath = path.join(mobileRoot, "keys", "release.properties");
const keystorePath = path.join(mobileRoot, "keys", "release-key.keystore");

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--from-env") out.fromEnv = true;
    if (arg === "--apply") out.apply = true;
    if (arg === "--store-pass") out.storePass = argv[++i];
    if (arg === "--alias") out.alias = argv[++i];
    if (arg === "--key-pass") out.keyPass = argv[++i];
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
    console.error("   Place release-key.keystore dans mobile/keys/");
    process.exit(1);
  }

  const keystoreStat = fs.statSync(keystorePath);
  console.log(`✅ Keystore déjà présent : keys/release-key.keystore (${keystoreStat.size} octets)`);

  let props = {};

  if (args.fromEnv) {
    props = {
      KEYSTORE_PASSWORD: process.env.KEYSTORE_PASSWORD || "",
      KEY_ALIAS: process.env.KEY_ALIAS || "",
      KEY_PASSWORD: process.env.KEY_PASSWORD || "",
    };
  } else if (args.storePass && args.alias && args.keyPass) {
    props = {
      KEYSTORE_PASSWORD: args.storePass,
      KEY_ALIAS: args.alias,
      KEY_PASSWORD: args.keyPass,
    };
  } else {
    console.log("\nIl manque seulement keys/release.properties (mots de passe + alias).");
    console.log("Utilisez les mêmes valeurs que lors de la création du keystore / secrets GitHub.\n");
    props.KEYSTORE_PASSWORD = await prompt("KEYSTORE_PASSWORD : ");
    try {
      const aliases = listKeystoreAliases(keystorePath, props.KEYSTORE_PASSWORD);
      if (aliases.length === 1) {
        console.log(`   → Alias détecté : ${aliases[0]}`);
        props.KEY_ALIAS = aliases[0];
      } else if (aliases.length > 1) {
        console.log(`   → Alias possibles : ${aliases.join(", ")}`);
        props.KEY_ALIAS = await prompt("KEY_ALIAS : ");
      } else {
        props.KEY_ALIAS = await prompt("KEY_ALIAS : ");
      }
    } catch {
      console.error("❌ KEYSTORE_PASSWORD incorrect.");
      process.exit(1);
    }
    props.KEY_PASSWORD = await prompt("KEY_PASSWORD (Entrée = même que store) : ");
    if (!props.KEY_PASSWORD) {
      props.KEY_PASSWORD = props.KEYSTORE_PASSWORD;
    }
  }

  for (const key of PROP_KEYS) {
    if (!props[key]) {
      console.error(`❌ ${key} manquant.`);
      process.exit(1);
    }
  }

  try {
    verifyReleaseKeystore(
      keystorePath,
      props.KEYSTORE_PASSWORD,
      props.KEY_ALIAS,
      props.KEY_PASSWORD
    );
  } catch {
    console.error("❌ Vérification échouée : alias ou KEY_PASSWORD incorrect.");
    process.exit(1);
  }

  writePropertiesFile(propsPath, props);
  console.log(`✅ Écrit : ${propsPath}`);

  if (args.apply || fs.existsSync(path.join(mobileRoot, "android", "app", "build.gradle"))) {
    try {
      applyReleaseSigning(mobileRoot);
      console.log("✅ Gradle Android configuré (release-key.keystore + MYAPP_UPLOAD_*)");
    } catch (err) {
      console.warn("⚠️  properties OK ; Gradle non appliqué :", err.message);
    }
  }

  console.log("\nProchain build signé prod : npm run build:apk");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

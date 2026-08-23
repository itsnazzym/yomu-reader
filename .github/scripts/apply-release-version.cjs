const fs = require("fs");
const path = require("path");

const SEMVER = /^\d+\.\d+\.\d+$/;

function readRequiredEnv(name) {
  const value = process.env[name];
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Variable d'environnement manquante: ${name}`);
  }
  return value.trim();
}

function writeJson(filePath, mutator) {
  const abs = path.resolve(filePath);
  if (!fs.existsSync(abs)) {
    throw new Error(`Fichier introuvable: ${abs}`);
  }

  let data;
  try {
    data = JSON.parse(fs.readFileSync(abs, "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`JSON invalide (${abs}): ${message}`);
  }

  mutator(data);
  fs.writeFileSync(abs, `${JSON.stringify(data, null, 2)}\n`);
}

function applyReleaseVersion() {
  const version = readRequiredEnv("APP_VERSION");
  if (!SEMVER.test(version)) {
    throw new Error(`APP_VERSION invalide (attendu x.y.z): ${version}`);
  }

  const versionCode = Number.parseInt(readRequiredEnv("APP_VERSION_CODE"), 10);
  if (!Number.isInteger(versionCode) || versionCode < 1) {
    throw new Error(`APP_VERSION_CODE invalide: ${process.env.APP_VERSION_CODE}`);
  }

  writeJson("package.json", (pkg) => {
    pkg.version = version;
  });

  writeJson("mobile/package.json", (pkg) => {
    pkg.version = version;
  });

  writeJson("mobile/app.json", (app) => {
    if (!app.expo || typeof app.expo !== "object") {
      throw new Error("mobile/app.json: expo manquant");
    }
    app.expo.version = version;
    if (!app.expo.android || typeof app.expo.android !== "object") {
      app.expo.android = {};
    }
    app.expo.android.versionCode = versionCode;
  });

  console.log(`Applied version ${version} (versionCode=${versionCode})`);
}

try {
  applyReleaseVersion();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
}

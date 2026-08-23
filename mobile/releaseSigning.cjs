/**
 * Signature release Android — local (keys/release.properties) ou CI (env).
 * Ne jamais committer keys/release.properties ni *.keystore.
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const PROP_KEYS = [
  "KEYSTORE_PASSWORD",
  "KEY_ALIAS",
  "KEY_PASSWORD",
];

function readPropertiesFile(filePath) {
  const out = {};
  if (!fs.existsSync(filePath)) return out;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function findKeytool() {
  const javaHome = process.env.JAVA_HOME;
  if (javaHome) {
    const name = process.platform === "win32" ? "keytool.exe" : "keytool";
    const candidate = path.join(javaHome, "bin", name);
    if (fs.existsSync(candidate)) return candidate;
  }
  return "keytool";
}

/** @returns {string[]} alias names in the keystore */
function listKeystoreAliases(keystorePath, storePassword) {
  const output = execFileSync(
    findKeytool(),
    ["-list", "-keystore", keystorePath, "-storepass", storePassword],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
  );
  const aliases = [];
  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^([^\s,]+),\s*\d+/);
    if (match) aliases.push(match[1]);
  }
  return aliases;
}

/** Throws if store/key password or alias is wrong. */
function verifyReleaseKeystore(keystorePath, storePassword, keyAlias, keyPassword) {
  execFileSync(
    findKeytool(),
    [
      "-list",
      "-keystore",
      keystorePath,
      "-alias",
      keyAlias,
      "-storepass",
      storePassword,
      "-keypass",
      keyPassword,
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
  );
}

function writePropertiesFile(filePath, props) {
  const lines = [
    "# Généré par setup-release-signing — ne pas committer",
    `# ${new Date().toISOString()}`,
    ...PROP_KEYS.map((key) => `${key}=${props[key] ?? ""}`),
    "",
  ];
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, lines.join("\n"), "utf8");
}

/**
 * @returns {{ storeFile: string, storePassword: string, keyAlias: string, keyPassword: string } | null}
 */
function resolveReleaseCredentials(mobileRoot) {
  if (process.env.KEYSTORE_BASE64 || process.env.KEYSTORE_PASSWORD) {
    if (
      !process.env.KEYSTORE_PASSWORD ||
      !process.env.KEY_ALIAS ||
      !process.env.KEY_PASSWORD
    ) {
      return null;
    }
    return {
      storeFile: "release-key.keystore",
      storePassword: process.env.KEYSTORE_PASSWORD,
      keyAlias: process.env.KEY_ALIAS,
      keyPassword: process.env.KEY_PASSWORD,
    };
  }

  const propsPath = path.join(mobileRoot, "keys", "release.properties");
  const props = readPropertiesFile(propsPath);
  if (
    props.KEYSTORE_PASSWORD &&
    props.KEY_ALIAS &&
    props.KEY_PASSWORD
  ) {
    return {
      storeFile: "release-key.keystore",
      storePassword: props.KEYSTORE_PASSWORD,
      keyAlias: props.KEY_ALIAS,
      keyPassword: props.KEY_PASSWORD,
    };
  }

  const gradlePropsPath = path.join(mobileRoot, "android", "gradle.properties");
  if (fs.existsSync(gradlePropsPath)) {
    const text = fs.readFileSync(gradlePropsPath, "utf8");
    const get = (key) => {
      const m = text.match(new RegExp(`^${key}\\s*=\\s*(.+)$`, "m"));
      return m ? m[1].trim() : undefined;
    };
    const storeFile = get("MYAPP_UPLOAD_STORE_FILE");
    if (storeFile && get("MYAPP_UPLOAD_STORE_PASSWORD")) {
      return {
        storeFile,
        storePassword: get("MYAPP_UPLOAD_STORE_PASSWORD"),
        keyAlias: get("MYAPP_UPLOAD_KEY_ALIAS"),
        keyPassword: get("MYAPP_UPLOAD_KEY_PASSWORD"),
      };
    }
  }

  return null;
}

function copyReleaseKeystore(mobileRoot) {
  const src = path.join(mobileRoot, "keys", "release-key.keystore");
  const dest = path.join(mobileRoot, "android", "app", "release-key.keystore");
  if (!fs.existsSync(src)) {
    throw new Error(
      `Keystore introuvable : ${src}\nPlace release-key.keystore dans mobile/keys/`
    );
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  return dest;
}

function upsertGradleProperty(content, key, value) {
  const line = `${key}=${value}`;
  const re = new RegExp(`^${key}\\s*=.*$`, "m");
  if (re.test(content)) {
    return content.replace(re, line);
  }
  const trimmed = content.replace(/\s+$/, "");
  return `${trimmed}\n${line}\n`;
}

function applyGradleProperties(mobileRoot, creds) {
  const gpPath = path.join(mobileRoot, "android", "gradle.properties");
  if (!fs.existsSync(gpPath)) {
    throw new Error(`gradle.properties introuvable : ${gpPath}\nLancez npx expo prebuild --platform android`);
  }
  let content = fs.readFileSync(gpPath, "utf8");
  content = upsertGradleProperty(content, "MYAPP_UPLOAD_STORE_FILE", creds.storeFile);
  content = upsertGradleProperty(content, "MYAPP_UPLOAD_STORE_PASSWORD", creds.storePassword);
  content = upsertGradleProperty(content, "MYAPP_UPLOAD_KEY_ALIAS", creds.keyAlias);
  content = upsertGradleProperty(content, "MYAPP_UPLOAD_KEY_PASSWORD", creds.keyPassword);
  fs.writeFileSync(gpPath, content, "utf8");
}

function applyBuildGradleSigning(mobileRoot) {
  const bgPath = path.join(mobileRoot, "android", "app", "build.gradle");
  if (!fs.existsSync(bgPath)) {
    throw new Error(`build.gradle introuvable : ${bgPath}`);
  }
  let contents = fs.readFileSync(bgPath, "utf8");

  if (!contents.includes("MYAPP_UPLOAD_STORE_FILE")) {
    const signingMarker = "signingConfigs {";
    if (!contents.includes(signingMarker)) {
      throw new Error("signingConfigs { introuvable dans app/build.gradle");
    }
    const releaseConfig = `
        release {
            storeFile file(MYAPP_UPLOAD_STORE_FILE)
            storePassword MYAPP_UPLOAD_STORE_PASSWORD
            keyAlias MYAPP_UPLOAD_KEY_ALIAS
            keyPassword MYAPP_UPLOAD_KEY_PASSWORD
        }`;
    contents = contents.replace(signingMarker, `${signingMarker}${releaseConfig}`);
  }

  const debugInRelease =
    "signingConfig signingConfigs.debug\n            def enableShrinkResources";
  const releaseInRelease =
    "signingConfig signingConfigs.release\n            def enableShrinkResources";
  if (contents.includes(debugInRelease) && !contents.includes(releaseInRelease)) {
    contents = contents.replace(debugInRelease, releaseInRelease);
  }

  fs.writeFileSync(bgPath, contents, "utf8");
}

/** Applique keystore + gradle pour signer comme la CI. */
function applyReleaseSigning(mobileRoot) {
  const creds = resolveReleaseCredentials(mobileRoot);
  if (!creds) {
    throw new Error(
      "Signature release non configurée.\n" +
        "1. Copiez scripts/release.properties.example vers keys/release.properties\n" +
        "2. Remplissez KEYSTORE_PASSWORD, KEY_ALIAS, KEY_PASSWORD (mêmes valeurs que GitHub Secrets)\n" +
        "3. Ou : npm run setup:signing"
    );
  }
  copyReleaseKeystore(mobileRoot);
  applyGradleProperties(mobileRoot, creds);
  applyBuildGradleSigning(mobileRoot);
  return creds;
}

module.exports = {
  PROP_KEYS,
  readPropertiesFile,
  writePropertiesFile,
  listKeystoreAliases,
  verifyReleaseKeystore,
  resolveReleaseCredentials,
  copyReleaseKeystore,
  applyReleaseSigning,
};

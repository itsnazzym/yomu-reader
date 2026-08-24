#!/usr/bin/env node
/**
 * Build APK arm64-v8a signé avec la clé release (même signature que la CI).
 */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { applyReleaseSigning } = require("../releaseSigning.cjs");

const mobileRoot = path.join(__dirname, "..");
const androidRoot = path.join(mobileRoot, "android");
const gradlew =
  process.platform === "win32"
    ? path.join(androidRoot, "gradlew.bat")
    : path.join(androidRoot, "gradlew");

function run(cmd, args, opts = {}) {
  // Windows : .bat via cmd.exe, sans `shell: true` (évite DEP0190).
  const res =
    process.platform === "win32"
      ? spawnSync("cmd.exe", ["/d", "/s", "/c", cmd, ...args], {
          stdio: "inherit",
          windowsHide: true,
          ...opts,
        })
      : spawnSync(cmd, args, {
          stdio: "inherit",
          ...opts,
        });
  if (res.status !== 0) {
    process.exit(res.status ?? 1);
  }
}

function main() {
  if (!fs.existsSync(gradlew)) {
    console.error("❌ android/gradlew absent. Lancez : npx expo prebuild --platform android");
    process.exit(1);
  }

  console.log("🔐 Application de la signature release…");
  applyReleaseSigning(mobileRoot);

  console.log("📦 assembleRelease arm64-v8a…");
  const env = { ...process.env, NODE_ENV: "production" };
  run(gradlew, ["assembleRelease", "-PreactNativeArchitectures=arm64-v8a"], {
    cwd: androidRoot,
    env,
  });

  const rawApk = path.join(
    androidRoot,
    "app",
    "build",
    "outputs",
    "apk",
    "release",
    "app-release.apk"
  );
  if (!fs.existsSync(rawApk)) {
    console.error("❌ APK release introuvable après le build.");
    process.exit(1);
  }

  const appJson = JSON.parse(
    fs.readFileSync(path.join(mobileRoot, "app.json"), "utf8")
  );
  const version = appJson.expo?.version || "1.0.0";
  const outApk = path.join(mobileRoot, `YomuReader-${version}-arm64-v8a.apk`);
  fs.copyFileSync(rawApk, outApk);

  const apksignerDir = process.env.ANDROID_HOME
    ? fs
        .readdirSync(path.join(process.env.ANDROID_HOME, "build-tools"))
        .sort()
        .reverse()[0]
    : null;
  console.log(`\n✅ APK : ${outApk}`);
  console.log(`   Taille : ${(fs.statSync(outApk).size / 1024 / 1024).toFixed(1)} Mo`);

  if (apksignerDir && process.env.ANDROID_HOME) {
    const apksigner =
      process.platform === "win32"
        ? path.join(process.env.ANDROID_HOME, "build-tools", apksignerDir, "apksigner.bat")
        : path.join(process.env.ANDROID_HOME, "build-tools", apksignerDir, "apksigner");
    if (fs.existsSync(apksigner)) {
      const verify = spawnSync(
        apksigner,
        ["verify", "--print-certs", outApk],
        { encoding: "utf8" }
      );
      const dn = (verify.stdout || verify.stderr || "").match(/certificate DN: ([^\r\n]+)/);
      if (dn) {
        console.log(`   Certificat : ${dn[1]}`);
        if (/Android Debug/i.test(dn[1])) {
          console.warn("   ⚠️  Toujours signé en DEBUG — vérifiez keys/release.properties");
        } else {
          console.log("   ✓ Signature release (pas debug)");
        }
      }
    }
  }
}

main();

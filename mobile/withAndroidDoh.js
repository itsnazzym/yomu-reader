/* eslint-env node */
const fs = require("fs");
const path = require("path");
const {
  createRunOncePlugin,
  withAppBuildGradle,
  withMainApplication,
  withGradleProperties,
  withDangerousMod,
} = require("@expo/config-plugins");

const DOH_DEPENDENCY =
  'implementation("com.squareup.okhttp3:okhttp-dnsoverhttps:4.9.2")';

const FILE_SUPPRESS = '@file:Suppress("DEPRECATION")';
const CLASS_MARKER =
  "class MainApplication : Application(), ReactApplication {";
const ON_CREATE_MARKER = `  override fun onCreate() {
    super.onCreate()
`;

function setGradleProperty(properties, key, value) {
  const existing = properties.find(
    (item) => item.type === "property" && item.key === key
  );
  if (existing) {
    existing.value = value;
  } else {
    properties.push({
      type: "property",
      key,
      value,
    });
  }
}

function applyDohGradleProperties(properties) {
  const next = Array.isArray(properties) ? properties : [];
  setGradleProperty(next, "reactNativeArchitectures", "arm64-v8a");
  setGradleProperty(next, "org.gradle.parallel", "true");
  setGradleProperty(next, "org.gradle.caching", "true");
  setGradleProperty(next, "org.gradle.daemon", "true");
  // configure-on-demand + New Architecture: :app:configureCMake* can run
  // before library codegen creates android/build/generated/source/codegen/jni.
  setGradleProperty(next, "org.gradle.configureondemand", "false");
  setGradleProperty(next, "kotlin.incremental", "true");
  setGradleProperty(
    next,
    "org.gradle.jvmargs",
    "-Xmx4096m -XX:MaxMetaspaceSize=1024m -XX:+UseG1GC"
  );
  setGradleProperty(next, "android.enablePngCrunchInReleaseBuilds", "true");
  return next;
}

function patchMainApplicationKt(contents) {
  if (typeof contents !== "string" || contents.trim() === "") {
    throw new Error("MainApplication.kt vide");
  }

  let source = contents.replace(/\r\n/g, "\n");
  source = source.split(FILE_SUPPRESS).join("").replace(/\n{3,}/g, "\n\n");
  source = `${FILE_SUPPRESS}\n${source.replace(/^\n+/, "")}`;

  // Upgrade already-generated Android trees as well as clean prebuilds.
  // The old guard only installed once and silently kept outdated DNS code.
  const legacyStart = source.indexOf("private class DohFallbackDns");
  if (legacyStart >= 0) {
    const application = source.indexOf(CLASS_MARKER, legacyStart);
    if (application < 0) throw new Error("MainApplication Android utilise un format inattendu");
    source = source.slice(0, legacyStart) + source.slice(application);
  }
  source = source.replace(/\n\s*installDohImageNetworking\(this\)\n/g, "\n");
  source = source.replace(/\n\s*OkHttpClientProvider\.setOkHttpClientFactory\(object : OkHttpClientFactory \{[\s\S]*?\n\s*\}\)\n/g, "\n");
  if (!source.includes("YomuNetworking.install(this)")) {
    if (!source.includes(ON_CREATE_MARKER)) throw new Error("Impossible de trouver onCreate dans MainApplication.kt");
    source = source.replace(ON_CREATE_MARKER, ON_CREATE_MARKER + "    YomuNetworking.install(this)\n");
  }
  if (!source.includes("add(YomuNetworkPackage())")) {
    source = source.replace(/PackageList\(this\)\.packages\.apply\s*\{/, "$&\n              add(YomuNetworkPackage())");
  }
  return source.replace(/\n{3,}/g, "\n\n");
}

function withAndroidDoh(config) {
  config = withDangerousMod(config, ["android", async (next) => {
    const packageDir = path.join(next.modRequest.platformProjectRoot, "app/src/main/java/com/nhentaidownlo/mobile");
    fs.mkdirSync(packageDir, { recursive: true });
    fs.copyFileSync(path.join(__dirname, "native/YomuNetworkModule.kt"), path.join(packageDir, "YomuNetworkModule.kt"));
    return next;
  }]);
  config = withGradleProperties(config, (modConfig) => {
    applyDohGradleProperties(modConfig.modResults);
    return modConfig;
  });

  config = withAppBuildGradle(config, (modConfig) => {
    if (!modConfig.modResults.contents.includes("okhttp-dnsoverhttps")) {
      const marker = "dependencies {";
      if (!modConfig.modResults.contents.includes(marker)) {
        throw new Error("Impossible de trouver le bloc dependencies Android");
      }
      modConfig.modResults.contents = modConfig.modResults.contents.replace(
        marker,
        `${marker}\n    ${DOH_DEPENDENCY}`
      );
    }

    if (!modConfig.modResults.contents.includes('abiFilters "arm64-v8a"')) {
      // SDK 54 : versionName est injecté depuis app.json (plus de "1.0.0" en dur).
      const defaultConfMarker = 'versionName "1.1.0"';
      if (modConfig.modResults.contents.includes(defaultConfMarker)) {
        modConfig.modResults.contents = modConfig.modResults.contents.replace(
          defaultConfMarker,
          `${defaultConfMarker}\n        ndk {\n            abiFilters "arm64-v8a"\n        }`
        );
      }
    }

    return modConfig;
  });

  return withMainApplication(config, (modConfig) => {
    modConfig.modResults.contents = patchMainApplicationKt(
      modConfig.modResults.contents
    );
    return modConfig;
  });
}

const plugin = createRunOncePlugin(withAndroidDoh, "with-android-doh", "2.0.0");
plugin.patchMainApplicationKt = patchMainApplicationKt;
plugin.applyDohGradleProperties = applyDohGradleProperties;
module.exports = plugin;

const fs = require("fs");
const path = require("path");
const {
  createRunOncePlugin,
  withAppBuildGradle,
  withGradleProperties,
  withDangerousMod,
} = require("@expo/config-plugins");
const { resolveReleaseCredentials } = require("./releaseSigning.cjs");

// Resolve signing credentials from (in priority order):
//   1. CI environment (GitHub Secrets injected as env vars)
//   2. mobile/keys/release.properties + keys/release-key.keystore (local)
//   3. android/gradle.properties MYAPP_UPLOAD_* (already applied)
// If none is available the release build falls back to the debug keystore.
function resolveCredentials() {
  return resolveReleaseCredentials(process.cwd());
}

function setGradleProperty(properties, key, value) {
  const existing = properties.find(
    (item) => item.type === "property" && item.key === key
  );
  if (existing) {
    existing.value = value;
  } else {
    properties.push({ type: "property", key, value });
  }
}

function withAndroidReleaseKeystore(config) {
  const creds = resolveCredentials();
  if (!creds) {
    return config;
  }

  config = withDangerousMod(config, [
    "android",
    async (modConfig) => {
      const localKeystore = path.join(process.cwd(), "keys", "release-key.keystore");
      if (fs.existsSync(localKeystore)) {
        const dest = path.join(
          modConfig.modRequest.platformProjectRoot,
          "app",
          "release-key.keystore"
        );
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(localKeystore, dest);
      }
      return modConfig;
    },
  ]);

  config = withGradleProperties(config, (modConfig) => {
    setGradleProperty(
      modConfig.modResults,
      "MYAPP_UPLOAD_STORE_FILE",
      creds.storeFile
    );
    setGradleProperty(
      modConfig.modResults,
      "MYAPP_UPLOAD_STORE_PASSWORD",
      creds.storePassword
    );
    setGradleProperty(
      modConfig.modResults,
      "MYAPP_UPLOAD_KEY_ALIAS",
      creds.keyAlias
    );
    setGradleProperty(
      modConfig.modResults,
      "MYAPP_UPLOAD_KEY_PASSWORD",
      creds.keyPassword
    );
    return modConfig;
  });

  config = withAppBuildGradle(config, (modConfig) => {
    const contents = modConfig.modResults.contents;

    if (!contents.includes("MYAPP_UPLOAD_STORE_FILE")) {
      const signingMarker = "signingConfigs {";
      if (contents.includes(signingMarker)) {
        const releaseConfig = `
        release {
            storeFile file(MYAPP_UPLOAD_STORE_FILE)
            storePassword MYAPP_UPLOAD_STORE_PASSWORD
            keyAlias MYAPP_UPLOAD_KEY_ALIAS
            keyPassword MYAPP_UPLOAD_KEY_PASSWORD
        }`;
        modConfig.modResults.contents = contents.replace(
          signingMarker,
          `${signingMarker}${releaseConfig}`
        );
      }
    }

    const debugInRelease =
      "signingConfig signingConfigs.debug\n            def enableShrinkResources";
    const releaseInRelease =
      "signingConfig signingConfigs.release\n            def enableShrinkResources";
    if (
      contents.includes(debugInRelease) &&
      !contents.includes(releaseInRelease)
    ) {
      modConfig.modResults.contents = modConfig.modResults.contents.replace(
        debugInRelease,
        releaseInRelease
      );
    }

    return modConfig;
  });

  return config;
}

module.exports = createRunOncePlugin(
  withAndroidReleaseKeystore,
  "with-android-release-keystore",
  "1.1.0"
);

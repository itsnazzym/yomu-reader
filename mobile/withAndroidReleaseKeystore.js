const fs = require("fs");
const path = require("path");
const {
  createRunOncePlugin,
  withAppBuildGradle,
  withGradleProperties,
} = require("@expo/config-plugins");

// Resolve signing credentials from (in priority order):
//   1. CI environment (GitHub Secrets injected as env vars)
//   2. a local android/gradle.properties that already carries MYAPP_UPLOAD_*
// If neither is available the release build falls back to the debug keystore
// (standard Expo behaviour) so local dev without a keystore still builds.
function resolveCredentials() {
  if (process.env.KEYSTORE_BASE64) {
    // CI path: the keystore file is restored by the workflow into
    // android/app/release-key.keystore before the Gradle build runs.
    return {
      storeFile: "release-key.keystore",
      storePassword: process.env.KEYSTORE_PASSWORD,
      keyAlias: process.env.KEY_ALIAS,
      keyPassword: process.env.KEY_PASSWORD,
    };
  }

  const gradleProps = path.join(process.cwd(), "android", "gradle.properties");
  if (fs.existsSync(gradleProps)) {
    const text = fs.readFileSync(gradleProps, "utf8");
    const get = (key) => {
      const m = text.match(new RegExp(`^${key}\\s*=\\s*(.+)$`, "m"));
      return m ? m[1].trim() : undefined;
    };
    const storeFile = get("MYAPP_UPLOAD_STORE_FILE");
    if (storeFile) {
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

  // 1. Publish the signing properties consumed by app/build.gradle.
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

  // 2. Inject the release signing config into app/build.gradle.
  config = withAppBuildGradle(config, (modConfig) => {
    const contents = modConfig.modResults.contents;

    // Add the `release` signing config inside the existing signingConfigs { } block.
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

    // Point the release build type at the release signing config instead of debug.
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
  "1.0.0"
);

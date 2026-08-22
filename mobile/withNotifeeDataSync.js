/**
 * Config plugin : surcharge le ForegroundService de notifee en type `dataSync`
 * (obligatoire pour les services longs sur Android 14+ / targetSdk 34 — le
 * manifest AAR de notifee le déclare en `shortService`, limité à ~3 minutes).
 *
 * Injecte aussi la permission FOREGROUND_SERVICE_DATA_SYNC.
 *
 * Usage (app.json > expo.plugins) : "./withNotifeeDataSync"
 *
 * Réf. officielle notifee :
 * https://notifee.app/react-native/docs/android/foreground-service
 */

const { withAndroidManifest, AndroidConfig } = require("expo/config-plugins");

const FOREGROUND_SERVICE_PERMISSIONS = [
  "android.permission.FOREGROUND_SERVICE",
  "android.permission.FOREGROUND_SERVICE_DATA_SYNC",
];

/** Nom canonique du service notifee (package du AAR embarqué). */
const NOTIFEE_SERVICE_NAME = "app.notifee.core.ForegroundService";

module.exports = function withNotifeeDataSync(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults;

    // 1. Permissions foreground service (idempotent)
    const permissions = manifest.manifest["uses-permission"] || [];
    const existingNames = new Set(
      permissions.map((p) => p.$ && p.$["android:name"]).filter(Boolean)
    );
    for (const name of FOREGROUND_SERVICE_PERMISSIONS) {
      if (!existingNames.has(name)) {
        permissions.push({ $: { "android:name": name } });
        existingNames.add(name);
      }
    }
    manifest.manifest["uses-permission"] = permissions;

    // 2. Surcharger le service notifee en dataSync
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
    const services = application.service || [];
    const target = services.find(
      (s) => s.$ && s.$["android:name"] === NOTIFEE_SERVICE_NAME
    );
    if (target) {
      target.$ = {
        ...target.$,
        "android:foregroundServiceType": "dataSync",
      };
    } else {
      // Le AAR de notifee fusionne son manifest au build Gradle, APRÈS le
      // prebuild : on déclare donc le service ici avec tools:replace pour que
      // notre attribut gagne la fusion de manifests.
      const toolsNs = "http://schemas.android.com/tools";
      const root = manifest.manifest;
      root.$ = root.$ || {};
      if (!root.$["xmlns:tools"]) {
        root.$["xmlns:tools"] = toolsNs;
      }
      services.push({
        $: {
          "android:name": NOTIFEE_SERVICE_NAME,
          "android:exported": "false",
          "android:foregroundServiceType": "dataSync",
          "tools:replace": "android:foregroundServiceType",
        },
      });
      application.service = services;
    }

    return config;
  });
};

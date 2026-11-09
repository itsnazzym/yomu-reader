const { withMainActivity, withAndroidManifest } = require("@expo/config-plugins");

function patchMainActivity(source) {
  if (source.includes("// Yomu: protection avant le premier affichage")) return source;
  const marker = /super\.onCreate\([^)]*\)/;
  if (!marker.test(source)) throw new Error("MainActivity: onCreate introuvable pour la protection des captures");
  return source.replace(marker, `// Yomu: protection avant le premier affichage\n    window.addFlags(android.view.WindowManager.LayoutParams.FLAG_SECURE)\n    $&`);
}

module.exports = function withPrivacyScreenCapture(config) {
  config = withAndroidManifest(config, (result) => {
    const activity = result.modResults.manifest.application?.[0]?.activity?.find(
      (item) => item.$["android:name"]?.endsWith("MainActivity")
    );
    if (!activity) throw new Error("MainActivity absente du manifeste Android");
    const changes = new Set((activity.$["android:configChanges"] || "").split("|").filter(Boolean));
    changes.add("fontScale");
    activity.$["android:configChanges"] = [...changes].join("|");
    return result;
  });
  return withMainActivity(config, (result) => {
    if (result.modResults.language !== "kt") throw new Error("La protection Yomu attend MainActivity en Kotlin");
    result.modResults.contents = patchMainActivity(result.modResults.contents);
    return result;
  });
};
module.exports.patchMainActivity = patchMainActivity;

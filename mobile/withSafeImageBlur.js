const fs = require("node:fs");
const path = require("node:path");
const { withDangerousMod } = require("@expo/config-plugins");

const original = "import jp.wasabeef.glide.transformations.BlurTransformation";
const replacement = "import expo.modules.image.YomuBlurTransformation as BlurTransformation";

function patchImageWrapper(source) {
  if (source.includes(replacement)) return source;
  if (!source.includes(original)) throw new Error("Le correctif du flou doit être revérifié pour cette version d'expo-image.");
  return source.replace(original, replacement);
}

module.exports = function withSafeImageBlur(config) {
  return withDangerousMod(config, ["android", async (result) => {
    const packageRoot = path.dirname(require.resolve("expo-image/package.json", { paths: [result.modRequest.projectRoot] }));
    const sourceRoot = path.join(packageRoot, "android/src/main/java/expo/modules/image");
    const wrapper = path.join(sourceRoot, "ExpoImageViewWrapper.kt");
    fs.writeFileSync(wrapper, patchImageWrapper(fs.readFileSync(wrapper, "utf8")));
    fs.copyFileSync(path.join(result.modRequest.projectRoot, "native/YomuBlurTransformation.java"), path.join(sourceRoot, "YomuBlurTransformation.java"));
    return result;
  }]);
};
module.exports.patchImageWrapper = patchImageWrapper;

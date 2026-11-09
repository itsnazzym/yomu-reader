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

function applyImageBlurPatch(projectRoot) {
    const packageRoot = path.dirname(require.resolve("expo-image/package.json", { paths: [projectRoot] }));
    const sourceRoot = path.join(packageRoot, "android/src/main/java/expo/modules/image");
    const wrapper = path.join(sourceRoot, "ExpoImageViewWrapper.kt");
    fs.writeFileSync(wrapper, patchImageWrapper(fs.readFileSync(wrapper, "utf8")));
    fs.copyFileSync(path.join(projectRoot, "native/YomuBlurTransformation.java"), path.join(sourceRoot, "YomuBlurTransformation.java"));
}

module.exports = function withSafeImageBlur(config) {
  return withDangerousMod(config, ["android", async (result) => {
    applyImageBlurPatch(result.modRequest.projectRoot);
    return result;
  }]);
};
module.exports.patchImageWrapper = patchImageWrapper;
module.exports.applyImageBlurPatch = applyImageBlurPatch;

// The shared Android artifact does not include node_modules. Reapply after
// npm ci in each build job, including jobs that reuse an existing prebuild.
if (require.main === module) applyImageBlurPatch(process.cwd());

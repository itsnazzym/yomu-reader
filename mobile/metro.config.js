const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.resolver.sourceExts = Array.from(
  new Set([...config.resolver.sourceExts, "mjs", "cjs"])
);

// Metro watchait les dossiers Gradle (`android/build`, `.cxx`) pendant le
// bundle release → flood ENOENT. On les exclut du resolver et du watcher.
const nativeBuildNoise = [
  /[/\\]android[/\\]build[/\\].*/,
  /[/\\]android[/\\]\.cxx[/\\].*/,
  /[/\\]android[/\\]\.gradle[/\\].*/,
  /[/\\]ios[/\\]build[/\\].*/,
  /[/\\]ios[/\\]Pods[/\\].*/,
];
const existingBlock = config.resolver.blockList;
config.resolver.blockList = [
  ...(existingBlock
    ? Array.isArray(existingBlock)
      ? existingBlock
      : [existingBlock]
    : []),
  ...nativeBuildNoise,
];
if (config.watcher) {
  const existingUnstable = config.watcher.additionalExts;
  config.watcher.healthCheck = { enabled: false };
  config.watcher.watchman = { deferStates: ["hg.update"] };
  if (existingUnstable) {
    config.watcher.additionalExts = existingUnstable;
  }
}

// `react-native-pager-view` imports a native-only module that Metro refuses to
// bundle on web. It is only used by the reader screen (read.tsx), which is not
// web-ready. Stub it on web only so the rest of the app — including the
// recommendations screen — can bundle under `expo start --web`. Native builds
// are unaffected (the redirect only applies when platform === "web").
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === "web" && moduleName === "react-native-pager-view") {
    return {
      type: "sourceFile",
      filePath: path.resolve(__dirname, "web-shims", "react-native-pager-view.js"),
    };
  }

  if (moduleName === "@tabler/icons-react-native") {
    return {
      type: "sourceFile",
      filePath: path.resolve(__dirname, "components", "ui", "TablerIcons.tsx"),
    };
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;

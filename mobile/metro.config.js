const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

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
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;

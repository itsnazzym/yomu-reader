module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      function ({ types: t }) {
        return {
          visitor: {
            ImportDeclaration(path) {
              if (path.node.source.value === "@tabler/icons-react-native") {
                path.node.source.value = "@/components/ui/TablerIcons";
              }
            },
          },
        };
      },
      "react-native-reanimated/plugin",
    ],
  };
};

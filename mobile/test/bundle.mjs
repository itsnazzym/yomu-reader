import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));

await build({
  entryPoints: [path.join(here, "engine.test.ts")],
  bundle: true,
  platform: "node",
  format: "cjs",
  outfile: path.join(here, "engine.test.cjs"),
  tsconfig: path.join(here, "..", "tsconfig.json"),
  logLevel: "info",
  plugins: [
    {
      name: "mock-rn-and-nhentai",
      setup(b) {
        // Les `--alias` CLI ne suffisent pas pour les imports `@/` (les `paths`
        // du tsconfig sont appliqués en premier), donc on intercepte ici.
        b.onResolve(
          { filter: /^@react-native-async-storage\/async-storage$/ },
          () => ({ path: path.join(here, "mockAsyncStorage.ts") })
        );
        b.onResolve(
          { filter: /^expo-secure-store$/ },
          () => ({ path: path.join(here, "mockSecureStore.ts") })
        );
        b.onResolve(
          { filter: /^react-native$/ },
          () => ({ path: path.join(here, "mockReactNative.ts") })
        );
        b.onResolve(
          { filter: /^@\/lib\/api\/nhentai$/ },
          () => ({ path: path.join(here, "mockNhentai.ts") })
        );
      },
    },
  ],
});

/**
 * Sonde live des sources : search -> getGallery -> vérif des URLs de pages.
 * Bundle via test/bundle.mjs (mocks RN) puis exécuter le .cjs produit.
 * Usage : node scripts/probe.mjs
 */
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { execFileSync } from "node:child_process";

const here = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(here, "..");

const outfile = process.env.TEMP
  ? path.join(process.env.TEMP, "probe-sources.cjs")
  : path.join(here, "probe-sources.cjs");

await build({
  entryPoints: [path.join(here, "probe-sources.ts")],
  bundle: true,
  platform: "node",
  format: "cjs",
  outfile,
  tsconfig: path.join(mobileRoot, "tsconfig.json"),
  logLevel: "error",
  plugins: [
    {
      name: "mock-rn-and-nhentai",
      setup(b) {
        b.onResolve(
          { filter: /^react-native$/ },
          () => ({ path: path.join(here, "..", "test", "mockReactNative.ts") })
        );
        b.onResolve(
          { filter: /^@react-native-async-storage\/async-storage$/ },
          () => ({ path: path.join(here, "..", "test", "mockAsyncStorage.ts") })
        );
        b.onResolve(
          { filter: /^expo-secure-store$/ },
          () => ({ path: path.join(here, "..", "test", "mockSecureStore.ts") })
        );
      },
    },
  ],
});

execFileSync("node", [outfile, ...process.argv.slice(2)], { stdio: "inherit" });

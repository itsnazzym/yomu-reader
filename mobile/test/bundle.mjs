import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));

const testEntries = ["engine.test.ts"];
try {
  const fs = await import("node:fs");
  for (const extra of ["resumable.test.ts", "sourcesHtml.test.ts", "sources.test.ts"]) {
    if (fs.existsSync(path.join(here, extra))) {
      testEntries.push(extra);
    }
  }
} catch {}

for (const entry of testEntries) {
  await build({
    entryPoints: [path.join(here, entry)],
    bundle: true,
    platform: "node",
    format: "cjs",
    outfile: path.join(here, entry.replace(/\.ts$/, ".cjs")),
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
}

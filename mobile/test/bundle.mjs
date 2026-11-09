import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));

const testEntries = ["engine.test.ts", "sessionSecurity.test.ts"];
try {
  const fs = await import("node:fs");
  for (const extra of ["resumable.test.ts", "sourcesHtml.test.ts", "sources.test.ts", "cloudSync.test.ts", "stabilization.test.ts", "uiUx.test.tsx"]) {
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
    outfile: path.join(here, entry.replace(/\.tsx?$/, ".cjs")),
    external: entry === "uiUx.test.tsx" ? ["react", "react-dom/server"] : [],
    tsconfig: path.join(here, "..", "tsconfig.json"),
    logLevel: "info",
    plugins: [
      {
        name: "mock-rn-and-nhentai",
        setup(b) {
          if (entry === "sessionSecurity.test.ts") {
            b.onResolve({ filter: /^(?:@supabase\/supabase-js|expo-web-browser|\.\/googleNative|\.\.\/backupStore)$/ },
              () => ({ path: path.join(here, "mockCloudRuntime.ts") }));
            b.onResolve({ filter: /^react-native-url-polyfill\/auto$/ },
              () => ({ path: path.join(here, "mockReactNative.ts") }));
          }
          // Les `--alias` CLI ne suffisent pas pour les imports `@/` (les `paths`
          // du tsconfig sont appliqués en premier), donc on intercepte ici.
          b.onResolve(
            { filter: /^@react-native-async-storage\/async-storage$/ },
            () => ({ path: path.join(here, "mockAsyncStorage.ts") })
          );
          b.onResolve(
            { filter: /^expo-screen-capture$/ },
            () => ({ path: path.join(here, "mockScreenCapture.ts") })
          );
          b.onResolve(
            { filter: /^expo-secure-store$/ },
            () => ({ path: path.join(here, "mockSecureStore.ts") })
          );
          b.onResolve(
            { filter: /^expo-crypto$/ },
            () => ({ path: path.join(here, "mockExpoCrypto.ts") })
          );
          b.onResolve(
            { filter: /^react-native$/ },
            () => ({ path: path.join(here, entry === "uiUx.test.tsx" ? "mockUiReactNative.ts" : "mockReactNative.ts") })
          );
          // Sous-chemins internes de RN (codegen...) tirés par certaines
          // dépendances transitives (icônes, modules expo).
          b.onResolve(
            { filter: /^react-native\// },
            () => ({ path: path.join(here, "mockReactNative.ts") })
          );
          // Wrapper d'icônes : stub générique (aucun rendu testé ici).
          b.onResolve(
            { filter: /^@tabler\/icons-react-native$/ },
            () => ({ path: path.join(here, "mockTablerIcons.cjs") })
          );
          b.onResolve(
            { filter: /^@\/lib\/api\/nhentai$/ },
            () => ({ path: path.join(here, "mockNhentai.ts") })
          );
          // Les stores notifient le moteur cloud de façon dynamique. Les tests
          // unitaires des stores n'ont pas besoin de charger son client natif.
          b.onResolve(
            { filter: /^\.\/cloudSync$/, namespace: "file" },
            () => ({ path: path.join(here, "mockCloudSync.ts") })
          );
        },
      },
    ],
  });
}

const test = require("node:test");
const assert = require("node:assert/strict");
const { patchMainActivity } = require("../withPrivacyScreenCapture");
const { patchMainApplicationKt } = require("../withAndroidDoh");
const { patchImageWrapper } = require("../withSafeImageBlur");

test("chaque installation réapplique le filtre et Android compile le module corrigé depuis ses sources", () => {
  const pkg = require("../package.json");
  assert.equal(pkg.scripts.postinstall, "node withSafeImageBlur.js");
  assert.ok(pkg.expo.autolinking.android.buildFromSource.includes("expo-image"));
});

test("le flou natif emploie le filtre logiciel et le patch reste idempotent", () => {
  const source = "import jp.wasabeef.glide.transformations.BlurTransformation\ntransform(BlurTransformation(min(it, 25), 4))";
  const patched = patchImageWrapper(source);
  assert.match(patched, /YomuBlurTransformation as BlurTransformation/);
  assert.doesNotMatch(patched, /import jp\.wasabeef/);
  assert.equal(patchImageWrapper(patched), patched);
});

test("une version inconnue du chargeur d'images bloque le patch plutôt que masquer sa perte", () => {
  assert.throws(() => patchImageWrapper("import new.sdk.UnknownBlur"), /revérifié/);
});

test("la fenêtre est protégée avant la création de l'activité et le prebuild reste idempotent", () => {
  const template = "class MainActivity { override fun onCreate(state: Bundle?) { super.onCreate(null) } }";
  const patched = patchMainActivity(template);
  assert.ok(patched.indexOf("FLAG_SECURE") < patched.indexOf("super.onCreate"));
  assert.equal(patchMainActivity(patched), patched);
});

test("le client d'images et fetch utilisent la même politique DNS, sans perdre le loader Expo", () => {
  const source = "package fixture\nclass MainApplication : Application(), ReactApplication {\n  override fun onCreate() {\n    super.onCreate()\n  }\n}";
  const patched = patchMainApplicationKt(source);
  assert.match(patched, /GlideUrlWrapperLoader.Factory\(client\)/);
  assert.match(patched, /installDohImageNetworking\(this\)/);
  assert.equal(patchMainApplicationKt(patched), patched);
});

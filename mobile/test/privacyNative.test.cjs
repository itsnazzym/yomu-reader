const test = require("node:test");
const assert = require("node:assert/strict");
const { patchMainActivity } = require("../withPrivacyScreenCapture");
const { patchMainApplicationKt } = require("../withAndroidDoh");

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

const {
  createRunOncePlugin,
  withAppBuildGradle,
  withMainApplication,
  withGradleProperties,
} = require("@expo/config-plugins");

const DOH_DEPENDENCY =
  'implementation("com.squareup.okhttp3:okhttp-dnsoverhttps:4.9.2")';

const DOH_IMPORTS = [
  "import java.io.IOException",
  "import java.net.InetAddress",
  "import com.facebook.react.modules.network.OkHttpClientFactory",
  "import com.facebook.react.modules.network.OkHttpClientProvider",
  "import okhttp3.Dns",
  "import okhttp3.OkHttpClient",
  "import okhttp3.dnsoverhttps.DnsOverHttps",
  "import okhttp3.HttpUrl.Companion.toHttpUrl",
].join("\n");

const DOH_SUPPORT = `
private class DohFallbackDns(
  private val resolvers: List<Dns>,
  private val systemDns: Dns = Dns.SYSTEM,
) : Dns {
  override fun lookup(hostname: String): List<InetAddress> {
    var lastError: IOException? = null
    for (resolver in resolvers) {
      try {
        val addresses = resolver.lookup(hostname)
        if (addresses.isNotEmpty()) return addresses
      } catch (error: IOException) {
        lastError = error
      }
    }

    return try {
      systemDns.lookup(hostname)
    } catch (error: IOException) {
      lastError?.let { error.addSuppressed(it) }
      throw error
    }
  }
}

private fun createDohNetworkClient(): OkHttpClient {
  // The bootstrap client resolves only the DoH providers. Application traffic
  // uses the DoH resolvers first and falls back to the system resolver if a
  // provider is temporarily unavailable.
  val bootstrapClient = OkHttpClient.Builder().build()
  val dohResolvers = listOf(
    "https://cloudflare-dns.com/dns-query",
    "https://dns.google/dns-query",
  ).map { endpoint ->
    DnsOverHttps.Builder()
      .client(bootstrapClient)
      .url(endpoint.toHttpUrl())
      .post(true)
      .build()
  }

  return OkHttpClientProvider.createClientBuilder()
    .dns(DohFallbackDns(dohResolvers))
    .build()
}
`;

const DOH_INSTALL = `
    OkHttpClientProvider.setOkHttpClientFactory(object : OkHttpClientFactory {
      override fun createNewNetworkModuleClient(): OkHttpClient {
        return createDohNetworkClient()
      }
    })
`;

const FILE_SUPPRESS = '@file:Suppress("DEPRECATION")';
const CLASS_MARKER =
  "class MainApplication : Application(), ReactApplication {";
const ON_CREATE_MARKER = `  override fun onCreate() {
    super.onCreate()
`;

function setGradleProperty(properties, key, value) {
  const existing = properties.find(
    (item) => item.type === "property" && item.key === key
  );
  if (existing) {
    existing.value = value;
  } else {
    properties.push({
      type: "property",
      key,
      value,
    });
  }
}

function applyDohGradleProperties(properties) {
  const next = Array.isArray(properties) ? properties : [];
  setGradleProperty(next, "reactNativeArchitectures", "arm64-v8a");
  setGradleProperty(next, "org.gradle.parallel", "true");
  setGradleProperty(next, "org.gradle.caching", "true");
  setGradleProperty(next, "org.gradle.daemon", "true");
  // configure-on-demand + New Architecture: :app:configureCMake* can run
  // before library codegen creates android/build/generated/source/codegen/jni.
  setGradleProperty(next, "org.gradle.configureondemand", "false");
  setGradleProperty(next, "kotlin.incremental", "true");
  setGradleProperty(
    next,
    "org.gradle.jvmargs",
    "-Xmx4096m -XX:MaxMetaspaceSize=1024m -XX:+UseG1GC"
  );
  setGradleProperty(next, "android.enablePngCrunchInReleaseBuilds", "true");
  return next;
}

function patchMainApplicationKt(contents) {
  if (typeof contents !== "string" || contents.trim() === "") {
    throw new Error("MainApplication.kt vide");
  }

  let source = contents.replace(/\r\n/g, "\n");
  source = source.split(FILE_SUPPRESS).join("").replace(/\n{3,}/g, "\n\n");
  source = `${FILE_SUPPRESS}\n${source.replace(/^\n+/, "")}`;

  if (!source.includes("DohFallbackDns")) {
    if (!source.includes(CLASS_MARKER)) {
      throw new Error("MainApplication Android utilise un format inattendu");
    }

    const lines = source.split("\n");
    const existing = new Set(lines.map((line) => line.trim()));
    const importsToAdd = DOH_IMPORTS.split("\n").filter(
      (line) => line.length > 0 && !existing.has(line)
    );

    let lastImportIndex = -1;
    let packageIndex = -1;
    for (let i = 0; i < lines.length; i += 1) {
      const trimmed = lines[i].trim();
      if (trimmed.startsWith("package ")) {
        packageIndex = i;
      }
      if (trimmed.startsWith("import ")) {
        lastImportIndex = i;
      }
    }
    if (packageIndex < 0) {
      throw new Error("MainApplication.kt sans déclaration package");
    }

    const insertAt = lastImportIndex >= 0 ? lastImportIndex + 1 : packageIndex + 1;
    lines.splice(insertAt, 0, ...importsToAdd, "", DOH_SUPPORT.trim(), "");
    source = lines.join("\n");

    if (!source.includes(ON_CREATE_MARKER)) {
      throw new Error("Impossible de trouver onCreate dans MainApplication.kt");
    }
    if (!source.includes("OkHttpClientProvider.setOkHttpClientFactory")) {
      source = source.replace(ON_CREATE_MARKER, `${ON_CREATE_MARKER}${DOH_INSTALL}`);
    }
  }

  return source;
}

function withAndroidDoh(config) {
  config = withGradleProperties(config, (modConfig) => {
    applyDohGradleProperties(modConfig.modResults);
    return modConfig;
  });

  config = withAppBuildGradle(config, (modConfig) => {
    if (!modConfig.modResults.contents.includes("okhttp-dnsoverhttps")) {
      const marker = "dependencies {";
      if (!modConfig.modResults.contents.includes(marker)) {
        throw new Error("Impossible de trouver le bloc dependencies Android");
      }
      modConfig.modResults.contents = modConfig.modResults.contents.replace(
        marker,
        `${marker}\n    ${DOH_DEPENDENCY}`
      );
    }

    if (!modConfig.modResults.contents.includes('abiFilters "arm64-v8a"')) {
      // SDK 54 : versionName est injecté depuis app.json (plus de "1.0.0" en dur).
      const defaultConfMarker = 'versionName "1.1.0"';
      if (modConfig.modResults.contents.includes(defaultConfMarker)) {
        modConfig.modResults.contents = modConfig.modResults.contents.replace(
          defaultConfMarker,
          `${defaultConfMarker}\n        ndk {\n            abiFilters "arm64-v8a"\n        }`
        );
      }
    }

    return modConfig;
  });

  return withMainApplication(config, (modConfig) => {
    modConfig.modResults.contents = patchMainApplicationKt(
      modConfig.modResults.contents
    );
    return modConfig;
  });
}

const plugin = createRunOncePlugin(withAndroidDoh, "with-android-doh", "1.0.2");
plugin.patchMainApplicationKt = patchMainApplicationKt;
plugin.applyDohGradleProperties = applyDohGradleProperties;
module.exports = plugin;

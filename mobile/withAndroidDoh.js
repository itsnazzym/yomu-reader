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

function withAndroidDoh(config) {
  // 1. Configure gradle.properties for arm64-v8a target and high-speed build
  config = withGradleProperties(config, (modConfig) => {
    setGradleProperty(modConfig.modResults, "reactNativeArchitectures", "arm64-v8a");
    setGradleProperty(modConfig.modResults, "org.gradle.parallel", "true");
    setGradleProperty(modConfig.modResults, "org.gradle.caching", "true");
    setGradleProperty(modConfig.modResults, "org.gradle.daemon", "true");
    setGradleProperty(modConfig.modResults, "org.gradle.configureondemand", "true");
    setGradleProperty(modConfig.modResults, "kotlin.incremental", "true");
    setGradleProperty(
      modConfig.modResults,
      "org.gradle.jvmargs",
      "-Xmx4096m -XX:MaxMetaspaceSize=1024m -XX:+UseG1GC"
    );
    setGradleProperty(modConfig.modResults, "android.enablePngCrunchInReleaseBuilds", "true");
    return modConfig;
  });

  // 2. Configure app/build.gradle with DoH dependency and NDK ABI filter
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
    if (!modConfig.modResults.contents.includes("@file:Suppress(\"DEPRECATION\")")) {
      modConfig.modResults.contents = modConfig.modResults.contents.replace(
        "package com.nhentaidownlo.mobile\n",
        "package com.nhentaidownlo.mobile\n\n@file:Suppress(\"DEPRECATION\")\n"
      );
    }

    if (modConfig.modResults.contents.includes("DohFallbackDns")) {
      return modConfig;
    }

    // SDK 54 : le template MainApplication.kt n'importe plus SoLoader.
    // On s'ancre sur la déclaration de classe, toujours présente, et on
    // insère les imports juste avant `class MainApplication`.
    const classMarker =
      "class MainApplication : Application(), ReactApplication {";
    if (!modConfig.modResults.contents.includes(classMarker)) {
      throw new Error("MainApplication Android utilise un format inattendu");
    }
    modConfig.modResults.contents = modConfig.modResults.contents.replace(
      classMarker,
      `${DOH_IMPORTS}\n\n${DOH_SUPPORT}\n\n${classMarker}`
    );

    const onCreateMarker = `  override fun onCreate() {
    super.onCreate()
`;
    if (!modConfig.modResults.contents.includes(onCreateMarker)) {
      throw new Error("Impossible de trouver onCreate dans MainApplication.kt");
    }
    modConfig.modResults.contents = modConfig.modResults.contents.replace(
      onCreateMarker,
      `${onCreateMarker}${DOH_INSTALL}`
    );

    return modConfig;
  });
}

module.exports = createRunOncePlugin(withAndroidDoh, "with-android-doh", "1.0.1");

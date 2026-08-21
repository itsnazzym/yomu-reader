const {
  createRunOncePlugin,
  withAppBuildGradle,
  withMainApplication,
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

  return OkHttpClient.Builder()
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

function withAndroidDoh(config) {
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
    return modConfig;
  });

  return withMainApplication(config, (modConfig) => {
    if (modConfig.modResults.contents.includes("DohFallbackDns")) {
      return modConfig;
    }

    const importMarker = "import com.facebook.soloader.SoLoader";
    if (!modConfig.modResults.contents.includes(importMarker)) {
      throw new Error("Impossible de trouver MainApplication.kt");
    }
    modConfig.modResults.contents = modConfig.modResults.contents.replace(
      importMarker,
      `${DOH_IMPORTS}\n${importMarker}`
    );

    const classMarker =
      "class MainApplication : Application(), ReactApplication {";
    if (!modConfig.modResults.contents.includes(classMarker)) {
      throw new Error("MainApplication Android utilise un format inattendu");
    }
    modConfig.modResults.contents = modConfig.modResults.contents.replace(
      classMarker,
      `${DOH_SUPPORT}\n${classMarker}`
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

module.exports = createRunOncePlugin(withAndroidDoh, "with-android-doh", "1.0.0");

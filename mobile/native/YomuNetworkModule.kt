package com.nhentaidownlo.mobile

import android.content.Context
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.*
import com.facebook.react.uimanager.ViewManager
import com.facebook.react.modules.network.OkHttpClientProvider
import java.net.InetAddress
import java.net.UnknownHostException
import java.net.SocketTimeoutException
import java.util.concurrent.TimeUnit
import java.util.concurrent.ThreadPoolExecutor
import java.util.concurrent.SynchronousQueue
import java.util.concurrent.TimeoutException
import java.util.concurrent.ExecutionException
import java.util.concurrent.RejectedExecutionException
import okhttp3.Dns
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.dnsoverhttps.DnsOverHttps
import okhttp3.HttpUrl.Companion.toHttpUrl

/** One policy for fetch and Expo Image; loaded before either client starts. */
object YomuNetworking : Dns {
  private lateinit var preferences: android.content.SharedPreferences
  @Volatile private var resolver: Dns = Dns.SYSTEM
  private var networkClient: OkHttpClient? = null
  private var mode = "system"
  // Android's system DNS is synchronous and cannot always be interrupted by
  // OkHttp cancellation. Bound its wait and the number of resolver workers.
  private val dnsWorkers = ThreadPoolExecutor(0, 4, 30, TimeUnit.SECONDS, SynchronousQueue<Runnable>())

  @Synchronized fun install(context: Context) {
    preferences = context.getSharedPreferences("yomu_network", Context.MODE_PRIVATE)
    mode = preferences.getString("dns_mode", "system") ?: "system"
    resolver = resolverFor(mode)
    val client = OkHttpClientProvider.createClientBuilder()
      .dns(this)
      .connectTimeout(5, TimeUnit.SECONDS)
      .readTimeout(12, TimeUnit.SECONDS)
      .writeTimeout(12, TimeUnit.SECONDS)
      .callTimeout(18, TimeUnit.SECONDS)
      .build()
    networkClient = client
    OkHttpClientProvider.setOkHttpClientFactory { client }
    val registry = com.bumptech.glide.Glide.get(context).registry
    registry.replace(com.bumptech.glide.load.model.GlideUrl::class.java, java.io.InputStream::class.java,
      com.bumptech.glide.integration.okhttp3.OkHttpUrlLoader.Factory(client))
    registry.prepend(expo.modules.image.okhttp.GlideUrlWrapper::class.java, java.io.InputStream::class.java,
      expo.modules.image.okhttp.GlideUrlWrapperLoader.Factory(client))
  }

  private fun resolverFor(value: String): Dns {
    if (value == "system") return Dns.SYSTEM
    val (url, addresses) = when (value) {
      "cloudflare" -> "https://cloudflare-dns.com/dns-query" to listOf("1.1.1.1", "1.0.0.1", "2606:4700:4700::1111")
      "google" -> "https://dns.google/dns-query" to listOf("8.8.8.8", "8.8.4.4", "2001:4860:4860::8888")
      "adguard" -> "https://dns.adguard-dns.com/dns-query" to listOf("94.140.14.14", "94.140.15.15", "2a10:50c0::ad1:ff")
      else -> throw IllegalArgumentException("DNS inconnu")
    }
    // A complete deadline, including A/AAAA and retries, rather than one
    // connection timeout per IP. No silent fallback to another provider.
    val bootstrap = OkHttpClient.Builder()
      .callTimeout(3, TimeUnit.SECONDS)
      .connectTimeout(2, TimeUnit.SECONDS)
      .readTimeout(2, TimeUnit.SECONDS)
      .build()
    return DnsOverHttps.Builder().client(bootstrap).url(url.toHttpUrl())
      .bootstrapDnsHosts(addresses.map { InetAddress.getByName(it) })
      .post(true).build()
  }

  override fun lookup(hostname: String): List<InetAddress> {
    val selected = resolver
    val task = try { dnsWorkers.submit<List<InetAddress>> { selected.lookup(hostname) } }
    catch (error: RejectedExecutionException) { throw UnknownHostException("DNS occupé") }
    try {
      return task.get(4, TimeUnit.SECONDS)
    } catch (error: TimeoutException) {
      task.cancel(true)
      throw UnknownHostException("Délai DNS dépassé")
    } catch (error: ExecutionException) {
      throw UnknownHostException("Échec DNS").apply { initCause(error.cause) }
    } catch (error: InterruptedException) {
      task.cancel(true)
      Thread.currentThread().interrupt()
      throw UnknownHostException("DNS annulé")
    }
  }

  @Synchronized fun getMode(): String = mode

  @Synchronized fun setMode(value: String) {
    val next = resolverFor(value)
    if (!preferences.edit().putString("dns_mode", value).commit()) {
      throw IllegalStateException("Impossible d'enregistrer le DNS")
    }
    resolver = next
    mode = value
    // New requests must not reuse a connection established with the old DNS.
    networkClient?.connectionPool?.evictAll()
  }

  fun diagnose(): WritableArray {
    val results = Arguments.createArray()
    val client = networkClient!!.newBuilder().callTimeout(6, TimeUnit.SECONDS).build()
    for (host in listOf("e-hentai.org", "api.e-hentai.org", "nhentai.net")) {
      val result = Arguments.createMap()
      result.putString("host", host)
      val started = System.nanoTime()
      try {
        client.newCall(Request.Builder().url("https://$host/").build()).execute().use {
          result.putString("result", "HTTP ${it.code}")
        }
      } catch (error: Exception) {
        val cause = generateSequence<Throwable>(error) { it.cause }.take(8).toList()
        result.putString("result", when {
          cause.any { it is UnknownHostException } -> "Échec DNS"
          cause.any { it is javax.net.ssl.SSLException } -> "Échec TLS"
          cause.any { it is SocketTimeoutException || it is java.io.InterruptedIOException } -> "Délai dépassé"
          else -> "Connexion impossible"
        })
      }
      result.putDouble("elapsedMs", (System.nanoTime() - started) / 1_000_000.0)
      results.pushMap(result)
    }
    return results
  }
}

class YomuNetworkModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  override fun getName() = "YomuNetwork"
  @ReactMethod fun getDnsMode(promise: Promise) { promise.resolve(YomuNetworking.getMode()) }
  @ReactMethod fun setDnsMode(mode: String, promise: Promise) {
    try { YomuNetworking.setMode(mode); promise.resolve(mode) }
    catch (error: Exception) { promise.reject("DNS_SETTING", "Impossible de modifier le DNS.") }
  }
  @ReactMethod fun diagnose(promise: Promise) {
    Thread {
      try { promise.resolve(YomuNetworking.diagnose()) }
      catch (error: Exception) { promise.reject("DNS_DIAGNOSTIC", "Diagnostic réseau impossible.") }
    }.start()
  }
}

class YomuNetworkPackage : ReactPackage {
  override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> = listOf(YomuNetworkModule(context))
  override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}

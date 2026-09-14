/**
 * Generates the tiny in-tree Android notification module during prebuild.
 * Keeping this here (rather than committing android/) makes app.json the
 * source of truth for a clean Expo regeneration.
 */
const fs = require("fs");
const path = require("path");
const { withAndroidManifest, withAndroidStyles, withDangerousMod, withFinalizedMod, AndroidConfig } = require("expo/config-plugins");

const SOURCE = String.raw`package com.nhentaidownlo.mobile

import android.app.*
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.*
import com.facebook.react.uimanager.ViewManager

private const val DOWNLOAD_CHANNEL = "downloads"
private const val DOWNLOAD_NOTIFICATION_ID = 7301
private const val COMPLETED_NOTIFICATION_ID = 7302

class DownloadForegroundService : Service() {
  companion object {
    private const val ACTION_START = "com.yomu.reader.download.START"
    private const val EXTRA_REMAINING = "remaining"
    private const val EXTRA_DOWNLOADED = "downloaded"
    private const val EXTRA_TOTAL = "total"
    private fun intent(context: Context, remaining: Int, downloaded: Int, total: Int) =
      Intent(context, DownloadForegroundService::class.java).apply {
        action = ACTION_START; putExtra(EXTRA_REMAINING, remaining); putExtra(EXTRA_DOWNLOADED, downloaded); putExtra(EXTRA_TOTAL, total)
      }
    fun start(context: Context, remaining: Int, downloaded: Int, total: Int) {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(intent(context, remaining, downloaded, total))
      else context.startService(intent(context, remaining, downloaded, total))
    }
    fun update(context: Context, remaining: Int, downloaded: Int, total: Int) = context.startService(intent(context, remaining, downloaded, total))
    fun stop(context: Context) = context.stopService(Intent(context, DownloadForegroundService::class.java))
    fun completed(context: Context, title: String, ok: Boolean, error: String?) {
      channel(context)
      val text = if (ok) title else title + " — " + (error ?: "erreur")
      val notification = NotificationCompat.Builder(context, DOWNLOAD_CHANNEL).setSmallIcon(R.mipmap.ic_launcher)
        .setContentTitle(if (ok) "Téléchargement terminé" else "Échec du téléchargement").setContentText(text).setAutoCancel(true).build()
      (context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).notify(COMPLETED_NOTIFICATION_ID, notification)
    }
    private fun channel(context: Context) { if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) (context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).createNotificationChannel(NotificationChannel(DOWNLOAD_CHANNEL, "Téléchargements", NotificationManager.IMPORTANCE_LOW)) }
  }
  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val remaining = intent?.getIntExtra(EXTRA_REMAINING, 0) ?: 0; val downloaded = intent?.getIntExtra(EXTRA_DOWNLOADED, 0) ?: 0; val total = intent?.getIntExtra(EXTRA_TOTAL, 0) ?: 0
    channel(this)
    val galleries = if (remaining == 1) "1 galerie restante" else remaining.toString() + " galeries restantes"
    val body = if (total > 0) galleries + " · " + downloaded + "/" + total + " pages" else galleries
    val notification = NotificationCompat.Builder(this, DOWNLOAD_CHANNEL).setSmallIcon(R.mipmap.ic_launcher).setContentTitle("Téléchargement en cours").setContentText(body).setOngoing(true).setOnlyAlertOnce(true).setProgress(maxOf(total, 1), downloaded, total <= 0).build()
    if (intent?.action == ACTION_START) startForeground(DOWNLOAD_NOTIFICATION_ID, notification) else (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).notify(DOWNLOAD_NOTIFICATION_ID, notification)
    return START_NOT_STICKY
  }
  override fun onBind(intent: Intent?): IBinder? = null
  override fun onDestroy() { stopForeground(STOP_FOREGROUND_REMOVE); super.onDestroy() }
}

class DownloadNotificationModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  override fun getName() = "YomuDownloadNotification"
  private fun value(map: ReadableMap, key: String) = map.getInt(key)
  @ReactMethod fun start(progress: ReadableMap, promise: Promise) = invoke(progress, promise, true)
  @ReactMethod fun update(progress: ReadableMap, promise: Promise) = invoke(progress, promise, false)
  @ReactMethod fun stop(promise: Promise) { try { DownloadForegroundService.stop(context); promise.resolve(null) } catch (e: Exception) { promise.reject("DOWNLOAD_NOTIFICATION", e) } }
  @ReactMethod fun notifyCompleted(title: String, ok: Boolean, error: String?, promise: Promise) { try { DownloadForegroundService.completed(context, title, ok, error); promise.resolve(null) } catch (e: Exception) { promise.reject("DOWNLOAD_NOTIFICATION", e) } }
  private fun invoke(progress: ReadableMap, promise: Promise, first: Boolean) { try { val remaining = value(progress, "remainingGalleries"); val downloaded = value(progress, "downloadedPages"); val total = value(progress, "totalPages"); if (first) DownloadForegroundService.start(context, remaining, downloaded, total) else DownloadForegroundService.update(context, remaining, downloaded, total); promise.resolve(null) } catch (e: Exception) { promise.reject("DOWNLOAD_NOTIFICATION", e) } }
}
class DownloadNotificationPackage : ReactPackage {
  override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> = listOf(DownloadNotificationModule(context))
  override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
`;

module.exports = function withDownloadForegroundService(config) {
  config = withAndroidManifest(config, (next) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(next.modResults);
    const forbidden = new Set([
      "android.permission.READ_EXTERNAL_STORAGE",
      "android.permission.WRITE_EXTERNAL_STORAGE",
      "android.permission.RECORD_AUDIO",
      "android.permission.SYSTEM_ALERT_WINDOW",
      "android.permission.SCHEDULE_EXACT_ALARM",
      "android.permission.ACCESS_NOTIFICATION_POLICY",
    ]);
    next.modResults.manifest["uses-permission"] = (next.modResults.manifest["uses-permission"] || [])
      .filter((permission) => !forbidden.has(permission.$?.["android:name"]));
    app.$["android:allowBackup"] = "false";
    for (const activity of app.activity || []) {
      for (const filter of activity["intent-filter"] || []) {
        if (filter.$) delete filter.$["data-generated"];
      }
    }
    const services = app.service || [];
    if (!services.some((service) => service.$?.["android:name"] === ".DownloadForegroundService")) {
      services.push({ $: { "android:name": ".DownloadForegroundService", "android:exported": "false", "android:foregroundServiceType": "dataSync" } });
      app.service = services;
    }
    return next;
  });
  config = withAndroidStyles(config, (next) => {
    const styles = next.modResults?.resources?.style || [];
    for (const style of styles) {
      if (style.$?.name !== "Theme.App.SplashScreen") continue;
      style.item = (style.item || []).filter(
        (item) => item.$?.name !== "android:windowSplashScreenBehavior"
      );
    }
    return next;
  });
  config = withDangerousMod(config, ["android", async (next) => {
    const packageDir = path.join(next.modRequest.platformProjectRoot, "app", "src", "main", "java", "com", "nhentaidownlo", "mobile");
    fs.mkdirSync(packageDir, { recursive: true });
    // Remove files generated by the pre-2.0.1 prototype so regeneration does
    // not leave duplicate Kotlin classes beside the single generated module.
    for (const stale of ["DownloadForegroundService.kt", "DownloadNotificationPackage.kt"]) {
      fs.rmSync(path.join(packageDir, stale), { force: true });
    }
    fs.writeFileSync(path.join(packageDir, "DownloadNotificationModule.kt"), SOURCE);
    const applicationPath = path.join(packageDir, "MainApplication.kt");
    if (fs.existsSync(applicationPath)) {
      const application = fs.readFileSync(applicationPath, "utf8");
      if (!application.includes("add(DownloadNotificationPackage())")) {
        fs.writeFileSync(
          applicationPath,
          application.replace(
            "PackageList(this).packages.apply {",
            "PackageList(this).packages.apply {\n              add(DownloadNotificationPackage())"
          ),
          "utf8"
        );
      }
    }
    const valuesDir = path.join(next.modRequest.platformProjectRoot, "app", "src", "main", "res", "values");
    const stylesPath = path.join(valuesDir, "styles.xml");
    if (fs.existsSync(stylesPath)) {
      fs.writeFileSync(stylesPath, fs.readFileSync(stylesPath, "utf8").replace(/^\s*<item name="android:windowSplashScreenBehavior">.*<\/item>\s*\r?\n/m, ""), "utf8");
      const valuesV33 = path.join(next.modRequest.platformProjectRoot, "app", "src", "main", "res", "values-v33");
      fs.mkdirSync(valuesV33, { recursive: true });
      fs.writeFileSync(path.join(valuesV33, "styles.xml"), `<resources>\n  <style name="Theme.App.SplashScreen" parent="Theme.SplashScreen">\n    <item name="windowSplashScreenBackground">@color/splashscreen_background</item>\n    <item name="windowSplashScreenAnimatedIcon">@drawable/splashscreen_logo</item>\n    <item name="postSplashScreenTheme">@style/AppTheme</item>\n    <item name="android:windowSplashScreenBehavior">icon_preferred</item>\n  </style>\n</resources>\n`, "utf8");
    }
    return next;
  }]);
  // Expo's splash plugin writes after the normal styles mod. Finalized mods
  // run last, so the API-33 item is reliably moved out of values/.
  return withFinalizedMod(config, ["android", async (next) => {
    const root = next.modRequest.platformProjectRoot;
    const stylesPath = path.join(root, "app", "src", "main", "res", "values", "styles.xml");
    if (fs.existsSync(stylesPath)) {
      fs.writeFileSync(stylesPath, fs.readFileSync(stylesPath, "utf8").replace(/^\s*<item name="android:windowSplashScreenBehavior">.*<\/item>\s*\r?\n/m, ""), "utf8");
    }
    return next;
  }]);
};

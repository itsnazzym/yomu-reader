const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const {
  patchMainApplicationKt,
  applyDohGradleProperties,
} = require(path.join(__dirname, "..", "withAndroidDoh.js"));

const EXPO_54_MAIN_APPLICATION = `package com.nhentaidownlo.mobile

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // Packages that cannot be autolinked yet can be added manually here, for example:
          // add(MyReactNativePackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
  }
}
`;

function assertValidKotlinHeader(source, label) {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  let phase = "file-ann";
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (
      line === "" ||
      line.startsWith("//") ||
      line.startsWith("/*") ||
      line.startsWith("*")
    ) {
      continue;
    }
    if (line.startsWith("@file:")) {
      assert.equal(
        phase,
        "file-ann",
        `${label}: file annotation after ${phase} at line ${i + 1}: ${line}`
      );
      continue;
    }
    if (line.startsWith("package ")) {
      assert.ok(
        phase === "file-ann" || phase === "package",
        `${label}: package in phase ${phase} at line ${i + 1}`
      );
      phase = "imports";
      continue;
    }
    if (line.startsWith("import ")) {
      assert.equal(
        phase,
        "imports",
        `${label}: import after ${phase} at line ${i + 1}: ${line}`
      );
      continue;
    }
    phase = "body";
    break;
  }
}

test("patchMainApplicationKt keeps Kotlin imports after package on Expo 54 template", () => {
  assert.equal(typeof patchMainApplicationKt, "function");
  const patched = patchMainApplicationKt(EXPO_54_MAIN_APPLICATION);
  assertValidKotlinHeader(patched, "expo54");
  assert.match(patched, /DohFallbackDns/);
  assert.match(patched, /OkHttpClientProvider\.setOkHttpClientFactory/);
  assert.match(patched, /loadReactNative\(this\)/);
});

test("patchMainApplicationKt repairs @file:Suppress inserted after package", () => {
  const broken = `package com.nhentaidownlo.mobile

@file:Suppress("DEPRECATION")
import android.app.Application
import com.facebook.react.ReactApplication

class MainApplication : Application(), ReactApplication {
  override fun onCreate() {
    super.onCreate()
  }
}
`;
  const patched = patchMainApplicationKt(broken);
  assertValidKotlinHeader(patched, "repaired");
  assert.match(patched, /DohFallbackDns/);
});

test("DoH gradle properties disable configure-on-demand for New Architecture codegen", () => {
  assert.equal(typeof applyDohGradleProperties, "function");
  const properties = applyDohGradleProperties([]);
  const configureOnDemand = properties.find(
    (item) => item.type === "property" && item.key === "org.gradle.configureondemand"
  );
  assert.ok(configureOnDemand, "org.gradle.configureondemand must be set");
  assert.equal(configureOnDemand.value, "false");
});

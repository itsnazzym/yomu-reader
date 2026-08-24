#!/usr/bin/env bash
# Shared Gradle entry for CI Android APK jobs (New Architecture safe).
set -euo pipefail

TASK="${1:?Usage: android-gradle-build.sh <assembleRelease|assembleDebug> [architectures]}"
ARCHITECTURES="${2:-}"

cd mobile/android
chmod +x gradlew

GRADLE_COMMON=(--build-cache --no-configure-on-demand)
if [[ -n "${ARCHITECTURES}" ]]; then
  GRADLE_COMMON=(-PreactNativeArchitectures="${ARCHITECTURES}" "${GRADLE_COMMON[@]}")
fi

echo "==> Generating New Architecture codegen (required before CMake)..."
./gradlew generateCodegenArtifactsFromSchema generateCodegenSchemaFromJavaScript \
  "${GRADLE_COMMON[@]}" --no-parallel

echo "==> Running Gradle ${TASK}..."
./gradlew "${TASK}" "${GRADLE_COMMON[@]}" --parallel

#!/usr/bin/env bash
# Fail CI if a release APK is signed with the Android debug certificate.
set -euo pipefail

APK="${1:?Usage: verify-apk-release-signing.sh <path-to.apk>}"

if [[ ! -f "${APK}" ]]; then
  echo "APK introuvable: ${APK}" >&2
  exit 1
fi

echo "==> Vérification signature: ${APK}"
CERT_LOG="$(mktemp)"
trap 'rm -f "${CERT_LOG}"' EXIT

if ! jarsigner -verify -verbose -certs "${APK}" >"${CERT_LOG}" 2>&1; then
  echo "::error::APK non signé ou signature invalide"
  cat "${CERT_LOG}"
  exit 1
fi

grep -E "SHA256:|Owner:|Issuer:" "${CERT_LOG}" || true

if grep -qi "CN=Android Debug" "${CERT_LOG}"; then
  echo "::error::APK signé avec la clé DEBUG — le keystore release n'a pas été appliqué au prebuild"
  exit 1
fi

echo "OK: signature release (pas debug)"

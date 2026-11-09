/**
 * Crash reporting GlitchTip (API compatible Sentry).
 * DSN via EXPO_PUBLIC_GLITCHTIP_DSN — jamais hardcodé.
 */

import * as Sentry from "@sentry/react-native";
import Constants from "expo-constants";
import { redactSecrets } from "./redactSecrets";

function readDsn(): string | undefined {
  const fromEnv =
    typeof process !== "undefined" && process.env?.EXPO_PUBLIC_GLITCHTIP_DSN
      ? process.env.EXPO_PUBLIC_GLITCHTIP_DSN
      : undefined;
  const extra = Constants.expoConfig?.extra as
    | { glitchtipDsn?: string }
    | undefined;
  const dsn = (fromEnv || extra?.glitchtipDsn || "").trim();
  return dsn || undefined;
}

let initialized = false;

export function initGlitchTip(): void {
  if (initialized) return;
  const dsn = readDsn();
  if (!dsn) {
    return;
  }
  try {
    Sentry.init({
      dsn,
      enabled: true,
      tracesSampleRate: 0.01,
      enableAutoSessionTracking: false,
      enableAutoPerformanceTracing: false,
      sendDefaultPii: false,
      beforeSend(event) {
        try {
          const clean = redactSecrets(event) as typeof event;
          clean.user = undefined;
          if (clean.request) {
            clean.request.cookies = undefined;
            clean.request.data = undefined;
          }
          return clean;
        } catch {
          return null;
        }
      },
      beforeBreadcrumb(breadcrumb) {
        try { return redactSecrets(breadcrumb) as typeof breadcrumb; }
        catch { return null; }
      },
    });
    initialized = true;
  } catch (err) {
    console.warn("[glitchtip] init failed:", err);
  }
}

export function isGlitchTipConfigured(): boolean {
  return Boolean(readDsn());
}

export function isGlitchTipActive(): boolean {
  return initialized && isGlitchTipConfigured();
}

/** Envoi officiel GlitchTip : `Sentry.captureException(new Error("Test GlitchTip error!"))`. */
export function sendGlitchTipTestEvent(): { ok: boolean; reason?: string } {
  if (!isGlitchTipConfigured()) {
    return { ok: false, reason: "DSN manquant. Ajoute EXPO_PUBLIC_GLITCHTIP_DSN dans mobile/.env puis rebuild." };
  }
  if (!initialized) {
    initGlitchTip();
  }
  if (!initialized) {
    return { ok: false, reason: "Initialisation GlitchTip échouée." };
  }
  try {
    Sentry.captureException(new Error("Test GlitchTip error!"));
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : "Envoi du test impossible.",
    };
  }
}

export { Sentry };

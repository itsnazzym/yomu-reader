/**
 * Crash reporting GlitchTip (API compatible Sentry).
 * DSN via EXPO_PUBLIC_GLITCHTIP_DSN — jamais hardcodé.
 */

import * as Sentry from "@sentry/react-native";
import Constants from "expo-constants";

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

const SENSITIVE_KEYS = new Set([
  "cookie",
  "authorization",
  "password",
  "token",
  "csrf",
  "session",
]);

function scrubValue(key: string, value: unknown): unknown {
  const lower = key.toLowerCase();
  if (SENSITIVE_KEYS.has(lower) || lower.includes("cookie") || lower.includes("token")) {
    return "[Filtered]";
  }
  if (typeof value === "string") {
    // Titres / IDs galerie dans les messages
    return value
      .replace(/\b(?:nhentai|3hentai|doujins|hitomi):\d+\b/gi, "[gallery]")
      .replace(/\/g\/\d+/gi, "/g/[id]")
      .replace(/gallery[_-]?\d{4,}/gi, "gallery_[id]");
  }
  if (Array.isArray(value)) {
    return value.map((item, idx) => scrubValue(String(idx), item));
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = scrubValue(k, v);
    }
    return out;
  }
  return value;
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
          if (event.message) {
            event.message = String(scrubValue("message", event.message));
          }
          if (event.exception?.values) {
            event.exception.values = event.exception.values.map((item) => ({
              ...item,
              value: item.value
                ? String(scrubValue("value", item.value))
                : item.value,
            }));
          }
          if (event.request) {
            event.request = scrubValue("request", event.request) as typeof event.request;
            if (event.request?.cookies) {
              event.request.cookies = undefined;
            }
            if (event.request?.headers) {
              const headers = { ...event.request.headers };
              for (const key of Object.keys(headers)) {
                if (SENSITIVE_KEYS.has(key.toLowerCase())) {
                  headers[key] = "[Filtered]";
                }
              }
              event.request.headers = headers;
            }
          }
          if (event.extra) {
            event.extra = scrubValue("extra", event.extra) as typeof event.extra;
          }
          if (event.tags) {
            event.tags = scrubValue("tags", event.tags) as typeof event.tags;
          }
        } catch {
          // Ne jamais bloquer l'envoi pour une erreur de scrub.
        }
        return event;
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

/**
 * nhentai API v2 — HTTP Client
 *
 * Auth priority:
 *   1. Bearer access_token (from login/refresh)
 *   2. API key via Authorization: Api-Key <key>
 *
 * Automatic token refresh:
 *   On 401 automatically attempts token refresh with refresh_token and retries once.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

export const NH_HOST = "https://nhentai.net";
export const API_V2_BASE = `${NH_HOST}/api/v2`;

const STATIC_API_KEY: string | undefined =
  process.env.EXPO_PUBLIC_NHENTAI_API_KEY || undefined;

const SECURE_STORAGE_KEY_ACCESS = "auth.v2.access_token";
const SECURE_STORAGE_KEY_REFRESH = "auth.v2.refresh_token";
const ASYNC_STORAGE_KEY_ACCESS = "@auth.v2.access_token";
const ASYNC_STORAGE_KEY_REFRESH = "@auth.v2.refresh_token";
const LEGACY_KEY_ACCESS = "@v2.access_token";
const LEGACY_KEY_REFRESH = "@v2.refresh_token";
const PLAINTEXT_TOKEN_KEYS = [
  ASYNC_STORAGE_KEY_ACCESS,
  ASYNC_STORAGE_KEY_REFRESH,
  LEGACY_KEY_ACCESS,
  LEGACY_KEY_REFRESH,
];
const REQUEST_TIMEOUT_MS = 12_000;
const MAX_RATE_LIMIT_RETRIES = 3;
const MAX_RETRY_AFTER_MS = 5 * 60 * 1000;

let authStorageReadyPromise: Promise<void> | null = null;

export function getAuthStorageReady(): Promise<void> {
  if (!authStorageReadyPromise) {
    authStorageReadyPromise = migrateTokenKeysIfNeeded();
  }
  return authStorageReadyPromise;
}

export async function migrateTokenKeysIfNeeded(): Promise<void> {
  try {
    const plaintext = new Map(await AsyncStorage.multiGet(PLAINTEXT_TOKEN_KEYS));
    const accessVal =
      plaintext.get(ASYNC_STORAGE_KEY_ACCESS) || plaintext.get(LEGACY_KEY_ACCESS);
    const refreshVal =
      plaintext.get(ASYNC_STORAGE_KEY_REFRESH) || plaintext.get(LEGACY_KEY_REFRESH);

    if (Platform.OS === "web") {
      const toSet: [string, string][] = [];
      if (accessVal) toSet.push([ASYNC_STORAGE_KEY_ACCESS, accessVal]);
      if (refreshVal) toSet.push([ASYNC_STORAGE_KEY_REFRESH, refreshVal]);
      if (toSet.length) await AsyncStorage.multiSet(toSet);
      await AsyncStorage.multiRemove([LEGACY_KEY_ACCESS, LEGACY_KEY_REFRESH]);
      return;
    }

    const [secureAccess, secureRefresh] = await Promise.all([
      SecureStore.getItemAsync(SECURE_STORAGE_KEY_ACCESS),
      SecureStore.getItemAsync(SECURE_STORAGE_KEY_REFRESH),
    ]);
    const writes: Promise<void>[] = [];
    if (!secureAccess && accessVal) {
      writes.push(SecureStore.setItemAsync(SECURE_STORAGE_KEY_ACCESS, accessVal));
    }
    if (!secureRefresh && refreshVal) {
      writes.push(SecureStore.setItemAsync(SECURE_STORAGE_KEY_REFRESH, refreshVal));
    }
    await Promise.all(writes);
    await AsyncStorage.multiRemove(PLAINTEXT_TOKEN_KEYS);
  } catch (e) {
    console.warn("[auth] Token key migration failed:", e);
  }
}

export function resolveUrl(path: string): string {
  if (path.startsWith("http")) return path;
  return `${API_V2_BASE}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function storeTokens(
  accessToken: string,
  refreshToken?: string | null
): Promise<void> {
  await getAuthStorageReady();
  if (Platform.OS === "web") {
    const writes: [string, string][] = [[ASYNC_STORAGE_KEY_ACCESS, accessToken]];
    if (refreshToken) writes.push([ASYNC_STORAGE_KEY_REFRESH, refreshToken]);
    await AsyncStorage.multiSet(writes);
    if (!refreshToken) await AsyncStorage.removeItem(ASYNC_STORAGE_KEY_REFRESH);
    return;
  }

  await SecureStore.setItemAsync(SECURE_STORAGE_KEY_ACCESS, accessToken);
  if (refreshToken) {
    await SecureStore.setItemAsync(SECURE_STORAGE_KEY_REFRESH, refreshToken);
  } else {
    await SecureStore.deleteItemAsync(SECURE_STORAGE_KEY_REFRESH);
  }
}

export async function loadAccessToken(): Promise<string | null> {
  await getAuthStorageReady();
  return Platform.OS === "web"
    ? AsyncStorage.getItem(ASYNC_STORAGE_KEY_ACCESS)
    : SecureStore.getItemAsync(SECURE_STORAGE_KEY_ACCESS);
}

export async function loadRefreshToken(): Promise<string | null> {
  await getAuthStorageReady();
  return Platform.OS === "web"
    ? AsyncStorage.getItem(ASYNC_STORAGE_KEY_REFRESH)
    : SecureStore.getItemAsync(SECURE_STORAGE_KEY_REFRESH);
}

export async function clearTokens(): Promise<void> {
  if (Platform.OS === "web") {
    await AsyncStorage.multiRemove(PLAINTEXT_TOKEN_KEYS);
    return;
  }
  await Promise.all([
    SecureStore.deleteItemAsync(SECURE_STORAGE_KEY_ACCESS),
    SecureStore.deleteItemAsync(SECURE_STORAGE_KEY_REFRESH),
    AsyncStorage.multiRemove(PLAINTEXT_TOKEN_KEYS),
  ]);
}

export async function hasSession(): Promise<boolean> {
  const token = await loadAccessToken();
  return !!token;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: unknown,
    public readonly retryAfterMs?: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface RequestOptions {
  public?: boolean;
  apiKey?: string;
  headers?: Record<string, string>;
  skipRefresh?: boolean;
  timeoutMs?: number;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if ((error as Error)?.name === "AbortError") {
      throw new Error(`Délai réseau dépassé (${Math.round(timeoutMs / 1000)} s)`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function buildHeaders(opts: RequestOptions): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...opts.headers,
  };

  if (Platform.OS === "android") {
    headers["User-Agent"] =
      "Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AD1A.240905.004) " +
      "AppleWebKit/537.36 (KHTML, like Gecko) " +
      "Chrome/130.0.6723.102 Mobile Safari/537.36";
  } else if (Platform.OS === "ios") {
    headers["User-Agent"] =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) " +
      "AppleWebKit/605.1.15 (KHTML, like Gecko) " +
      "Version/17.5 Mobile/15E148 Safari/604.1";
  }

  if (!opts.public) {
    if (opts.apiKey) {
      headers["Authorization"] = `Key ${opts.apiKey}`;
    } else {
      const token = await loadAccessToken();
      if (token) {
        if (token.startsWith("nhk_")) {
          headers["Authorization"] = `Key ${token}`;
        } else {
          headers["Authorization"] = `User ${token}`;
        }
      } else if (STATIC_API_KEY) {
        headers["Authorization"] = `Key ${STATIC_API_KEY}`;
      }
    }
  }

  return headers;
}

function parseRetryAfterMs(value: string | null): number | undefined {
  if (!value) return undefined;

  const seconds = Number(value);
  if (Number.isFinite(seconds)) {
    return Math.min(MAX_RETRY_AFTER_MS, Math.max(0, Math.round(seconds * 1000)));
  }

  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return undefined;
  return Math.min(MAX_RETRY_AFTER_MS, Math.max(0, timestamp - Date.now()));
}

function getRateLimitDelayMs(response: Response, attempt: number): number {
  const retryAfterMs = parseRetryAfterMs(response.headers.get("Retry-After"));
  if (retryAfterMs !== undefined) {
    return Math.max(1_000, retryAfterMs);
  }

  return Math.min(30_000, 1_000 * 2 ** Math.max(0, attempt - 1));
}

async function request<T>(
  method: string,
  path: string,
  opts: RequestOptions = {},
  body?: unknown
): Promise<T> {
  const url = resolveUrl(path);
  const headers = await buildHeaders(opts);

  const init: RequestInit = {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  };

  const timeoutMs = opts.timeoutMs ?? REQUEST_TIMEOUT_MS;
  let res = await fetchWithTimeout(url, init, timeoutMs);

  // Respect the server's Retry-After header before retrying rate-limited
  // requests. This matters for the favorites endpoint, whose quota is
  // measured per minute rather than per connection.
  if (res.status === 429) {
    for (let attempt = 1; attempt <= MAX_RATE_LIMIT_RETRIES; attempt++) {
      const waitMs = getRateLimitDelayMs(res, attempt);
      await new Promise((r) => setTimeout(r, waitMs));
      res = await fetchWithTimeout(url, init, timeoutMs);
      if (res.status !== 429) break;
    }
  }

  // Auto-refresh on 401
  if (res.status === 401 && !opts.skipRefresh && !opts.public) {
    const refreshed = await tryRefreshTokens();
    if (refreshed) {
      const retryHeaders = await buildHeaders(opts);
      res = await fetchWithTimeout(url, { ...init, headers: retryHeaders }, timeoutMs);
    }
  }

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    const msg =
      (data as any)?.detail ||
      (data as any)?.message ||
      (data as any)?.error ||
      `HTTP ${res.status}`;
    throw new ApiError(
      msg,
      res.status,
      data,
      res.status === 429
        ? parseRetryAfterMs(res.headers.get("Retry-After"))
        : undefined
    );
  }

  return data as T;
}

let refreshPromise: Promise<boolean> | null = null;

export function shouldClearTokensAfterRefreshError(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;
  if (error.status !== 400 && error.status !== 401) return false;
  const detail = JSON.stringify(error.body ?? error.message).toLowerCase();
  return /refresh|token|revok|invalid|expired/.test(detail);
}

async function tryRefreshTokens(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const refreshToken = await loadRefreshToken();
      if (!refreshToken) return false;

      const result = await request<{ access_token: string; refresh_token: string }>(
        "POST",
        "/auth/refresh",
        { public: true, skipRefresh: true },
        { refresh_token: refreshToken }
      );
      await storeTokens(result.access_token, result.refresh_token);
      return true;
    } catch (error) {
      if (shouldClearTokensAfterRefreshError(error)) {
        await clearTokens();
      }
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export const nhApi = {
  get<T>(path: string, opts?: RequestOptions): Promise<T> {
    return request<T>("GET", path, opts);
  },

  post<T>(path: string, body?: unknown, opts?: RequestOptions): Promise<T> {
    return request<T>("POST", path, opts, body);
  },

  put<T>(path: string, body?: unknown, opts?: RequestOptions): Promise<T> {
    return request<T>("PUT", path, opts, body);
  },

  delete<T>(path: string, opts?: RequestOptions): Promise<T> {
    return request<T>("DELETE", path, opts);
  },
};

export function buildQuery(params: any): string {
  if (!params) return "";
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null && v !== ""
  );
  if (!entries.length) return "";
  return "?" + entries.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join("&");
}

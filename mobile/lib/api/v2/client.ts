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
import { Platform } from "react-native";

export const NH_HOST = "https://nhentai.net";
export const API_V2_BASE = `${NH_HOST}/api/v2`;

const STATIC_API_KEY: string | undefined =
  process.env.EXPO_PUBLIC_NHENTAI_API_KEY || undefined;

// Tokens in AsyncStorage
const STORAGE_KEY_ACCESS = "@auth.v2.access_token";
const STORAGE_KEY_REFRESH = "@auth.v2.refresh_token";
const LEGACY_KEY_ACCESS = "@v2.access_token";
const LEGACY_KEY_REFRESH = "@v2.refresh_token";

let authStorageReadyPromise: Promise<void> | null = null;

export function getAuthStorageReady(): Promise<void> {
  if (!authStorageReadyPromise) {
    authStorageReadyPromise = migrateTokenKeysIfNeeded();
  }
  return authStorageReadyPromise;
}

export async function migrateTokenKeysIfNeeded(): Promise<void> {
  if (typeof window === "undefined" && Platform.OS === "web") return;
  try {
    const [oldAccess, oldRefresh] = await AsyncStorage.multiGet([
      LEGACY_KEY_ACCESS,
      LEGACY_KEY_REFRESH,
    ]);
    const accessVal = oldAccess[1];
    const refreshVal = oldRefresh[1];
    if (accessVal || refreshVal) {
      const toSet: [string, string][] = [];
      if (accessVal) toSet.push([STORAGE_KEY_ACCESS, accessVal]);
      if (refreshVal) toSet.push([STORAGE_KEY_REFRESH, refreshVal]);
      await AsyncStorage.multiSet(toSet);
      await AsyncStorage.multiRemove([LEGACY_KEY_ACCESS, LEGACY_KEY_REFRESH]);
      console.log("[auth] Migrated v2 tokens to @auth. prefix keys");
    }
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
  refreshToken: string
): Promise<void> {
  await AsyncStorage.multiSet([
    [STORAGE_KEY_ACCESS, accessToken],
    [STORAGE_KEY_REFRESH, refreshToken],
  ]);
}

export async function loadAccessToken(): Promise<string | null> {
  return AsyncStorage.getItem(STORAGE_KEY_ACCESS);
}

export async function loadRefreshToken(): Promise<string | null> {
  return AsyncStorage.getItem(STORAGE_KEY_REFRESH);
}

export async function clearTokens(): Promise<void> {
  await AsyncStorage.multiRemove([STORAGE_KEY_ACCESS, STORAGE_KEY_REFRESH]);
}

export async function hasSession(): Promise<boolean> {
  const token = await loadAccessToken();
  return !!token;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: unknown
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

  let res = await fetch(url, init);

  // Auto-retry on 429 (Rate limit)
  if (res.status === 429) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      const waitMs = attempt * 1200;
      await new Promise((r) => setTimeout(r, waitMs));
      res = await fetch(url, init);
      if (res.status !== 429) break;
    }
  }

  // Auto-refresh on 401
  if (res.status === 401 && !opts.skipRefresh && !opts.public) {
    const refreshed = await tryRefreshTokens();
    if (refreshed) {
      const retryHeaders = await buildHeaders(opts);
      res = await fetch(url, { ...init, headers: retryHeaders });
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
    throw new ApiError(msg, res.status, data);
  }

  return data as T;
}

let refreshPromise: Promise<boolean> | null = null;

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
    } catch {
      await clearTokens();
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

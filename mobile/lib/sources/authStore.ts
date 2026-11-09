/**
 * Gestion isolée de l'authentification et des identifiants par source.
 * Chaque source (ehentai, rule34, doujins...) dispose d'un espace de stockage
 * 100 % étanche : la connexion ou déconnexion sur une source ne perturbe jamais les autres.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import type { SourceId } from "./types";

const AUTH_STORAGE_PREFIX = "@source_auth_v1_";

export interface EhentaiCookies {
  ipb_member_id: string;
  ipb_pass_hash: string;
  igneous?: string;
  star?: string;
  sk?: string;
  [key: string]: string | undefined;
}

export interface Rule34Credentials {
  userId: string;
  apiKey: string;
  username?: string;
}

export interface SourceAuthState {
  sourceId: SourceId;
  isLoggedIn: boolean;
  username?: string;
  cookies?: Record<string, string>;
  credentials?: Record<string, string>;
  isExHentaiEnabled?: boolean;
  updatedAt?: number;
}

const memoryState = new Map<SourceId, SourceAuthState>();
const listeners = new Set<(sourceId: SourceId) => void>();

function storageKey(sourceId: SourceId): string {
  return `${AUTH_STORAGE_PREFIX}${sourceId}`;
}

function notify(sourceId: SourceId): void {
  for (const listener of listeners) {
    try {
      listener(sourceId);
    } catch {}
  }
}

/**
 * Parse une chaîne de cookies bruts (ex: "ipb_member_id=123; ipb_pass_hash=abc; igneous=xyz")
 */
export function parseCookieString(raw: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!raw || typeof raw !== "string") return cookies;

  const parts = raw.split(";");
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx <= 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (key && val) {
      cookies[key] = val;
    }
  }
  return cookies;
}

/** Formate un dictionnaire de cookies en en-tête Cookie HTTP. */
export function formatCookieHeader(cookies?: Record<string, string>): string {
  if (!cookies || typeof cookies !== "object") return "";
  return Object.entries(cookies)
    .filter(([k, v]) => Boolean(k) && typeof v === "string" && v.length > 0)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

/** Récupère l'état d'authentification pour une source spécifique. */
export async function getSourceAuth(sourceId: SourceId): Promise<SourceAuthState> {
  const inMemory = memoryState.get(sourceId);
  if (inMemory) return inMemory;

  try {
    const raw = await AsyncStorage.getItem(storageKey(sourceId));
    if (raw) {
      const parsed = JSON.parse(raw) as SourceAuthState;
      const valid: SourceAuthState = {
        sourceId,
        isLoggedIn: Boolean(parsed.isLoggedIn),
        username: parsed.username || undefined,
        cookies: parsed.cookies || undefined,
        credentials: parsed.credentials || undefined,
        isExHentaiEnabled: Boolean(parsed.isExHentaiEnabled),
        updatedAt: parsed.updatedAt || Date.now(),
      };
      memoryState.set(sourceId, valid);
      return valid;
    }
  } catch {}

  const defaultState: SourceAuthState = {
    sourceId,
    isLoggedIn: false,
  };
  memoryState.set(sourceId, defaultState);
  return defaultState;
}

/** Sauvegarde l'état d'authentification pour une source spécifique. */
export async function saveSourceAuth(
  sourceId: SourceId,
  patch: Partial<SourceAuthState>
): Promise<SourceAuthState> {
  const current = await getSourceAuth(sourceId);
  const next: SourceAuthState = {
    ...current,
    ...patch,
    sourceId,
    updatedAt: Date.now(),
  };

  memoryState.set(sourceId, next);
  try {
    await AsyncStorage.setItem(storageKey(sourceId), JSON.stringify(next));
  } catch {}

  notify(sourceId);
  return next;
}

/** Supprime l'authentification d'une source spécifique de manière isolée. */
export async function clearSourceAuth(sourceId: SourceId): Promise<void> {
  const cleanState: SourceAuthState = {
    sourceId,
    isLoggedIn: false,
    updatedAt: Date.now(),
  };

  memoryState.set(sourceId, cleanState);
  try {
    await AsyncStorage.removeItem(storageKey(sourceId));
  } catch {}

  notify(sourceId);
}

/** Abonnement aux changements d'authentification d'une source. */
export function subscribeSourceAuth(
  sourceId: SourceId,
  listener: (state: SourceAuthState) => void
): () => void {
  const wrapper = (updatedSourceId: SourceId) => {
    if (updatedSourceId === sourceId) {
      void getSourceAuth(sourceId).then(listener);
    }
  };
  listeners.add(wrapper);
  return () => {
    listeners.delete(wrapper);
  };
}

/** Hook React pour observer l'état d'authentification d'une source. */
export function useSourceAuth(sourceId: SourceId): SourceAuthState {
  const [auth, setAuth] = useState<SourceAuthState>(() => {
    return memoryState.get(sourceId) || { sourceId, isLoggedIn: false };
  });

  useEffect(() => {
    let active = true;
    void getSourceAuth(sourceId).then((initial) => {
      if (active) setAuth(initial);
    });

    const unsubscribe = subscribeSourceAuth(sourceId, (updated) => {
      if (active) setAuth(updated);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [sourceId]);

  return auth;
}

/**
 * Connexion à E-Hentai / ExHentai via importation de cookies.
 * Vérifie la présence des cookies obligatoires ipb_member_id et ipb_pass_hash.
 */
export async function loginEhentaiWithCookies(
  cookiesInput: string | EhentaiCookies,
  enableExHentai = true
): Promise<SourceAuthState> {
  const cookies =
    typeof cookiesInput === "string"
      ? (parseCookieString(cookiesInput) as EhentaiCookies)
      : cookiesInput;

  const memberId = cookies.ipb_member_id?.trim();
  const passHash = cookies.ipb_pass_hash?.trim();

  if (!memberId || !passHash) {
    throw new Error(
      "Les cookies 'ipb_member_id' et 'ipb_pass_hash' sont obligatoires pour la connexion E-Hentai."
    );
  }

  const cleanCookies: Record<string, string> = {
    ipb_member_id: memberId,
    ipb_pass_hash: passHash,
  };

  if (cookies.igneous && cookies.igneous.trim() && cookies.igneous !== "mystery") {
    cleanCookies.igneous = cookies.igneous.trim();
  }
  if (cookies.star && cookies.star.trim()) {
    cleanCookies.star = cookies.star.trim();
  }
  if (cookies.sk && cookies.sk.trim()) {
    cleanCookies.sk = cookies.sk.trim();
  }

  const hasPandaCookie = Boolean(cleanCookies.igneous && cleanCookies.igneous !== "mystery");

  return await saveSourceAuth("ehentai", {
    isLoggedIn: true,
    username: `Membre #${memberId}`,
    cookies: cleanCookies,
    isExHentaiEnabled: enableExHentai && hasPandaCookie,
  });
}

/**
 * Connexion à E-Hentai via identifiants forum IP.Board (forums.e-hentai.org).
 */
export async function loginEhentaiWithCredentials(
  username: string,
  password: string
): Promise<SourceAuthState> {
  if (!username.trim() || !password) {
    throw new Error("Nom d'utilisateur et mot de passe requis.");
  }

  const formBody = new URLSearchParams();
  formBody.append("UserName", username.trim());
  formBody.append("PassWord", password);
  formBody.append("CookieDate", "1");

  const response = await fetch("https://forums.e-hentai.org/index.php?act=Login&CODE=01", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Referer: "https://forums.e-hentai.org/index.php?act=Login&CODE=00",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
    },
    body: formBody.toString(),
  });

  const cookies: Record<string, string> = {};

  // Extraction des Set-Cookie via l'API fetch (compatible Node.js et browsers/React Native)
  const setCookieHeader = response.headers.get("set-cookie");
  if (setCookieHeader) {
    const rawPairs = setCookieHeader.split(/,\s*(?=[a-zA-Z0-9_-]+=)/);
    for (const pair of rawPairs) {
      const match = pair.match(/^\s*([a-zA-Z0-9_-]+)=([^;]+)/);
      if (match) {
        cookies[match[1]] = match[2];
      }
    }
  }

  const memberId = cookies.ipb_member_id;
  const passHash = cookies.ipb_pass_hash;

  if (!memberId || !passHash) {
    // Si les en-têtes directs ne sont pas accessibles (CORS / web), on teste le corps HTML
    const html = await response.text().catch(() => "");
    if (html.includes("You are now logged in") || html.includes("Thanks,")) {
      // Connexion réussie mais cookies masqués par le runtime
      return await saveSourceAuth("ehentai", {
        isLoggedIn: true,
        username: username.trim(),
        cookies: {
          ipb_member_id: "session",
          ipb_pass_hash: "session",
        },
        isExHentaiEnabled: false,
      });
    }
    throw new Error(
      "Échec de la connexion aux forums E-Hentai. Vérifiez vos identifiants ou utilisez l'import de cookies."
    );
  }

  // Tente de récupérer le cookie igneous depuis exhentai.org
  try {
    const exResp = await fetch("https://exhentai.org", {
      headers: {
        Cookie: formatCookieHeader(cookies),
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
      },
    });
    const exSetCookie = exResp.headers.get("set-cookie");
    if (exSetCookie) {
      const igMatch = exSetCookie.match(/igneous=([^;]+)/);
      if (igMatch) {
        cookies.igneous = igMatch[1];
      }
    }
  } catch {}

  return await saveSourceAuth("ehentai", {
    isLoggedIn: true,
    username: username.trim(),
    cookies,
    isExHentaiEnabled: Boolean(cookies.igneous && cookies.igneous !== "mystery"),
  });
}

/**
 * Connexion à Rule34 via User ID et Clé API.
 */
export async function loginRule34(userId: string, apiKey: string): Promise<SourceAuthState> {
  const cleanId = userId.trim();
  const cleanKey = apiKey.trim();

  if (!cleanId || !cleanKey) {
    throw new Error("L'ID utilisateur et la clé API sont requis pour Rule34.");
  }

  // Vérification de la clé via un ping léger sur l'API
  const probeUrl = `https://api.rule34.xxx/index.php?page=dapi&s=post&q=index&json=1&limit=1&user_id=${encodeURIComponent(
    cleanId
  )}&api_key=${encodeURIComponent(cleanKey)}`;

  const response = await fetch(probeUrl, {
    headers: {
      "User-Agent": "YomuReader/2.0.2 (Rule34 Client)",
    },
  });

  if (!response.ok) {
    throw new Error(`Rule34 a répondu avec le statut HTTP ${response.status}`);
  }

  return await saveSourceAuth("rule34", {
    isLoggedIn: true,
    username: `User #${cleanId}`,
    credentials: {
      userId: cleanId,
      apiKey: cleanKey,
    },
  });
}

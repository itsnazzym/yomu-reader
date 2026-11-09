/**
 * Gestion isolée de l'authentification et des identifiants par source.
 * Chaque source (ehentai, rule34, doujins...) dispose d'un espace de stockage
 * 100 % étanche : la connexion ou déconnexion sur une source ne perturbe jamais les autres.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { createSecureSessionStorage } from "../secureSessionStorage";
import { readRule34Response } from "./credentialInput";
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

const secureAuth = createSecureSessionStorage("yomu.sources.v1");
const pendingAuth = new Map<SourceId, Promise<unknown>>();
function enqueueAuth<T>(source: SourceId, task: () => Promise<T>): Promise<T> {
  const work = (pendingAuth.get(source) || Promise.resolve()).catch(() => {}).then(task);
  pendingAuth.set(source, work);
  void work.finally(() => { if (pendingAuth.get(source) === work) pendingAuth.delete(source); }).catch(() => {});
  return work;
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
export function getSourceAuth(sourceId: SourceId): Promise<SourceAuthState> {
  return enqueueAuth(sourceId, () => readSourceAuth(sourceId));
}

async function readSourceAuth(sourceId: SourceId): Promise<SourceAuthState> {
  const inMemory = memoryState.get(sourceId);
  if (inMemory) return inMemory;

  try {
    let raw = await secureAuth.getItem(sourceId);
    if (!raw) {
      raw = await AsyncStorage.getItem(storageKey(sourceId));
      if (raw) {
        // Delete the legacy copy only after its secure write succeeds.
        await secureAuth.setItem(sourceId, raw);
        await AsyncStorage.removeItem(storageKey(sourceId));
      }
    }
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
  } catch {
    throw new Error("Impossible de lire la session sécurisée. Réessayez la connexion.");
  }

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
  return enqueueAuth(sourceId, async () => {
    const current = await readSourceAuth(sourceId);
    const next: SourceAuthState = {
      ...current,
      ...patch,
      sourceId,
      updatedAt: Date.now(),
    };

    await secureAuth.setItem(sourceId, JSON.stringify(next));
    await AsyncStorage.removeItem(storageKey(sourceId));
    memoryState.set(sourceId, next);
    notify(sourceId);
    return next;
  });
}

/** Supprime l'authentification d'une source spécifique de manière isolée. */
export async function clearSourceAuth(sourceId: SourceId): Promise<void> {
  return enqueueAuth(sourceId, async () => {
    const cleanState: SourceAuthState = {
      sourceId,
      isLoggedIn: false,
      updatedAt: Date.now(),
    };

    await secureAuth.removeItem(sourceId);
    await AsyncStorage.removeItem(storageKey(sourceId));
    memoryState.set(sourceId, cleanState);
    notify(sourceId);
  });
}

/** Abonnement aux changements d'authentification d'une source. */
export function subscribeSourceAuth(
  sourceId: SourceId,
  listener: (state: SourceAuthState) => void
): () => void {
  const wrapper = (updatedSourceId: SourceId) => {
    if (updatedSourceId === sourceId) {
      void getSourceAuth(sourceId).then(listener).catch(() => {});
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
    }).catch(() => {});

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

  if (!memberId || !passHash || !/^[1-9]\d*$/.test(memberId) || passHash === "session" || /[;\r\n]/.test(passHash)) {
    throw new Error(
      "Les cookies 'ipb_member_id' et 'ipb_pass_hash' sont obligatoires pour la connexion E-Hentai."
    );
  }

  const cleanCookies: Record<string, string> = {
    ipb_member_id: memberId,
    ipb_pass_hash: passHash,
  };

  if (Object.values(cookies).some(value => value && /[;\r\n]/.test(value))) throw new Error("Format des cookies invalide. Collez uniquement leurs valeurs.");

  if (cookies.igneous && cookies.igneous.trim() && cookies.igneous.trim() !== "mystery") {
    cleanCookies.igneous = cookies.igneous.trim();
  }
  if (cookies.star && cookies.star.trim()) {
    cleanCookies.star = cookies.star.trim();
  }
  if (cookies.sk && cookies.sk.trim()) {
    cleanCookies.sk = cookies.sk.trim();
  }

  const hasPandaCookie = Boolean(cleanCookies.igneous && cleanCookies.igneous !== "mystery");
  if (enableExHentai && !hasPandaCookie) throw new Error("Ajoutez le cookie igneous pour ExHentai, ou choisissez E-Hentai.");

  return await saveSourceAuth("ehentai", {
    isLoggedIn: true,
    username: `Membre #${memberId}`,
    cookies: cleanCookies,
    isExHentaiEnabled: enableExHentai && hasPandaCookie,
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

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(probeUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "YomuReader/2.0.2 (Rule34 Client)",
      },
    });

    await readRule34Response(response);

    return await saveSourceAuth("rule34", {
      isLoggedIn: true,
      username: `User #${cleanId}`,
      credentials: {
        userId: cleanId,
        apiKey: cleanKey,
      },
    });
  } finally { clearTimeout(timer); }
}

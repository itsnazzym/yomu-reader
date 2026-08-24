import AsyncStorage from "@react-native-async-storage/async-storage";
import { useState, useEffect } from "react";
import { createWriteQueue } from "./persistQueue";
import {
  getAuthStorageReady,
  hasSession,
  storeTokens,
  clearTokens,
  ApiError,
} from "./api/v2/client";
import {
  login as v2Login,
  logout as v2Logout,
  refresh as v2Refresh,
} from "./api/v2/auth";
import {
  getMe,
  updateProfile,
} from "./api/v2/user";
import {
  getPowChallenge,
  solvePoW,
} from "./api/v2/config";
import type { PowProgress } from "./api/v2/config";
import { syncOnlineFavoritesFullOnLaunch } from "./onlineFavoritesStartupSync";
import { persistLocalAvatar } from "./avatarPersist";

const ACCOUNT_KEY = "@nhentai_account_session_v1";

export interface UserComment {
  id: string;
  gallery_id: number;
  gallery_title: string;
  gallery_cover?: string;
  post_date: number;
  body: string;
}

export interface UserProfile {
  id?: number;
  username: string;
  email?: string;
  avatar_url?: string;
  joined_at?: string | number;
  num_favorites?: number;
  num_comments?: number;
}

export interface AccountSession {
  isLoggedIn: boolean;
  username?: string;
  credentialType?: "refresh" | "apiKey" | "sessionid";
  lastSync?: string;
  cloudFavoritesCount?: number;
  profile?: UserProfile;
  comments?: UserComment[];
  /** Sandbox file:// avatar; never overwritten by getMe(). */
  localAvatarUri?: string;
}

let sessionState: AccountSession = {
  isLoggedIn: false,
};

const listeners = new Set<() => void>();
const writes = createWriteQueue();

function notify() {
  for (const l of listeners) l();
}

function sanitizeAccountMetadata(value: unknown): AccountSession {
  if (!value || typeof value !== "object") return { isLoggedIn: false };
  const raw = value as Record<string, unknown>;
  return {
    isLoggedIn: Boolean(raw.isLoggedIn),
    username: typeof raw.username === "string" ? raw.username : undefined,
    credentialType:
      raw.credentialType === "refresh" ||
      raw.credentialType === "apiKey" ||
      raw.credentialType === "sessionid"
        ? raw.credentialType
        : undefined,
    lastSync: typeof raw.lastSync === "string" ? raw.lastSync : undefined,
    cloudFavoritesCount:
      typeof raw.cloudFavoritesCount === "number" ? raw.cloudFavoritesCount : undefined,
    profile:
      raw.profile && typeof raw.profile === "object"
        ? (raw.profile as UserProfile)
        : undefined,
    comments: Array.isArray(raw.comments) ? (raw.comments as UserComment[]) : undefined,
    localAvatarUri:
      typeof raw.localAvatarUri === "string" && raw.localAvatarUri.trim() !== ""
        ? raw.localAvatarUri
        : undefined,
  };
}

export async function initAccountSession() {
  await writes.flush();
  try {
    await getAuthStorageReady();
    const raw = await AsyncStorage.getItem(ACCOUNT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const legacyCredential =
        typeof parsed.sessionId === "string" ? parsed.sessionId.trim() : "";
      const legacyType =
        parsed.credentialType === "apiKey" ||
        parsed.credentialType === "sessionid" ||
        parsed.credentialType === "refresh"
          ? parsed.credentialType
          : "refresh";
      if (legacyCredential && !(await hasSession())) {
        try {
          if (legacyType === "refresh") {
            const tokens = await v2Refresh(legacyCredential);
            await storeTokens(tokens.access_token, tokens.refresh_token);
          } else {
            await storeTokens(legacyCredential, null);
          }
        } catch {
          await clearTokens().catch(() => {});
        }
      }
      sessionState = sanitizeAccountMetadata(parsed);
      await writes.enqueue(() => AsyncStorage.setItem(ACCOUNT_KEY, JSON.stringify(sessionState)));
    }
    const isAuthed = await hasSession();
    if (isAuthed) {
      sessionState.isLoggedIn = true;
      try {
        const me = await getMe();
        if (me) {
          sessionState.username = me.username;
          sessionState.profile = {
            id: me.id,
            username: me.username,
            email: me.email,
            avatar_url: me.avatar_url,
            num_favorites: sessionState.cloudFavoritesCount || 0,
          };
        }
      } catch (error) {
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
          await clearTokens().catch(() => {});
          sessionState.isLoggedIn = false;
        }
      }
    } else {
      sessionState.isLoggedIn = false;
    }
    await writes.enqueue(() => AsyncStorage.setItem(ACCOUNT_KEY, JSON.stringify(sessionState)));
    notify();
  } catch {}
}

export function detectCredentialType(
  raw: string
): { credential: string; type: "apiKey" | "refresh" | "sessionid" } {
  const clean = raw.trim();
  if (clean.startsWith("nhk_")) {
    return { credential: clean, type: "apiKey" };
  }
  if (clean.includes("sessionid=")) {
    const match = clean.match(/sessionid=([^;]+)/);
    return { credential: match ? match[1] : clean, type: "sessionid" };
  }
  if (/^[a-f0-9]{32,}$/i.test(clean)) {
    return { credential: clean, type: "refresh" };
  }
  return { credential: clean, type: clean.length > 20 ? "refresh" : "apiKey" };
}

export function getAccountSession(): AccountSession {
  return sessionState;
}

export async function saveAccountSession(data: Partial<AccountSession>) {
  sessionState = sanitizeAccountMetadata({
    ...sessionState,
    ...data,
    isLoggedIn: data.isLoggedIn ?? sessionState.isLoggedIn,
  });
  await writes.enqueue(() => AsyncStorage.setItem(ACCOUNT_KEY, JSON.stringify(sessionState)));
  notify();
}

export async function logoutAccount() {
  try {
    await v2Logout();
  } catch {}
  const keptLocalAvatar = sessionState.localAvatarUri;
  sessionState = {
    isLoggedIn: false,
    localAvatarUri: keptLocalAvatar,
  };
  await writes.enqueue(() => AsyncStorage.setItem(ACCOUNT_KEY, JSON.stringify(sessionState)));
  notify();
}

let syncInProgress = false;

export function isSyncInProgress(): boolean {
  return syncInProgress;
}

export async function syncCloudFavorites(
  report?: (msg: string, current?: number, total?: number) => void
): Promise<{ success: boolean; count: number; error?: string; partial?: boolean }> {
  if (syncInProgress) return { success: false, count: 0, error: "Synchro déjà en cours" };
  syncInProgress = true;
  setSyncProgressState({ active: true, msg: "Synchronisation...", current: 0, total: 0 });

  try {
    const res = await syncOnlineFavoritesFullOnLaunch((msg, cur, tot) => {
      report?.(msg, cur, tot);
      setSyncProgressState({ active: true, msg, current: cur, total: tot });
    });

    if (res.success) {
      const now = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
      await saveAccountSession({
        lastSync: now,
        cloudFavoritesCount: res.count,
      });
      return { success: true, count: res.count };
    } else {
      return {
        success: false,
        count: res.count,
        error: res.error || "Échec de synchronisation",
        partial: res.partial,
      };
    }
  } catch (err: any) {
    return { success: false, count: 0, error: err?.message || "Erreur inconnue" };
  } finally {
    syncInProgress = false;
    setSyncProgressState({ active: false, msg: "", current: 0, total: 0 });
  }
}

export async function loginWithCredentials(
  username: string,
  password: string,
  captchaResponse?: string,
  onProgress?: (msg: string, powProgress?: PowProgress) => void
): Promise<{ success: boolean; error?: string; count?: number }> {
  try {
    onProgress?.("Récupération du défi de sécurité...");
    const pow = await getPowChallenge("login");

    onProgress?.("Résolution du challenge cryptographique (PoW)...");
    const nonce = await solvePoW(pow.challenge, pow.difficulty, (progress) => {
      onProgress?.("Calcul cryptographique...", progress);
    });

    onProgress?.("Authentification officielle nHentai API v2...");
    await v2Login({
      username,
      password,
      pow_challenge: pow.challenge,
      pow_nonce: nonce,
      captcha_response: captchaResponse,
    });

    const me = await getMe();
    if (!me?.username) throw new Error("La session créée n'a pas pu être validée.");
    const profile: UserProfile = {
      id: me.id,
      username: me.username,
      email: me.email,
      avatar_url: me.avatar_url,
    };

    await saveAccountSession({
      username: profile.username || username,
      credentialType: "refresh",
      isLoggedIn: true,
      profile,
    });

    return { success: true };
  } catch (err: any) {
    await clearTokens().catch(() => {});
    console.warn("[account] loginWithCredentials error:", err);
    const msg =
      err instanceof ApiError
        ? String(err.message)
        : err instanceof Error
          ? err.message
          : "Erreur de connexion.";
    return { success: false, error: msg };
  }
}

export async function fetchUserProfile(): Promise<UserProfile | null> {
  try {
    await getAuthStorageReady();
    if (!(await hasSession())) return null;

    const me = await getMe();
    if (me) {
      const profile: UserProfile = {
        id: me.id,
        username: me.username,
        email: me.email,
        avatar_url: me.avatar_url || sessionState.profile?.avatar_url,
        num_favorites: sessionState.cloudFavoritesCount || 0,
      };

      await saveAccountSession({
        profile,
        username: me.username,
        isLoggedIn: true,
      });

      return profile;
    }
    return sessionState.profile || null;
  } catch (err) {
    console.warn("[account] fetchUserProfile failed:", err);
    return sessionState.profile || null;
  }
}

export async function changeUserPassword(
  currentPassword: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await getAuthStorageReady();
    if (!(await hasSession())) {
      return { success: false, error: "Vous devez être connecté." };
    }

    await updateProfile({
      current_password: currentPassword,
      new_password: newPassword,
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Erreur de modification du mot de passe." };
  }
}

export async function updateUserAvatar(
  avatarUrl: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const trimmed = (avatarUrl || "").trim();
    const baseProfile: UserProfile = {
      ...(sessionState.profile || { username: sessionState.username || "User" }),
    };

    if (!trimmed) {
      await saveAccountSession({
        localAvatarUri: undefined,
        profile: {
          ...baseProfile,
          avatar_url: undefined,
        },
      });
      return { success: true };
    }

    if (/^(file|content):/i.test(trimmed)) {
      const sandboxUri = await persistLocalAvatar(trimmed);
      await saveAccountSession({
        localAvatarUri: sandboxUri,
        profile: baseProfile,
      });
      return { success: true };
    }

    if (/^https?:\/\//i.test(trimmed)) {
      const updatedProfile: UserProfile = {
        ...baseProfile,
        avatar_url: trimmed,
      };
      await saveAccountSession({
        localAvatarUri: undefined,
        profile: updatedProfile,
      });

      if (sessionState.isLoggedIn) {
        try {
          await getAuthStorageReady();
          if (await hasSession()) {
            await updateProfile({ avatar_url: trimmed }).catch(() => {});
          }
        } catch {
          // Local preset still applies even if remote sync fails.
        }
      }

      return { success: true };
    }

    return { success: false, error: "URI d'avatar non prise en charge." };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Erreur de mise à jour de l'avatar.";
    return { success: false, error: message };
  }
}

export function useAccount() {
  const [session, setSession] = useState<AccountSession>(sessionState);

  useEffect(() => {
    const update = () => setSession({ ...sessionState });
    listeners.add(update);
    initAccountSession();
    return () => {
      listeners.delete(update);
    };
  }, []);

  return {
    session,
    profile: session.profile,
    comments: session.comments || [],
    isLoggedIn: session.isLoggedIn,
    loginWithCredentials,
    fetchUserProfile,
    changeUserPassword,
    loginWithSession: async (
      credential: string,
      username?: string,
      credentialType: "refresh" | "apiKey" | "sessionid" = "refresh",
    ) => {
      try {
        if (credentialType === "refresh") {
          const tokens = await v2Refresh(credential);
          await storeTokens(tokens.access_token, tokens.refresh_token);
        } else {
          await storeTokens(credential, null);
        }

        const me = await getMe();
        if (!me?.username) {
          throw new Error("Identifiant accepté, mais session non authentifiée.");
        }
        const profile: UserProfile = {
          id: me.id,
          username: me.username,
          email: me.email,
          avatar_url: me.avatar_url,
        };
        await saveAccountSession({
          username: profile.username || username || "Membre nHentai",
          credentialType,
          isLoggedIn: true,
          profile,
        });
        return profile;
      } catch (error) {
        await clearTokens().catch(() => {});
        throw error;
      }
    },
    logout: logoutAccount,
    syncFavorites: syncCloudFavorites,
    updateAvatar: updateUserAvatar,
  };
}

export interface SyncProgressInfo {
  active: boolean;
  msg: string;
  current: number;
  total: number;
}

let syncProgressState: SyncProgressInfo = { active: false, msg: "", current: 0, total: 0 };
const syncProgressListeners = new Set<() => void>();

function setSyncProgressState(state: SyncProgressInfo) {
  syncProgressState = state;
  for (const l of syncProgressListeners) l();
}

export function useSyncProgress(): SyncProgressInfo {
  const [state, setState] = useState<SyncProgressInfo>(syncProgressState);

  useEffect(() => {
    const update = () => setState({ ...syncProgressState });
    syncProgressListeners.add(update);
    return () => {
      syncProgressListeners.delete(update);
    };
  }, []);

  return state;
}

const AUTO_SYNC_INTERVAL_MS = 30 * 60 * 1000;
let autoSyncTimer: ReturnType<typeof setTimeout> | null = null;
let autoSyncInFlight = false;

async function autoSyncCloudFavorites() {
  if (!(await hasSession())) {
    scheduleAutoSync(AUTO_SYNC_INTERVAL_MS);
    return;
  }
  if (autoSyncInFlight || isSyncInProgress()) {
    scheduleAutoSync(5 * 60 * 1000);
    return;
  }
  autoSyncInFlight = true;
  try {
    await syncCloudFavorites();
  } catch {
  } finally {
    autoSyncInFlight = false;
  }
  scheduleAutoSync(AUTO_SYNC_INTERVAL_MS);
}

function scheduleAutoSync(delayMs: number) {
  if (autoSyncTimer) clearTimeout(autoSyncTimer);
  autoSyncTimer = setTimeout(() => {
    autoSyncTimer = null;
    void autoSyncCloudFavorites();
  }, delayMs);
}

export function startAutoSync() {
  if (autoSyncTimer) return;
  void autoSyncCloudFavorites();
}

initAccountSession().then(() => startAutoSync());

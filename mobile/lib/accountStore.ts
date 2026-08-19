import AsyncStorage from "@react-native-async-storage/async-storage";
import { useState, useEffect } from "react";
import {
  getAuthStorageReady,
  hasSession,
  loadAccessToken,
  loadRefreshToken,
  storeTokens,
  clearTokens,
  ApiError,
} from "./api/v2/client";
import {
  login as v2Login,
  logout as v2Logout,
} from "./api/v2/auth";
import {
  getMe,
  updateProfile,
} from "./api/v2/user";
import {
  getPowChallenge,
  solvePoW,
} from "./api/v2/config";
import { syncOnlineFavoritesFullOnLaunch } from "./onlineFavoritesStartupSync";

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
  sessionId?: string;
  credentialType?: "refresh" | "apiKey" | "sessionid";
  csrfToken?: string;
  cfClearance?: string;
  lastSync?: string;
  cloudFavoritesCount?: number;
  profile?: UserProfile;
  comments?: UserComment[];
}

let sessionState: AccountSession = {
  isLoggedIn: false,
};

const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

export async function initAccountSession() {
  try {
    await getAuthStorageReady();
    const raw = await AsyncStorage.getItem(ACCOUNT_KEY);
    if (raw) {
      sessionState = JSON.parse(raw);
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
      } catch {}
    } else {
      sessionState.isLoggedIn = false;
    }
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
  sessionState = {
    ...sessionState,
    ...data,
    isLoggedIn: Boolean(data.sessionId || data.username || sessionState.sessionId || sessionState.isLoggedIn),
  };
  await AsyncStorage.setItem(ACCOUNT_KEY, JSON.stringify(sessionState));
  notify();
}

export async function logoutAccount() {
  try {
    await v2Logout();
  } catch {}
  sessionState = { isLoggedIn: false };
  await AsyncStorage.removeItem(ACCOUNT_KEY);
  notify();
}

let syncInProgress = false;

export function isSyncInProgress(): boolean {
  return syncInProgress;
}

export async function syncCloudFavorites(
  report?: (msg: string, current?: number, total?: number) => void
): Promise<{ success: boolean; count: number; error?: string }> {
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
      return { success: false, count: 0, error: res.error || "Échec de synchronisation" };
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
  onProgress?: (msg: string) => void
): Promise<{ success: boolean; error?: string; count?: number }> {
  try {
    onProgress?.("Récupération du défi de sécurité...");
    const pow = await getPowChallenge("login");

    onProgress?.("Résolution du challenge cryptographique (PoW)...");
    const nonce = await solvePoW(pow.challenge, pow.difficulty, (currNonce) => {
      if (currNonce % 20000 === 0) {
        onProgress?.(`Calcul cryptographique... (${currNonce} itérations)`);
      }
    });

    onProgress?.("Authentification officielle nHentai API v2...");
    const authResult = await v2Login({
      username,
      password,
      pow_challenge: pow.challenge,
      pow_nonce: nonce,
      captcha_response: captchaResponse,
    });

    let profile: UserProfile | undefined = undefined;
    try {
      const me = await getMe();
      if (me) {
        profile = {
          id: me.id,
          username: me.username,
          email: me.email,
          avatar_url: me.avatar_url,
        };
      }
    } catch {}

    await saveAccountSession({
      sessionId: authResult.access_token,
      username: profile?.username || username,
      credentialType: "refresh",
      isLoggedIn: true,
      profile,
    });

    return { success: true };
  } catch (err: any) {
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
        avatar_url: me.avatar_url,
        num_favorites: sessionState.cloudFavoritesCount || 0,
      };

      await saveAccountSession({
        profile,
        username: me.username,
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
    await getAuthStorageReady();
    if (!(await hasSession())) {
      return { success: false, error: "Vous devez être connecté." };
    }

    try {
      await updateProfile({ avatar_url: avatarUrl });
    } catch {}

    const updatedProfile: UserProfile = {
      ...(sessionState.profile || { username: sessionState.username || "User" }),
      avatar_url: avatarUrl,
    };

    await saveAccountSession({
      profile: updatedProfile,
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Erreur de mise à jour de l'avatar." };
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
      sessionId: string,
      username?: string,
      credentialType: "refresh" | "apiKey" | "sessionid" = "refresh",
      extra?: { cfClearance?: string; csrfToken?: string }
    ) => {
      if (credentialType === "apiKey") {
        await storeTokens(sessionId, sessionId);
      } else {
        await storeTokens(sessionId, sessionId);
      }
      await saveAccountSession({
        sessionId,
        username: username || "Membre nHentai",
        credentialType,
        cfClearance: extra?.cfClearance,
        csrfToken: extra?.csrfToken,
        isLoggedIn: true,
      });
      void fetchUserProfile();
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

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useState, useEffect } from "react";
import { Gallery } from "./api/types";
import { enrichGalleryImages, getGallery } from "./api/nhentai";
import { getFavorites, importFavorites } from "./favoritesStore";

const ACCOUNT_KEY = "@nhentai_account_session_v1";

export interface AccountSession {
  isLoggedIn: boolean;
  username?: string;
  sessionId?: string;
  csrfToken?: string;
  cfClearance?: string;
  lastSync?: string;
  cloudFavoritesCount?: number;
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
    const raw = await AsyncStorage.getItem(ACCOUNT_KEY);
    if (raw) {
      sessionState = JSON.parse(raw);
      notify();
    }
  } catch {}
}

export function getAccountSession(): AccountSession {
  return sessionState;
}

export async function saveAccountSession(data: Partial<AccountSession>) {
  sessionState = {
    ...sessionState,
    ...data,
    isLoggedIn: Boolean(data.sessionId || data.username || sessionState.sessionId),
  };
  await AsyncStorage.setItem(ACCOUNT_KEY, JSON.stringify(sessionState));
  notify();
}

export async function logoutAccount() {
  sessionState = { isLoggedIn: false };
  await AsyncStorage.removeItem(ACCOUNT_KEY);
  notify();
}

/**
 * Fetch and sync cloud favorites from official nHentai account
 */
export async function syncCloudFavorites(
  onProgress?: (msg: string, current: number, total: number) => void
): Promise<{ success: boolean; count: number; error?: string }> {
  if (!sessionState.sessionId && !sessionState.isLoggedIn) {
    return { success: false, count: 0, error: "Veuillez vous connecter d'abord avec votre sessionid." };
  }

  const cookieHeader = [
    sessionState.sessionId ? `sessionid=${sessionState.sessionId}` : "",
    sessionState.csrfToken ? `csrftoken=${sessionState.csrfToken}` : "",
    sessionState.cfClearance ? `cf_clearance=${sessionState.cfClearance}` : "",
  ]
    .filter(Boolean)
    .join("; ");

  onProgress?.("Connexion au Cloud nHentai...", 0, 1);

  try {
    const collectedGalleries: Gallery[] = [];
    let page = 1;
    let maxPages = 1;

    // Try official API v2 favorites endpoint
    try {
      const res = await fetch(`https://nhentai.net/api/v2/favorites?page=${page}`, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
          Referer: "https://nhentai.net/favorites/",
          Cookie: cookieHeader,
        },
      });

      if (res.ok) {
        const data = await res.json();
        const raw = data.result || data.galleries || [];
        maxPages = data.num_pages || Math.ceil((data.total || raw.length) / 25) || 1;
        raw.forEach((g: any) => collectedGalleries.push(enrichGalleryImages(g)));

        onProgress?.(`Synchronisation page 1/${maxPages}...`, 1, maxPages);

        // Fetch remaining pages if any (up to 5 pages)
        for (let p = 2; p <= Math.min(maxPages, 5); p++) {
          try {
            onProgress?.(`Synchronisation page ${p}/${maxPages}...`, p, maxPages);
            const pRes = await fetch(`https://nhentai.net/api/v2/favorites?page=${p}`, {
              headers: {
                "User-Agent":
                  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
                Referer: "https://nhentai.net/favorites/",
                Cookie: cookieHeader,
              },
            });
            if (pRes.ok) {
              const pData = await pRes.json();
              (pData.result || []).forEach((g: any) => collectedGalleries.push(enrichGalleryImages(g)));
            }
          } catch {}
        }
      } else {
        throw new Error(`HTTP ${res.status}`);
      }
    } catch (errApi) {
      // Fallback: parse HTML favorites page
      onProgress?.("Récupération de la bibliothèque...", 1, 1);
      const resHtml = await fetch(`https://nhentai.net/favorites/`, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
          Referer: "https://nhentai.net/",
          Cookie: cookieHeader,
        },
      });

      const html = await resHtml.text();
      const matches = [...html.matchAll(/\/g\/(\d+)\//g)];
      const ids = Array.from(new Set(matches.map((m) => parseInt(m[1], 10)))).filter(Boolean);

      for (let i = 0; i < ids.length; i++) {
        const id = ids[i];
        onProgress?.(`Importation manga ${i + 1}/${ids.length}...`, i + 1, ids.length);
        try {
          const g = await getGallery(id);
          if (g) collectedGalleries.push(g);
        } catch {}
      }
    }

    // Merge into local favorites store
    await importFavorites(collectedGalleries);

    const now = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    await saveAccountSession({
      lastSync: now,
      cloudFavoritesCount: collectedGalleries.length,
    });

    return { success: true, count: collectedGalleries.length };
  } catch (err: any) {
    console.error("Cloud sync error:", err);
    return { success: false, count: 0, error: err?.message || "Erreur de synchronisation cloud." };
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
    isLoggedIn: session.isLoggedIn,
    loginWithSession: (sessionId: string, username?: string) =>
      saveAccountSession({ sessionId, username: username || "Membre nHentai", isLoggedIn: true }),
    logout: logoutAccount,
    syncFavorites: syncCloudFavorites,
  };
}

initAccountSession();

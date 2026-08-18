import AsyncStorage from "@react-native-async-storage/async-storage";
import { useState, useEffect } from "react";
import { Gallery, Tag } from "./api/types";
import { enrichGalleryImages, getGallery, getMirrorBase } from "./api/nhentai";
import { getFavorites, importFavorites, hasPlaceholderFavorites } from "./favoritesStore";

const ACCOUNT_KEY = "@nhentai_account_session_v1";

export interface AccountSession {
  isLoggedIn: boolean;
  username?: string;
  /** Credential du compte nhentai.net : refresh_token, clé API, ou sessionid (legacy). */
  sessionId?: string;
  credentialType?: "refresh" | "apiKey" | "sessionid";
  csrfToken?: string;
  cfClearance?: string;
  lastSync?: string;
  cloudFavoritesCount?: number;
  /**
   * Progression d'une synchro en cours — permet la reprise après interruption.
   * `fetchedCount` cumule les favoris déjà reçus sur TOUTES les exécutions de
   * la synchro (c'est lui qui garantit un compteur final exact, même après une
   * reprise) ; `failedPages` liste les pages à re-tenter pour qu'aucune page
   * défaillante ne soit perdue silencieusement.
   */
  syncProgress?: {
    lastPage: number;
    maxPages: number;
    fetchedCount: number;
    failedPages: number[];
  };
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
 * Résout les tags des favoris cloud : l'API v2 renvoie des `tag_ids` numériques,
 * résolus en objets nommés via le proxy (/api/tags/ids, relais de l'endpoint
 * public officiel avec cache en mémoire). Pacing ~4 s (quota officiel 15/min/IP).
 * Échec = soft : les galeries gardent leurs titres réels, seuls les tags manquent.
 */
async function resolveFavoriteTags(
  galleries: Gallery[],
  report?: (msg: string, current: number, total: number) => void
) {
  const ids = new Set<number>();
  for (const g of galleries) {
    for (const id of g.tag_ids || []) ids.add(Number(id));
  }
  if (ids.size === 0) return;

  const idList = [...ids];
  const base = getMirrorBase();
  const byId = new Map<number, Tag>();
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const chunks = Math.ceil(idList.length / 100);

  for (let i = 0; i < idList.length; i += 100) {
    const chunkIdx = Math.floor(i / 100) + 1;
    report?.(`Résolution des tags ${chunkIdx}/${chunks}...`, chunkIdx, chunks);
    const chunk = idList.slice(i, i + 100).join(",");
    try {
      const res = await fetch(`${base}/api/tags/ids?ids=${chunk}`, {
        headers: { Accept: "application/json" },
      });
      if (res.ok) {
        const tags = await res.json();
        for (const t of tags) {
          byId.set(Number(t.id), {
            id: Number(t.id),
            type: t.type,
            name: t.name,
            url: t.url || "",
            count: Number(t.count) || 0,
          });
        }
      }
    } catch (err) {
      console.warn("[sync] résolution tags échouée:", (err as Error)?.message);
    }
    if (i + 100 < idList.length) await sleep(4000);
  }

  for (const g of galleries) {
    const gIds = (g.tag_ids || []).map(Number);
    if (gIds.length) {
      const resolved = gIds
        .map((id) => byId.get(id))
        .filter((t): t is Tag => Boolean(t));
      if (resolved.length) g.tags = resolved;
    }
  }
}

/** Une seule synchro à la fois (auto + manuelle ne consomment pas deux fois le quota). */
let syncInProgress = false;

/** Une synchro (manuelle ou auto) est-elle en cours ? Le timer périodique s'en sert pour différer son cycle. */
export function isSyncInProgress(): boolean {
  return syncInProgress;
}

/** Persiste la progression de synchro sans notifier les écrans (écriture silencieuse). */
async function persistSyncProgress(
  lastPage: number,
  maxPages: number,
  fetchedCount: number,
  failedPages: number[]
) {
  sessionState.syncProgress = { lastPage, maxPages, fetchedCount, failedPages };
  try {
    await AsyncStorage.setItem(ACCOUNT_KEY, JSON.stringify(sessionState));
  } catch {}
}

/**
 * Fetch and sync cloud favorites from official nHentai account, via the local
 * mirror proxy (nhentai.net direct est bloqué depuis l'émulateur ; le proxy
 * relaie avec le cookie sessionid et gère la bascule de miroirs).
 *
 * La synchro est reprenable : si une exécution précédente a été interrompue,
 * seules les pages manquantes sont re-synchronisées (la page 1 est toujours
 * refetchée pour connaître maxPages et attraper les nouveaux favoris).
 */
export async function syncCloudFavorites(
  onProgress?: (msg: string, current: number, total: number) => void
): Promise<{ success: boolean; count: number; error?: string }> {
  const credential = sessionState.sessionId;
  const credentialType = sessionState.credentialType || "sessionid";
  if (!credential || !sessionState.isLoggedIn) {
    return {
      success: false,
      count: 0,
      error: "Veuillez d'abord connecter votre compte (clé API ou refresh_token du site officiel).",
    };
  }
  // Un sessionId généré par l'ancien onglet "Identifiants" (faux login) ne peut
  // pas valider auprès de nhentai.net — signaler clairement au lieu de 0 favoris.
  if (/^auth_\d+$/.test(credential)) {
    return {
      success: false,
      count: 0,
      error:
        "Session locale invalide : déconnectez-vous puis collez une clé API ou un refresh_token du site officiel nhentai.net.",
    };
  }
  // Une synchro est déjà en cours (auto au lancement, manuelle…) : ne pas en
  // lancer une deuxième en parallèle (doublons + double consommation du quota).
  if (syncInProgress) {
    return { success: false, count: 0, error: "Une synchronisation est déjà en cours." };
  }
  syncInProgress = true;

  const base = getMirrorBase();
  // Reporter la progression à la fois au callback local (texte des boutons de
  // modales) et à l'état global (jauge de l'écran Favoris — visible aussi
  // quand la synchro est déclenchée automatiquement).
  const report = (msg: string, current: number, total: number) => {
    onProgress?.(msg, current, total);
    setSyncProgressState({ active: true, msg, current, total });
  };
  report("Connexion au Cloud nHentai...", 0, 1);

  // Toutes les pages de favoris sont synchronisées (pas de plafond) : un compte
  // avec ~2 000 favoris fait ~80 pages. L'API officielle limite à 15 req/min
  // (x-ratelimit-limit) — on espace à ~12 req/min (5 s), on attend `retryAfter`
  // en cas de 429, et on allonge la pause quand le quota est presque épuisé.
  const PAGE_SIZE = 25;
  const PAGE_DELAY_MS = 5000;
  const MIN_RETRY_WAIT_MS = 30000;
  const MAX_PAGE_ATTEMPTS = 6;
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  try {
    const collectedGalleries: Gallery[] = [];
    let page = 1;
    let maxPages = 1;

    const fetchPage = async (p: number) => {
      const headers: Record<string, string> = {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
        Accept: "application/json, text/plain, */*",
      };
      if (credentialType === "refresh") headers["X-Refresh-Token"] = credential;
      else if (credentialType === "apiKey") headers["X-Api-Key"] = credential;
      else headers["X-Sessionid"] = credential;

      let lastError: any;
      for (let attempt = 1; attempt <= MAX_PAGE_ATTEMPTS; attempt++) {
        try {
          const res = await fetch(`${base}/api/favorites?page=${p}`, { headers });
          if (res.status === 429) {
            // Rate limité : le proxy relaie `retryAfter` de l'API officielle.
            const body = await res.json().catch(() => ({}));
            const waitMs = Math.max(Number(body?.retryAfter || 60) * 1000, MIN_RETRY_WAIT_MS);
            report(
              `Limite API atteinte — pause ${Math.round(waitMs / 1000)} s...`,
              p,
              maxPages || 1
            );
            await sleep(waitMs);
            continue;
          }
          if (!res.ok) {
            let detail = `HTTP ${res.status}`;
            try {
              const body = await res.json();
              if (body?.error) detail = body.error;
            } catch {}
            throw new Error(detail);
          }
          return await res.json();
        } catch (err) {
          lastError = err;
          if (attempt < MAX_PAGE_ATTEMPTS) await sleep(MIN_RETRY_WAIT_MS);
        }
      }
      throw lastError || new Error(`Page ${p} inaccessible`);
    };

    let lastPage = 1;
    let accumulated = 0;
    let failedPages: number[] = [];
    try {
      const data = await fetchPage(page);
      const raw = data.result || data.galleries || [];
      maxPages =
        data.num_pages || Math.ceil((data.total || raw.length) / PAGE_SIZE) || 1;
      raw.forEach((g: any) => collectedGalleries.push(enrichGalleryImages(g)));

      // Reprise : si une exécution précédente a été interrompue (même nombre de
      // pages totales), ne re-fetcher que les pages manquantes. La page 1 est
      // toujours refetchée (maxPages à jour + nouveaux favoris), mais on ne la
      // re-compte pas dans le total — il est déjà dans `fetchedCount` de la
      // reprise. Une progression sans `fetchedCount` (ancien format) déclenche
      // une synchro complète : le compte total ne peut pas être reconstruit
      // fiablement à partir des seules pages déjà vues.
      const prev = sessionState.syncProgress;
      const canResume =
        !!prev &&
        prev.maxPages === maxPages &&
        prev.lastPage >= 2 &&
        typeof prev.fetchedCount === "number" &&
        (prev.lastPage < maxPages || (prev.failedPages?.length ?? 0) > 0) &&
        // Favoris « Gallery #id » périmés dans le store (ancien proxy) : on ne
        // peut pas les enrichir sans re-fetcher — synchro complète une fois.
        !hasPlaceholderFavorites();
      lastPage = canResume && prev ? prev.lastPage : 1;
      accumulated = canResume && prev ? prev.fetchedCount : raw.length;
      failedPages = canResume && prev ? [...(prev.failedPages ?? [])] : [];
      const startPage = canResume && prev ? prev.lastPage + 1 : 2;

      report(
        canResume
          ? `Reprise de la synchro à la page ${startPage}/${maxPages}...`
          : `Synchronisation page 1/${maxPages}...`,
        Math.min(startPage - 1, maxPages),
        maxPages
      );

      // Pages restantes — toutes, sans plafond (un compte peut avoir des
      // centaines de pages de favoris) — plus les pages échouées à re-tenter.
      // Espacement adapté au quota restant (15 req/min officiel).
      const pagesToFetch = new Set<number>();
      for (let p = startPage; p <= maxPages; p++) pagesToFetch.add(p);
      for (const fp of failedPages) if (fp >= 2 && fp <= maxPages) pagesToFetch.add(fp);
      const ordered = [...pagesToFetch].sort((a, b) => a - b);

      for (const p of ordered) {
        report(`Synchronisation page ${p}/${maxPages}...`, p, maxPages);
        try {
          const pData = await fetchPage(p);
          const list = pData.result || [];
          list.forEach((g: any) => collectedGalleries.push(enrichGalleryImages(g)));
          accumulated += list.length;
          lastPage = Math.max(lastPage, p);
          failedPages = failedPages.filter((fp) => fp !== p);
          // Progression persistée après chaque page réussie : une interruption
          // fera reprendre la synchro aux pages manquantes au prochain lancement.
          await persistSyncProgress(lastPage, maxPages, accumulated, failedPages);
          // Quota presque épuisé (1 ou 2 restantes) : attendre la fin de la
          // fenêtre officielle avant la page suivante.
          const remaining = Number(pData?.rateLimitRemaining ?? -1);
          const waitMs =
            remaining >= 0 && remaining <= 2
              ? Math.max(Number(pData?.retryAfter || 60) * 1000, MIN_RETRY_WAIT_MS)
              : PAGE_DELAY_MS;
          if (p < ordered[ordered.length - 1]) await sleep(waitMs);
        } catch (err) {
          if (!failedPages.includes(p)) failedPages.push(p);
          console.warn(`[sync] page ${p}/${maxPages} ignorée :`, (err as Error)?.message);
        }
      }

      if (failedPages.length > 0) {
        console.warn(
          `[sync] ${failedPages.length} page(s) restent non synchronisées : ${failedPages.join(", ")}`
        );
      }
    } catch (errApi: any) {
      // Le proxy a déjà son propre repli HTML ; ici on ne gère que l'erreur.
      throw errApi;
    }

    // Résolution des tags (tag_ids v2 → noms) avant l'import, puis fusion
    // idempotente dans le store local (n'enrichit jamais un favori local riche).
    await resolveFavoriteTags(collectedGalleries, report);
    await importFavorites(collectedGalleries);

    if (failedPages.length > 0) {
      // Synchro incomplète : on garde la progression pour reprendre les pages
      // manquantes au prochain lancement — aucune perte silencieuse, et le
      // compteur reflète déjà le total partiel.
      await persistSyncProgress(lastPage, maxPages, accumulated, failedPages);
      return {
        success: false,
        count: accumulated,
        error: `Synchronisation partielle : ${failedPages.length} page(s) sur ${maxPages} non synchronisée(s) — reprise automatique au prochain lancement.`,
      };
    }

    const now = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    // Synchro complète : efface la progression (la prochaine exécution repart
    // de la page 1 pour capter les changements) et mémorise le compte total —
    // y compris sur une synchro reprise (fetchedCount cumulé).
    await saveAccountSession({
      lastSync: now,
      cloudFavoritesCount: accumulated,
      syncProgress: undefined,
    });

    return { success: true, count: accumulated };
  } catch (err: any) {
    console.error("Cloud sync error:", err);
    const message =
      /401|session|connexion/i.test(String(err?.message || ""))
        ? `Session invalide : ${err?.message || "credential refusé"}. Vérifiez votre clé API ou refresh_token officiel.`
        : err?.message || "Erreur de synchronisation cloud.";
    return { success: false, count: 0, error: message };
  } finally {
    syncInProgress = false;
    setSyncProgressState({ active: false, msg: "", current: 0, total: 0 });
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
    loginWithSession: (
      sessionId: string,
      username?: string,
      credentialType: "refresh" | "apiKey" | "sessionid" = "refresh"
    ) =>
      saveAccountSession({
        sessionId,
        username: username || "Membre nHentai",
        credentialType,
        isLoggedIn: true,
      }),
    logout: logoutAccount,
    syncFavorites: syncCloudFavorites,
  };
}

// ---------------------------------------------------------------------------
// Progression de synchro (globale) : l'écran Favoris affiche une jauge même
// quand la synchro est déclenchée automatiquement (lancement / périodique),
// pas seulement par le bouton manuel.
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Synchronisation automatique : au lancement de l'app puis périodiquement,
// quand un compte avec un vrai credential est connecté. Silencieuse (pas
// d'alerte UI) ; les erreurs sont déjà loggées par syncCloudFavorites.
// ---------------------------------------------------------------------------
const AUTO_SYNC_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const AUTO_SYNC_DEFER_MS = 5 * 60 * 1000; // re-tenter dans 5 min si une synchro est en cours

let autoSyncTimer: ReturnType<typeof setTimeout> | null = null;
let autoSyncInFlight = false;

/** Vrai credential ? (refuse les IDs factices de l'ancien onglet « Identifiants ».) */
function hasUsableCredential(): boolean {
  return Boolean(
    sessionState.isLoggedIn &&
      sessionState.sessionId &&
      !/^auth_\d+$/.test(sessionState.sessionId)
  );
}

/** Planifie le prochain passage du timer (un seul timer à la fois). */
function scheduleAutoSync(delayMs: number) {
  if (autoSyncTimer) clearTimeout(autoSyncTimer);
  autoSyncTimer = setTimeout(() => {
    autoSyncTimer = null;
    void autoSyncCloudFavorites();
  }, delayMs);
}

async function autoSyncCloudFavorites() {
  if (!hasUsableCredential()) {
    // Compte non connecté : garder le rythme (l'utilisateur peut se connecter
    // plus tard sans redémarrer l'app).
    scheduleAutoSync(AUTO_SYNC_INTERVAL_MS);
    return;
  }
  if (autoSyncInFlight || isSyncInProgress()) {
    // Une synchro est déjà en cours (manuelle, connexion, ou auto) : différer
    // le cycle au lieu de le perdre — jamais deux syncs simultanées, le quota
    // officiel (15 req/min) serait consommé deux fois.
    scheduleAutoSync(AUTO_SYNC_DEFER_MS);
    return;
  }
  autoSyncInFlight = true;
  try {
    await syncCloudFavorites();
  } catch {
    // syncCloudFavorites renvoie { success:false } sans throw ; garde de sécurité.
  } finally {
    autoSyncInFlight = false;
  }
  // Prochaine synchro planifiée APRÈS la fin de celle-ci : l'espacement est
  // mesuré depuis la fin réelle de la synchro, jamais empilé sur une synchro
  // en cours.
  scheduleAutoSync(AUTO_SYNC_INTERVAL_MS);
}

/** Démarre la synchro automatique : immédiate au lancement, puis périodique. */
export function startAutoSync() {
  if (autoSyncTimer) return;
  // Au lancement : synchro immédiate si un compte est connecté. Le timer
  // périodique est planifié par autoSyncCloudFavorites lui-même.
  void autoSyncCloudFavorites();
}

initAccountSession().then(() => startAutoSync());

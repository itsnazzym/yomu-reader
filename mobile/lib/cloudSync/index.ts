import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import "react-native-url-polyfill/auto";
import { createBackupPayload, restoreBackupFromJson, type BackupData } from "../backupStore";
import { decryptVault, encryptVault, generateRecoveryKey, vaultRecordKey } from "./crypto";
import {
  getNativeGoogleIdToken,
  GoogleNativeUnavailableError,
  signOutNativeGoogle,
} from "./googleNative";
import type { CloudSyncState } from "./types";
import { createSecureSessionStorage } from "../secureSessionStorage";
import { cleanupSession } from "../sessionCleanup";
import { mergeBackups as mergeBackup, createSyncBaseline, backupsEqual, type SyncBaseline } from "./merge";

WebBrowser.maybeCompleteAuthSession();

const RECOVERY_KEY = "yomu.cloud.recovery-key.v1";
const META_KEY = "@yomu_cloud_sync_meta_v1";
const VAULT_KIND = "vault";
const VAULT_SCHEMA = 1;
const MAX_VAULT_BYTES = 4 * 1024 * 1024;

type VaultRow = { nonce: string; ciphertext: string; schema_version: number; revision: number; updated_at: string };
type Meta = { revision: number; lastSyncedAt?: string; baseline?: SyncBaseline };
class VaultConflictError extends Error {}
let syncGeneration = 0;
let applyingRemote = false;
let creation: Promise<string> | null = null;
let disconnecting: Promise<void> | null = null;
const pendingDisconnectCleanup = new Map<string, () => Promise<unknown>>();

let client: SupabaseClient | null = null;
let syncTimer: ReturnType<typeof setTimeout> | null = null;
let inFlight: Promise<void> | null = null;
const completedCallbackUrls = new Set<string>();
const callbackInFlight = new Map<string, Promise<void>>();
let state: CloudSyncState = { status: "unconfigured" };
const listeners = new Set<() => void>();

function emit(next: CloudSyncState): void {
  state = next;
  for (const listener of listeners) listener();
}

export function subscribeCloudSync(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getCloudSyncState(): CloudSyncState {
  return state;
}

export function isCloudSyncConfigured(): boolean {
  return Boolean(process.env.EXPO_PUBLIC_SUPABASE_URL && process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}

const authStorage = createSecureSessionStorage("yomu.supabase");

function getClient(): SupabaseClient {
  if (disconnecting) throw new Error("Déconnexion en cours. Patientez avant de vous reconnecter.");
  if (!isCloudSyncConfigured()) throw new Error("Yomu Cloud n'est pas configuré dans cette build.");
  if (!client) {
    const generation = syncGeneration;
    client = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL!, process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
      auth: {
        storage: {
          getItem: authStorage.getItem,
          setItem: (key, value) => generation === syncGeneration
            ? authStorage.setItem(key, value)
            : Promise.reject(new Error("Cette session a été déconnectée.")),
          removeItem: (key) => generation === syncGeneration
            ? authStorage.removeItem(key)
            : Promise.resolve(),
        },
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        flowType: "pkce",
      },
    });
  }
  return client;
}

function aad(userId: string): string {
  return `yomu-cloud:v${VAULT_SCHEMA}:${userId}`;
}

function recoveryStorageKey(userId: string): string { return `${RECOVERY_KEY}.${userId}`; }
function pendingStorageKey(userId: string): string { return `${recoveryStorageKey(userId)}.pending`; }
function metaStorageKey(userId: string, key: string): string { return `${META_KEY}:${userId}:${vaultRecordKey(key)}`; }

async function loadMeta(userId: string, key: string): Promise<Meta> {
  try { return JSON.parse((await AsyncStorage.getItem(metaStorageKey(userId, key))) || "{\"revision\":0}") as Meta; }
  catch { return { revision: 0 }; }
}
async function saveMeta(userId: string, key: string, meta: Meta): Promise<void> {
  await AsyncStorage.setItem(metaStorageKey(userId, key), JSON.stringify(meta));
}
async function getRecoveryKey(userId: string): Promise<string | null> {
  const scoped = await SecureStore.getItemAsync(recoveryStorageKey(userId));
  if (scoped) return scoped;
  const legacy = await SecureStore.getItemAsync(RECOVERY_KEY);
  if (!legacy) return null;
  // A legacy unscoped key belongs to this account only if its vault decrypts
  // with this authenticated user's associated data. Never assign it blindly.
  const vault = await readVault(userId, legacy);
  if (!vault) return null;
  await SecureStore.setItemAsync(recoveryStorageKey(userId), legacy);
  await SecureStore.deleteItemAsync(RECOVERY_KEY);
  return legacy;
}
const DEVICE_DOWNLOAD_KEYS = ["treeUri", "folderUri", "directoryUri", "downloadDirectory", "safUri", "safDirectoryUri", "folderPrompted"];
function portableBackup(data: BackupData): BackupData {
  const downloadSettings = { ...(data.downloadSettings || {}) };
  for (const key of DEVICE_DOWNLOAD_KEYS) delete downloadSettings[key];
  return { ...data, version: VAULT_SCHEMA, downloadSettings };
}
async function applyBackup(data: BackupData, device: BackupData): Promise<void> {
  const downloadSettings = { ...(data.downloadSettings || {}) };
  for (const key of DEVICE_DOWNLOAD_KEYS) if (Object.hasOwn(device.downloadSettings || {}, key)) downloadSettings[key] = device.downloadSettings![key];
  applyingRemote = true;
  try {
    const restored = await restoreBackupFromJson(JSON.stringify({ ...data, downloadSettings }));
    if (!restored.success) throw new Error(restored.error || "Restauration impossible.");
  } finally { applyingRemote = false; }
}
async function requireUser(userId: string, generation = syncGeneration): Promise<Session> {
  const session = await currentSession();
  if (!session || session.user.id !== userId || generation !== syncGeneration) throw new Error("La session Yomu Cloud a changé. Réessayez.");
  return session;
}

function hasMeaningfulLocalData(data: BackupData): boolean {
  return Boolean(
    data.favorites?.length || data.history?.length || data.tagCollections?.length ||
    data.libraryCollections?.length || data.blacklistTags?.length || data.searchHistory?.length ||
    Object.keys(data.tagFavorites || {}).length || Object.keys(data.followsFeed || {}).length
  );
}

async function currentSession(): Promise<Session | null> {
  const { data } = await getClient().auth.getSession();
  return data.session;
}

async function readVault(userId: string, recoveryKey: string): Promise<{ row: VaultRow; data: BackupData } | null> {
  const session = await requireUser(userId);
  const { data, error } = await getClient().from("sync_records").select("nonce,ciphertext,schema_version,revision,updated_at")
    .eq("kind", VAULT_KIND).eq("record_key", vaultRecordKey(recoveryKey)).maybeSingle().setHeader("Authorization", `Bearer ${session.access_token}`);
  if (error) throw error;
  if (!data) return null;
  const row = data as VaultRow;
  return { row, data: decryptVault<BackupData>({ nonce: row.nonce, ciphertext: row.ciphertext, schemaVersion: row.schema_version }, recoveryKey, aad(userId)) };
}

async function writeVault(userId: string, recoveryKey: string, data: BackupData, expectedRevision: number): Promise<number> {
  const session = await requireUser(userId);
  const serialized = JSON.stringify(data);
  if (new TextEncoder().encode(serialized).byteLength > MAX_VAULT_BYTES) throw new Error("Le coffre Yomu dépasse 4 Mio. Exportez manuellement vos données.");
  const encrypted = await encryptVault(data, recoveryKey, aad(userId));
  const { data: result, error } = await getClient().rpc("save_yomu_vault", {
    p_record_key: vaultRecordKey(recoveryKey), p_nonce: encrypted.nonce, p_ciphertext: encrypted.ciphertext,
    p_schema_version: encrypted.schemaVersion, p_expected_revision: expectedRevision,
  }).setHeader("Authorization", `Bearer ${session.access_token}`);
  if (error) throw error;
  const row = Array.isArray(result) ? result[0] : result;
  if (!row?.applied) throw new VaultConflictError("Conflit de synchronisation. Réessayez.");
  return Number(row.revision);
}

export async function refreshCloudSyncState(): Promise<void> {
  if (!isCloudSyncConfigured()) return emit({ status: "unconfigured", message: "Ajoutez les variables Supabase à la build." });
  try {
    const session = await currentSession();
    if (!session) return emit({ status: "signed_out" });
    const key = await getRecoveryKey(session.user.id);
    const meta = key ? await loadMeta(session.user.id, key) : { revision: 0 };
    emit({ status: key ? "idle" : "locked", email: session.user.email, lastSyncedAt: meta.lastSyncedAt });
  } catch (error) {
    emit({ status: "error", message: error instanceof Error ? error.message : "Yomu Cloud indisponible." });
  }
}

export async function connectWithGoogleBrowser(): Promise<void> {
  const supabase = getClient();
  // Callback dédié, déclaré dans Expo Router. Cette forme à trois slash est
  // celle à enregistrer dans Supabase et évite la page +not-found au retour.
  const redirectTo = "yomureader:///cloud-auth";
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error || !data.url) throw error || new Error("Impossible de démarrer Google.");
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== "success" || !result.url) throw new Error("Connexion Google annulée.");
  await completeCloudAuthCallback(result.url);
}

/**
 * Ouvre le sélecteur de compte Android (Credential Manager). Google y propose
 * automatiquement les passkeys et le verrouillage d'écran lorsqu'ils existent.
 */
export async function connectWithGoogle(): Promise<void> {
  try {
    const { idToken, nonce } = await getNativeGoogleIdToken();
    const { error } = await getClient().auth.signInWithIdToken({
      provider: "google",
      token: idToken,
      nonce,
    });
    if (error) throw error;
    await refreshCloudSyncState();
  } catch (error) {
    if (error instanceof GoogleNativeUnavailableError) {
      await connectWithGoogleBrowser();
      return;
    }
    throw error;
  }
}

/** Finalise le retour OAuth, y compris lorsqu'Android relance l'app sur la route. */
export async function completeCloudAuthCallback(url: string): Promise<void> {
  if (completedCallbackUrls.has(url)) return;
  const pending = callbackInFlight.get(url);
  if (pending) return pending;

  const work = (async () => {
    const query = url.includes("#") ? url.slice(url.indexOf("#") + 1) : url.split("?")[1] || "";
    const params = new URLSearchParams(query);
    const callbackError = params.get("error_description") || params.get("error");
    if (callbackError) throw new Error(callbackError);

    const supabase = getClient();
    const code = params.get("code");
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) throw error;
    } else {
      // Compatibilité avec les retours implicites encore en cache chez un
      // fournisseur OAuth déjà configuré avant la migration PKCE.
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");
      if (!accessToken || !refreshToken) {
        throw new Error("Google n'a pas renvoyé de session.");
      }
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (error) throw error;
    }
    completedCallbackUrls.add(url);
    await refreshCloudSyncState();
  })().finally(() => callbackInFlight.delete(url));
  callbackInFlight.set(url, work);
  return work;
}

export function createVault(): Promise<string> {
  if (creation) return creation;
  const generation = syncGeneration;
  creation = (async () => {
    const session = await currentSession();
    if (!session) throw new Error("Connectez-vous à Google d'abord.");
    const userId = session.user.id;
    if (await getRecoveryKey(userId)) throw new Error("Un coffre est déjà configuré sur cet appareil.");
    const key = await SecureStore.getItemAsync(pendingStorageKey(userId)) || await generateRecoveryKey();
    await requireUser(userId, generation);
    // Keep the key across a timeout: the server may have accepted the write.
    await SecureStore.setItemAsync(pendingStorageKey(userId), key);
    const existing = await readVault(userId, key);
    const payload = existing?.data || portableBackup(await createBackupPayload());
    const revision = existing?.row.revision || await writeVault(userId, key, payload, 0);
    await requireUser(userId, generation);
    await SecureStore.setItemAsync(recoveryStorageKey(userId), key);
    await saveMeta(userId, key, { revision, baseline: createSyncBaseline(payload), lastSyncedAt: new Date().toISOString() });
    await SecureStore.deleteItemAsync(pendingStorageKey(userId));
    await refreshCloudSyncState();
    return key;
  })().finally(() => { creation = null; });
  return creation;
}

export async function unlockVault(recoveryKey: string): Promise<void> {
  const generation = syncGeneration;
  const session = await currentSession();
  if (!session) throw new Error("Connectez-vous à Google d'abord.");
  const key = recoveryKey.trim(), userId = session.user.id;
  const vault = await readVault(userId, key);
  if (!vault) throw new Error("Aucun coffre ne correspond à cette clé.");
  const device = await createBackupPayload();
  const local = portableBackup(device);
  const restored = hasMeaningfulLocalData(local) ? mergeBackup(vault.data, local) : vault.data;
  await requireUser(userId, generation);
  await applyBackup(restored, device);
  await requireUser(userId, generation);
  await SecureStore.setItemAsync(recoveryStorageKey(userId), key);
  await saveMeta(userId, key, { revision: vault.row.revision, baseline: createSyncBaseline(vault.data), lastSyncedAt: vault.row.updated_at });
  await refreshCloudSyncState();
  scheduleCloudSync();
}

export async function syncNow(): Promise<void> {
  if (!isCloudSyncConfigured()) { await refreshCloudSyncState(); return; }
  if (inFlight) return inFlight;
  const generation = syncGeneration;
  const request = (async () => {
    const session = await currentSession();
    if (!session) { await refreshCloudSyncState(); return; }
    const userId = session.user.id;
    const key = await getRecoveryKey(userId);
    if (!key) { await refreshCloudSyncState(); return; }
    emit({ status: "syncing", email: session.user.email });
    try {
      const meta = await loadMeta(userId, key);
      const local = portableBackup(await createBackupPayload());
      let synced: BackupData | null = null, revision = 0;
      for (let attempt = 0; attempt < 3; attempt++) {
        await requireUser(userId, generation);
        const remote = await readVault(userId, key);
        const merged = remote
          ? (!meta.baseline && !hasMeaningfulLocalData(local) ? remote.data : mergeBackup(remote.data, local, meta.baseline))
          : local;
        try {
          revision = remote && backupsEqual(remote.data, merged) ? remote.row.revision : await writeVault(userId, key, merged, remote?.row.revision || 0);
          synced = merged;
          break;
        } catch (error) { if (!(error instanceof VaultConflictError) || attempt === 2) throw error; }
      }
      if (!synced) throw new Error("Conflit de synchronisation. Réessayez.");
      await requireUser(userId, generation);
      // Preserve edits made while the network request was in flight.
      const device = await createBackupPayload();
      const fresh = portableBackup(device);
      const applied = mergeBackup(synced, fresh, createSyncBaseline(local));
      if (!backupsEqual(fresh, applied)) await applyBackup(applied, device);
      await requireUser(userId, generation);
      const lastSyncedAt = new Date().toISOString();
      await saveMeta(userId, key, { revision, baseline: createSyncBaseline(synced), lastSyncedAt });
      emit({ status: "idle", email: session.user.email, lastSyncedAt });
      if (!backupsEqual(applied, synced)) scheduleCloudSync();
    } catch (error) {
      if (generation !== syncGeneration) return;
      const message = error instanceof Error ? error.message : "Échec de synchronisation.";
      emit({ status: /network|fetch|offline|timeout/i.test(message) ? "offline" : "error", email: session.user.email, message });
    }
  })().catch((error) => {
    if (generation === syncGeneration) emit({ status: "error", message: error instanceof Error ? error.message : "Yomu Cloud indisponible." });
  }).finally(() => { if (inFlight === request) inFlight = null; });
  inFlight = request;
  return request;
}

export function scheduleCloudSync(): void {
  if (applyingRemote) return;
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => { syncTimer = null; void syncNow(); }, 800);
}

export async function disconnectCloud(): Promise<void> {
  if (disconnecting) return disconnecting;
  const work = performCloudDisconnect();
  disconnecting = work;
  try { await work; }
  finally { if (disconnecting === work) disconnecting = null; }
}

async function performCloudDisconnect(): Promise<void> {
  syncGeneration++;
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = null;
  let userId: string | undefined;
  let key: string | null = null;
  let metadataReadFailed = false;
  try {
    const session = isCloudSyncConfigured() ? await currentSession() : null;
    userId = session?.user.id;
    key = userId ? await SecureStore.getItemAsync(recoveryStorageKey(userId)) : null;
  } catch {
    metadataReadFailed = true;
  }
  const previousClient = client;
  if (userId) {
    const recovery = recoveryStorageKey(userId);
    const pending = pendingStorageKey(userId);
    pendingDisconnectCleanup.set(recovery, () => SecureStore.deleteItemAsync(recovery));
    pendingDisconnectCleanup.set(pending, () => SecureStore.deleteItemAsync(pending));
    if (key) {
      const meta = metaStorageKey(userId, key);
      pendingDisconnectCleanup.set(meta, () => AsyncStorage.removeItem(meta));
    }
  }
  const providersClean = await cleanupSession([
    async () => { if (previousClient) await previousClient.auth.stopAutoRefresh(); },
    async () => {
      if (previousClient) {
        const { error } = await previousClient.auth.signOut({ scope: "local" });
        if (error) throw error;
      }
    },
    signOutNativeGoogle,
  ]);
  // Always clear this service's local secrets, even if Google or Supabase failed.
  const localClean = await cleanupSession([
    () => authStorage.clear(),
    ...[...pendingDisconnectCleanup].map(([name, remove]) => async () => {
      await remove();
      pendingDisconnectCleanup.delete(name);
    }),
  ]);
  // Also revoke a client created while reading the account to disconnect.
  syncGeneration++;
  client = null;
  completedCallbackUrls.clear();
  if (!providersClean || !localClean || metadataReadFailed) {
    const message = "La déconnexion est incomplète. Réessayez pour terminer l’effacement des sessions sur ce téléphone.";
    emit({ status: "error", message });
    throw new Error(message);
  }
  emit({ status: "signed_out" });
}

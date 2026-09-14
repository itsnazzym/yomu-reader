import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import "react-native-url-polyfill/auto";
import { createBackupPayload, restoreBackupFromJson, type BackupData } from "../backupStore";
import { decryptVault, encryptVault, generateRecoveryKey, vaultRecordKey } from "./crypto";
import type { CloudSyncState } from "./types";

WebBrowser.maybeCompleteAuthSession();

const RECOVERY_KEY = "yomu.cloud.recovery-key.v1";
const META_KEY = "@yomu_cloud_sync_meta_v1";
const VAULT_KIND = "vault";
const VAULT_SCHEMA = 1;
const MAX_VAULT_BYTES = 4 * 1024 * 1024;

type VaultRow = { nonce: string; ciphertext: string; schema_version: number; revision: number; updated_at: string };
type Meta = { revision: number; lastSyncedAt?: string };

let client: SupabaseClient | null = null;
let syncTimer: ReturnType<typeof setTimeout> | null = null;
let inFlight: Promise<void> | null = null;
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

const authStorage = {
  getItem: (key: string) => SecureStore.getItemAsync(`yomu.supabase.${key}`),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(`yomu.supabase.${key}`, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(`yomu.supabase.${key}`),
};

function getClient(): SupabaseClient {
  if (!isCloudSyncConfigured()) throw new Error("Yomu Cloud n'est pas configuré dans cette build.");
  if (!client) {
    client = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL!, process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
      auth: { storage: authStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
    });
  }
  return client;
}

function aad(userId: string): string {
  return `yomu-cloud:v${VAULT_SCHEMA}:${userId}`;
}

async function loadMeta(): Promise<Meta> {
  try { return JSON.parse((await AsyncStorage.getItem(META_KEY)) || "{\"revision\":0}") as Meta; } catch { return { revision: 0 }; }
}

async function saveMeta(meta: Meta): Promise<void> {
  await AsyncStorage.setItem(META_KEY, JSON.stringify(meta));
}

async function getRecoveryKey(): Promise<string | null> {
  return SecureStore.getItemAsync(RECOVERY_KEY);
}

function portableBackup(data: BackupData): BackupData {
  const downloadSettings = { ...(data.downloadSettings || {}) };
  for (const key of ["treeUri", "folderUri", "directoryUri", "downloadDirectory", "safUri"]) delete downloadSettings[key];
  return { ...data, version: VAULT_SCHEMA, downloadSettings };
}

function mergeArrays(remote: Record<string, unknown>[] | undefined, local: Record<string, unknown>[] | undefined): Record<string, unknown>[] {
  const identity = (item: Record<string, unknown>) => String(item.globalId || item.id || item.galleryId || JSON.stringify(item));
  const merged = new Map((remote || []).map((item) => [identity(item), item]));
  for (const item of local || []) merged.set(identity(item), item);
  return [...merged.values()];
}

function mergeBackup(remote: BackupData, local: BackupData): BackupData {
  return {
    ...remote,
    ...local,
    exportedAt: new Date().toISOString(),
    favorites: mergeArrays(remote.favorites, local.favorites),
    history: mergeArrays(remote.history, local.history),
    tagCollections: mergeArrays(remote.tagCollections, local.tagCollections),
    libraryCollections: mergeArrays(remote.libraryCollections, local.libraryCollections),
    tagFavorites: { ...(remote.tagFavorites || {}), ...(local.tagFavorites || {}) },
    readerSettings: { ...(remote.readerSettings || {}), ...(local.readerSettings || {}) },
    privacy: { ...(remote.privacy || {}), ...(local.privacy || {}) },
    followsFeed: { ...(remote.followsFeed || {}), ...(local.followsFeed || {}) },
    blacklistTags: [...new Set([...(remote.blacklistTags || []), ...(local.blacklistTags || [])])],
    searchHistory: [...new Set([...(local.searchHistory || []), ...(remote.searchHistory || [])])].slice(0, 200),
  };
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
  const { data, error } = await getClient().from("sync_records").select("nonce,ciphertext,schema_version,revision,updated_at")
    .eq("kind", VAULT_KIND).eq("record_key", vaultRecordKey(recoveryKey)).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as VaultRow;
  return { row, data: decryptVault<BackupData>({ nonce: row.nonce, ciphertext: row.ciphertext, schemaVersion: row.schema_version }, recoveryKey, aad(userId)) };
}

async function writeVault(userId: string, recoveryKey: string, data: BackupData, expectedRevision: number): Promise<number> {
  const serialized = JSON.stringify(data);
  if (serialized.length > MAX_VAULT_BYTES) throw new Error("Le coffre Yomu dépasse 4 Mio. Exportez manuellement vos données.");
  const encrypted = await encryptVault(data, recoveryKey, aad(userId));
  const { data: result, error } = await getClient().rpc("save_yomu_vault", {
    p_record_key: vaultRecordKey(recoveryKey), p_nonce: encrypted.nonce, p_ciphertext: encrypted.ciphertext,
    p_schema_version: encrypted.schemaVersion, p_expected_revision: expectedRevision,
  });
  if (error) throw error;
  const row = Array.isArray(result) ? result[0] : result;
  if (!row?.applied) throw new Error("Conflit de synchronisation. Réessayez.");
  return Number(row.revision);
}

export async function refreshCloudSyncState(): Promise<void> {
  if (!isCloudSyncConfigured()) return emit({ status: "unconfigured", message: "Ajoutez les variables Supabase à la build." });
  try {
    const session = await currentSession();
    if (!session) return emit({ status: "signed_out" });
    const key = await getRecoveryKey();
    const meta = await loadMeta();
    emit({ status: key ? "idle" : "locked", email: session.user.email, lastSyncedAt: meta.lastSyncedAt });
  } catch (error) {
    emit({ status: "error", message: error instanceof Error ? error.message : "Yomu Cloud indisponible." });
  }
}

export async function connectWithGoogle(): Promise<void> {
  const supabase = getClient();
  // Le projet garde deux schémas pour les anciens liens de galerie. OAuth
  // doit toutefois n'en utiliser qu'un, sinon l'URL à autoriser varie selon
  // la plateforme et Google/Supabase refusent le retour.
  const redirectTo = Linking.createURL("cloud-auth", { scheme: "yomureader" });
  const { data, error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo, skipBrowserRedirect: true } });
  if (error || !data.url) throw error || new Error("Impossible de démarrer Google.");
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== "success" || !result.url) throw new Error("Connexion Google annulée.");
  const fragment = result.url.includes("#") ? result.url.slice(result.url.indexOf("#") + 1) : result.url.split("?")[1] || "";
  const params = new URLSearchParams(fragment);
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (!accessToken || !refreshToken) throw new Error(params.get("error_description") || "Google n'a pas renvoyé de session.");
  const { error: sessionError } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
  if (sessionError) throw sessionError;
  await refreshCloudSyncState();
}

export async function createVault(): Promise<string> {
  const session = await currentSession();
  if (!session) throw new Error("Connectez-vous à Google d'abord.");
  const key = await generateRecoveryKey();
  await SecureStore.setItemAsync(RECOVERY_KEY, key);
  const payload = portableBackup(await createBackupPayload());
  const revision = await writeVault(session.user.id, key, payload, 0);
  await saveMeta({ revision, lastSyncedAt: new Date().toISOString() });
  await refreshCloudSyncState();
  return key;
}

export async function unlockVault(recoveryKey: string): Promise<void> {
  const session = await currentSession();
  if (!session) throw new Error("Connectez-vous à Google d'abord.");
  const vault = await readVault(session.user.id, recoveryKey.trim());
  if (!vault) throw new Error("Aucun coffre ne correspond à cette clé.");
  const local = portableBackup(await createBackupPayload());
  // Une installation fraîche contient des réglages par défaut : ils ne doivent
  // jamais écraser les préférences restaurées du coffre distant.
  const restoredData = hasMeaningfulLocalData(local) ? mergeBackup(vault.data, local) : vault.data;
  const restored = await restoreBackupFromJson(JSON.stringify(restoredData));
  if (!restored.success) throw new Error(restored.error || "Restauration impossible.");
  await SecureStore.setItemAsync(RECOVERY_KEY, recoveryKey.trim());
  await saveMeta({ revision: vault.row.revision, lastSyncedAt: vault.row.updated_at });
  await refreshCloudSyncState();
}

export async function syncNow(): Promise<void> {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    const session = await currentSession();
    const key = await getRecoveryKey();
    if (!session || !key) { await refreshCloudSyncState(); return; }
    emit({ status: "syncing", email: session.user.email });
    try {
      const meta = await loadMeta();
      const local = portableBackup(await createBackupPayload());
      let revision = meta.revision;
      try {
        revision = await writeVault(session.user.id, key, local, revision);
      } catch (error) {
        if (!(error instanceof Error) || !error.message.includes("Conflit")) throw error;
        const remote = await readVault(session.user.id, key);
        if (!remote) throw error;
        const merged = mergeBackup(remote.data, local);
        revision = await writeVault(session.user.id, key, merged, remote.row.revision);
      }
      const lastSyncedAt = new Date().toISOString();
      await saveMeta({ revision, lastSyncedAt });
      emit({ status: "idle", email: session.user.email, lastSyncedAt });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Échec de synchronisation.";
      emit({ status: /network|fetch|offline|timeout/i.test(message) ? "offline" : "error", email: session.user.email, message });
    } finally { inFlight = null; }
  })();
  return inFlight;
}

export function scheduleCloudSync(): void {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => { syncTimer = null; void syncNow(); }, 800);
}

export async function disconnectCloud(): Promise<void> {
  if (isCloudSyncConfigured()) await getClient().auth.signOut();
  await Promise.all([SecureStore.deleteItemAsync(RECOVERY_KEY), AsyncStorage.removeItem(META_KEY)]);
  await refreshCloudSyncState();
}

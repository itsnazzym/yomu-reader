import {
  listApiKeys as v2ListApiKeys,
  createApiKey as v2CreateApiKey,
  revokeApiKey as v2RevokeApiKey,
  getAuthStorageReady,
  hasSession,
} from "./api/v2";

export interface ApiKeyItem {
  id: string;
  key_prefix?: string;
  key_preview?: string;
  name: string;
  created_at: number;
  last_used_at?: number | null;
}

export interface ApiKeyCreateResult {
  id: string;
  key: string;
  name: string;
}

export async function listApiKeys(): Promise<ApiKeyItem[]> {
  try {
    await getAuthStorageReady();
    if (!(await hasSession())) {
      return [];
    }

    const rawList = await v2ListApiKeys();
    const list: any[] = Array.isArray(rawList)
      ? rawList
      : (rawList as any)?.keys || (rawList as any)?.result || [];

    return list.map((k: any) => ({
      id: String(k?.id || k?.key_id || Math.random().toString(36).slice(2)),
      name: String(k?.name || "Clé API nHentai"),
      key_prefix: String(k?.key_prefix || k?.key_preview || (k?.key ? String(k.key).slice(0, 8) : "nhk_...")),
      created_at: typeof k?.created_at === "number" ? k.created_at : Math.floor(Date.now() / 1000),
      last_used_at: typeof k?.last_used_at === "number" ? k.last_used_at : null,
    }));
  } catch (err: any) {
    console.warn("[apiKeysStore] listApiKeys caught error:", err);
    return [];
  }
}

export async function createApiKey(name: string): Promise<ApiKeyCreateResult> {
  try {
    await getAuthStorageReady();
    const res = await v2CreateApiKey(name);
    return {
      id: String(res?.id || Date.now()),
      key: String(res?.key || ""),
      name: String(res?.name || name),
    };
  } catch (err: any) {
    console.warn("[apiKeysStore] createApiKey failed:", err);
    throw new Error(err?.message || "Échec de création de la clé API.");
  }
}

export async function deleteApiKey(id: string): Promise<void> {
  try {
    await getAuthStorageReady();
    await v2RevokeApiKey(id);
  } catch (err: any) {
    console.warn("[apiKeysStore] deleteApiKey failed:", err);
    throw new Error(err?.message || "Échec de suppression de la clé API.");
  }
}

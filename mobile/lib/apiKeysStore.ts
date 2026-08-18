import { getMirrorBase } from "./api/nhentai";
import { getAccountSession } from "./accountStore";

export interface ApiKeyItem {
  id: string;
  key_prefix: string;
  name: string;
  created_at: number;
  last_used_at?: number | null;
}

export interface ApiKeyCreateResult {
  id: string;
  key: string;
  name: string;
}

/**
 * La gestion des clés API passe par `/api/v2/user/keys`, authentifié par un
 * **User Token** (refresh_token échangé par le proxy). Une clé API ne peut pas
 * en créer d'autres (chicken-and-egg) : il faut une session refresh_token.
 */
function resolveAuthHeaders(): Record<string, string> | { error: string } {
  const s = getAccountSession();
  const cred = s.sessionId;
  if (!s.isLoggedIn || !cred) {
    return { error: "Connectez-vous d'abord avec votre refresh_token (Compte & Cloud Sync)." };
  }
  if (/^auth_\\d+$/.test(cred)) {
    return {
      error:
        "Session locale invalide : déconnectez-vous puis reconnectez-vous avec votre refresh_token (modale Compte & Cloud Sync).",
    };
  }
  if (s.credentialType === "refresh") {
    return { "X-Refresh-Token": cred };
  }
  return {
    error:
      "La gestion des clés API nécessite un refresh_token — une clé API ne peut pas en créer d'autres. Déconnectez-vous puis connectez-vous avec l'option « refresh_token ».",
  };
}

async function keysRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = resolveAuthHeaders();
  if ("error" in headers) throw new Error(headers.error);
  const res = await fetch(`${getMirrorBase()}${path}`, {
    ...init,
    headers: { ...headers, Accept: "application/json" },
  });
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (body?.error) detail = body.error;
    } catch {}
    throw new Error(detail);
  }
  return (await res.json()) as T;
}

export async function listApiKeys(): Promise<ApiKeyItem[]> {
  return keysRequest<ApiKeyItem[]>("/api/keys");
}

export async function createApiKey(name: string, purpose = ""): Promise<ApiKeyCreateResult> {
  return keysRequest<ApiKeyCreateResult>("/api/keys", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, purpose }),
  });
}

export async function deleteApiKey(id: string): Promise<void> {
  await keysRequest<unknown>(`/api/keys/${encodeURIComponent(id)}`, { method: "DELETE" });
}

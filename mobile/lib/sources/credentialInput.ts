import { SourceError } from "./types";

/** Accept a raw value or the credentials line copied from account options. */
export function parseRule34CredentialInput(text: string): { userId?: string; apiKey?: string } {
  const result: { userId?: string; apiKey?: string } = {};
  for (const match of text.matchAll(/(?:^|[?&\s])(user_id|api_key)=([^&\s]*)/g)) {
    const value = match[2].trim();
    if (value) result[match[1] === "user_id" ? "userId" : "apiKey"] = value;
  }
  return result;
}

/** A successful HTTP status alone does not mean that the API accepted the key. */
export async function readRule34Response(response: Response): Promise<unknown[]> {
  if (response.status === 401 || response.status === 403) {
    throw new SourceError("paywalled", "Clé API Rule34 refusée. Vérifiez votre User ID et votre clé dans les options du compte.");
  }
  if (!response.ok) throw new SourceError("http", `Rule34 HTTP ${response.status}`, response.status);
  const text = await response.text();
  if (!text.trimStart().startsWith("[") && /missing authentication|invalid.*(?:key|auth)|(?:key|auth).*invalid|access denied|unauthorized/i.test(text)) {
    throw new SourceError("paywalled", "Clé API Rule34 invalide ou expirée. Générez une nouvelle clé dans les options de votre compte.");
  }
  let data: unknown;
  try { data = JSON.parse(text); } catch {
    throw new SourceError("parse", "Réponse Rule34 illisible. Réessayez dans quelques instants.");
  }
  if (!Array.isArray(data)) throw new SourceError("parse", "Réponse Rule34 inattendue. Réessayez dans quelques instants.");
  if (!data.every(post => post && typeof post === "object" && /^\d+$/.test(String(post.id)) &&
    ["tags", "file_url", "sample_url", "preview_url"].every(key => post[key] == null || typeof post[key] === "string"))) {
    throw new SourceError("parse", "Données Rule34 incomplètes. Réessayez dans quelques instants.");
  }
  return data;
}

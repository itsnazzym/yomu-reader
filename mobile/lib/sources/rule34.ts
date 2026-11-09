/**
 * Adaptateur Rule34 (rule34.xxx booru API).
 *
 * Fonctionnalités clés :
 * - API JSON native haute performance (dapi post index).
 * - Support de l'authentification isolée (User ID + API Key).
 * - Nettoyage automatique des opérateurs nHentai (language:english, etc.).
 * - Signalisation claire de l'état d'authentification requis.
 * - Extraction et typage des tags et médias haute résolution.
 */

import { Platform } from "react-native";
import {
  makeGlobalId,
  SourceError,
  type SourceAdapter,
  type SourceGallery,
  type SourceGalleryCard,
  type SourceMeta,
  type SourceSearchOptions,
  type SourceTag,
  type SourceTaxonomyItem,
} from "./types";
import { getSourceAuth } from "./authStore";
import { stripNhentaiOperators } from "./html";

const BASE_URL = "https://rule34.xxx";
const API_URL = "https://api.rule34.xxx/index.php";
const TIMEOUT_MS = 12000;

const HEADERS: Record<string, string> = {
  "User-Agent":
    Platform.OS === "android"
      ? "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36"
      : "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  Accept: "application/json",
};

export interface Rule34PostItem {
  id: number | string;
  preview_url?: string;
  sample_url?: string;
  file_url?: string;
  directory?: string;
  image?: string;
  tags?: string;
  score?: number | string;
  rating?: string;
  width?: number;
  height?: number;
  owner?: string;
  created_at?: string;
  change?: number;
}

/** Formate un titre représentatif à partir des tags et de l'id du post. */
export function buildRule34Title(id: string | number, tagsStr?: string): string {
  if (!tagsStr) return `Rule34 #${id}`;
  const rawTags = tagsStr.trim().split(/\s+/).filter(Boolean);
  if (rawTags.length === 0) return `Rule34 #${id}`;

  const candidateTags = rawTags
    .filter((t) => !t.startsWith("rating:") && !t.startsWith("score:"))
    .slice(0, 3)
    .map((t) => t.replace(/_/g, " "));

  const summary = candidateTags.join(", ");
  return summary ? `${summary} (#${id})` : `Rule34 #${id}`;
}

export function parseRule34Tags(tagsStr?: string): SourceTag[] {
  if (!tagsStr) return [];
  const rawTags = tagsStr.trim().split(/\s+/).filter(Boolean);
  return rawTags.map((t) => {
    const clean = t.replace(/_/g, " ");
    return {
      name: clean,
      type: "tag",
    };
  });
}

export class Rule34Source implements SourceAdapter {
  capabilities = {
    search: true,
    pagination: true,
    tags: true,
    random: false,
  } as const;

  meta: SourceMeta = {
    id: "rule34",
    label: "Rule34",
    baseUrl: BASE_URL,
    accentColor: "#7ebd78",
    supportsLogin: true,
    supportsComments: false,
  };

  private async getAuthQueryParams(): Promise<string> {
    try {
      const auth = await getSourceAuth("rule34");
      if (auth.isLoggedIn && auth.credentials?.userId && auth.credentials?.apiKey) {
        return `&user_id=${encodeURIComponent(auth.credentials.userId)}&api_key=${encodeURIComponent(
          auth.credentials.apiKey
        )}`;
      }
    } catch {}
    return "";
  }

  async search(opts: SourceSearchOptions): Promise<{ cards: SourceGalleryCard[]; hasMore: boolean }> {
    const pageIndex = Math.max(0, (opts.page || 1) - 1);
    const authParams = await this.getAuthQueryParams();

    if (!authParams) {
      throw new SourceError(
        "paywalled",
        "Rule34 exige une clé API personnelle gratuite (api.rule34.xxx). Liez votre compte dans Paramètres > Sources."
      );
    }

    // Nettoyage des opérateurs nHentai (ex: language:english) incompatibles avec le booru
    const cleanQuery = stripNhentaiOperators(opts.query) || "";
    const url = `${API_URL}?page=dapi&s=post&q=index&json=1&limit=40&pid=${pageIndex}&tags=${encodeURIComponent(
      cleanQuery
    )}${authParams}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const res = await fetch(url, { headers: HEADERS, signal: controller.signal });
      if (!res.ok) {
        throw new SourceError("http", `Rule34 HTTP ${res.status}`, res.status);
      }

      const text = await res.text();
      if (text.includes("Missing authentication")) {
        throw new SourceError(
          "paywalled",
          "Clé API Rule34 invalide ou expirée. Rendez-vous sur rule34.xxx/index.php?page=account&s=options pour générer votre clé."
        );
      }

      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        return { cards: [], hasMore: false };
      }

      if (!Array.isArray(json)) {
        return { cards: [], hasMore: false };
      }

      const cards: SourceGalleryCard[] = json.map((p: Rule34PostItem) => {
        const idStr = String(p.id);
        const cover = p.sample_url || p.preview_url || p.file_url || "";
        const tags = parseRule34Tags(p.tags);
        const score = typeof p.score === "number" ? p.score : parseInt(String(p.score || 0), 10);

        return {
          globalId: makeGlobalId("rule34", idStr),
          title: buildRule34Title(idStr, p.tags),
          coverUrl: cover,
          numPages: 1,
          uploadDate: p.change ? p.change * 1000 : undefined,
          tags,
          rating: Number.isFinite(score) ? score : undefined,
          uploader: p.owner,
        };
      });

      return {
        cards,
        hasMore: cards.length >= 40,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  async getGallery(nativeId: string): Promise<SourceGallery> {
    const cleanId = nativeId.trim();
    const authParams = await this.getAuthQueryParams();
    if (!authParams) {
      throw new SourceError(
        "paywalled",
        "Rule34 exige une clé API personnelle gratuite. Liez votre compte dans Paramètres > Sources."
      );
    }

    const url = `${API_URL}?page=dapi&s=post&q=index&json=1&id=${encodeURIComponent(cleanId)}${authParams}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const res = await fetch(url, { headers: HEADERS, signal: controller.signal });
      if (!res.ok) {
        throw new SourceError("http", `Rule34 HTTP ${res.status}`, res.status);
      }

      const text = await res.text();
      if (text.includes("Missing authentication")) {
        throw new SourceError("paywalled", "Clé API Rule34 invalide.");
      }

      const json = JSON.parse(text);
      const post: Rule34PostItem | undefined = Array.isArray(json) ? json[0] : json;

      if (!post || !post.id) {
        throw new SourceError("not_found", `Post Rule34 #${cleanId} introuvable.`);
      }

      const mainImageUrl = post.file_url || post.sample_url || post.preview_url || "";
      const tags = parseRule34Tags(post.tags);
      const score = typeof post.score === "number" ? post.score : parseInt(String(post.score || 0), 10);

      return {
        globalId: makeGlobalId("rule34", cleanId),
        nativeId: cleanId,
        title: buildRule34Title(cleanId, post.tags),
        coverUrl: post.sample_url || post.preview_url || mainImageUrl,
        numPages: 1,
        uploadDate: post.change ? post.change * 1000 : undefined,
        tags,
        rating: Number.isFinite(score) ? score : undefined,
        uploader: post.owner,
        pageUrls: [
          {
            url: mainImageUrl,
            width: post.width,
            height: post.height,
          },
        ],
      };
    } finally {
      clearTimeout(timer);
    }
  }

  async getTags(): Promise<SourceTaxonomyItem[]> {
    const authParams = await this.getAuthQueryParams();
    const url = `${API_URL}?page=dapi&s=tag&q=index&json=1&limit=60&order=count${authParams}`;
    try {
      const res = await fetch(url, { headers: HEADERS });
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json)) {
          return json.map((t: { name?: string; count?: number | string }) => ({
            name: (t.name || "").replace(/_/g, " "),
            count: typeof t.count === "number" ? t.count : parseInt(String(t.count || 0), 10),
          }));
        }
      }
    } catch {}
    return [];
  }

  async healthCheck(): Promise<{ ok: boolean; latencyMs: number; error?: string }> {
    const startedAt = Date.now();
    try {
      const authParams = await this.getAuthQueryParams();
      const res = await fetch(`${API_URL}?page=dapi&s=post&q=index&json=1&limit=1${authParams}`, {
        headers: HEADERS,
      });
      return { ok: res.ok, latencyMs: Date.now() - startedAt };
    } catch (err) {
      return {
        ok: false,
        latencyMs: Date.now() - startedAt,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}

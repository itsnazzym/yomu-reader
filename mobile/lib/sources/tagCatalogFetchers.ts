import { SourceError, type SourceTaxonomyItem } from "./types";
import { getSourceAuth } from "./authStore";
import { decodeEntities } from "./html";
import { dedupeTags } from "./tagUtils";

const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";

async function request(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 18000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": BROWSER_USER_AGENT,
        Accept: "application/json,text/html,application/xml,*/*",
      },
    });
    if (!response.ok) {
      throw new SourceError(
        response.status === 401 || response.status === 403 ? "paywalled" : "http",
        `Répertoire de tags indisponible (HTTP ${response.status}).`,
        response.status
      );
    }
    return response;
  } finally {
    clearTimeout(timer);
  }
}

export function parseEhTagDatabase(input: unknown): SourceTaxonomyItem[] {
  if (!input || typeof input !== "object" || !("data" in input) || !Array.isArray(input.data)) {
    throw new SourceError("parse", "Répertoire E-Hentai illisible.");
  }
  const tags: SourceTaxonomyItem[] = [];
  for (const row of input.data) {
    if (
      !row ||
      typeof row.namespace !== "string" ||
      row.namespace === "rows" ||
      !row.data ||
      typeof row.data !== "object" ||
      Array.isArray(row.data)
    ) {
      continue;
    }
    for (const name of Object.keys(row.data)) {
      if (name.trim()) {
        tags.push({ name, type: row.namespace === "reclass" ? "category" : row.namespace });
      }
    }
  }
  if (!tags.length) throw new SourceError("parse", "Le répertoire E-Hentai est vide.");
  return dedupeTags(tags);
}

export async function fetchEhTagDatabase(): Promise<SourceTaxonomyItem[]> {
  return parseEhTagDatabase(
    await (
      await request(
        "https://github.com/EhTagTranslation/Database/releases/latest/download/db.text.json"
      )
    ).json()
  );
}

export function parseHitomiTagDirectory(html: string): SourceTaxonomyItem[] {
  const tags: SourceTaxonomyItem[] = [];
  for (const match of html.matchAll(
    /<a\b[^>]*href=["']\/tag\/([^"']+)-all\.html["'][^>]*>[\s\S]*?<\/a>\s*(?:\(([\d,]+)\))?/gi
  )) {
    let native: string;
    try {
      native = decodeURIComponent(decodeEntities(match[1]));
    } catch {
      continue;
    }
    const typed = native.match(/^(female|male):(.+)$/i);
    tags.push({
      name: typed ? typed[2] : native,
      type: typed ? typed[1].toLowerCase() : "tag",
      count: match[2] ? Number(match[2].replace(/,/g, "")) : undefined,
    });
  }
  return dedupeTags(tags);
}

export async function fetchHitomiTagDirectory(): Promise<SourceTaxonomyItem[]> {
  const letters = ["123", ..."abcdefghijklmnopqrstuvwxyz"];
  const tags: SourceTaxonomyItem[] = [];
  for (let i = 0; i < letters.length; i += 4) {
    const pages = await Promise.all(
      letters
        .slice(i, i + 4)
        .map(async (letter) => (await request(`https://hitomi.la/alltags-${letter}.html`)).text())
    );
    for (const html of pages) tags.push(...parseHitomiTagDirectory(html));
  }
  if (!tags.length) throw new SourceError("parse", "Répertoire Hitomi vide ou illisible.");
  return dedupeTags(tags);
}

export function parseRule34TagPage(data: unknown): SourceTaxonomyItem[] {
  if (!Array.isArray(data)) {
    if (data && typeof data === "object") {
      const candidate = (data as any).tag || (data as any).tags;
      if (Array.isArray(candidate)) return parseRule34TagPage(candidate);
    }
    throw new SourceError("parse", "Réponse du répertoire Rule34 illisible.");
  }
  for (const row of data) {
    if (!row || typeof row !== "object") throw new SourceError("parse", "Tag Rule34 invalide.");
  }
  return data
    .filter(
      (row: any) =>
        row &&
        typeof (row.name ?? row.tag ?? row.value) === "string" &&
        String(row.name ?? row.tag ?? row.value).trim()
    )
    .map((row: any) => {
      const name = String(row.name ?? row.tag ?? row.value).trim();
      const type =
        ({ 1: "artist", 3: "parody", 4: "character" } as Record<number, string>)[Number(row.type)] ||
        "tag";
      const count = Number(row.count ?? row.post_count);
      return {
        name,
        type,
        id: String(row.id ?? name),
        count: Number.isFinite(count) ? count : undefined,
      };
    });
}

export async function fetchRule34TagPage(
  page: number
): Promise<{ tags: SourceTaxonomyItem[]; hasMore: boolean }> {
  const auth = await getSourceAuth("rule34");
  if (!auth.isLoggedIn || !auth.credentials?.userId || !auth.credentials?.apiKey) {
    throw new SourceError("paywalled", "Configurez votre clé API Rule34 pour charger ses tags.");
  }

  const url = new URL("https://api.rule34.xxx/index.php");
  for (const [key, value] of Object.entries({
    page: "dapi",
    s: "tag",
    q: "index",
    json: "1",
    limit: "1000",
    pid: String(page),
    order: "id",
    user_id: auth.credentials.userId,
    api_key: auth.credentials.apiKey,
  })) {
    url.searchParams.set(key, value);
  }

  const response = await request(url.toString());
  const text = await response.text();

  if (/missing authentication|invalid.*key|access denied/i.test(text)) {
    throw new SourceError("paywalled", "Clé API Rule34 refusée. Vérifiez votre connexion.");
  }

  // Fallback XML si l'API renvoie du XML
  if (text.trimStart().startsWith("<")) {
    const matches = [...text.matchAll(/<tag\b([^>]*)\/?>/gi)];
    if (matches.length > 0) {
      const tags: SourceTaxonomyItem[] = [];
      for (const m of matches) {
        const attrStr = m[1] || "";
        const nameMatch = attrStr.match(/\bname=["']([^"']+)["']/i);
        if (!nameMatch) continue;
        const name = decodeEntities(nameMatch[1].trim());
        const typeMatch = attrStr.match(/\btype=["'](\d+)["']/i);
        const countMatch = attrStr.match(/\bcount=["'](\d+)["']/i);
        const idMatch = attrStr.match(/\bid=["'](\d+)["']/i);
        const typeNum = typeMatch ? Number(typeMatch[1]) : 0;
        const type =
          ({ 1: "artist", 3: "parody", 4: "character" } as Record<number, string>)[typeNum] ||
          "tag";
        const count = countMatch ? Number(countMatch[1]) : undefined;
        tags.push({
          name,
          type,
          id: idMatch ? idMatch[1] : name,
          count,
        });
      }
      return { tags, hasMore: tags.length >= 1000 };
    }
  }

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new SourceError("parse", "Répertoire Rule34 illisible. Réessayez.");
  }

  const tags = parseRule34TagPage(data);
  return { tags, hasMore: tags.length === 1000 };
}

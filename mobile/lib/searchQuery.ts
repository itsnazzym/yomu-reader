/**
 * Parse / compose nHentai search queries (`artist:A tag:"foo bar"`).
 * Used to append/remove/toggle tags without replacing the current search.
 */

const TOKEN_RE = /(?:-?[^\s:]+:"[^"]+"|-?"[^"]+"|-?[^\s:]+:[^\s]+|[^\s]+)/g;

export function normalizeTagType(type: string): string {
  const clean = (type || "").trim().toLowerCase();
  if (clean === "tags") return "tag";
  if (clean === "artists") return "artist";
  if (clean === "parodies" || clean === "parodys") return "parody";
  if (clean === "characters") return "character";
  if (clean === "groups") return "group";
  if (clean === "languages") return "language";
  if (clean === "categories") return "category";
  return clean || "tag";
}

export function formatSearchTerm(type: string, name: string): string {
  const cleanType = normalizeTagType(type);
  const cleanName = name.trim();
  if (!cleanName) return "";
  return cleanName.includes(" ") ? `${cleanType}:"${cleanName}"` : `${cleanType}:${cleanName}`;
}

export function tokenizeSearchQuery(query: string): string[] {
  const tokens: string[] = [];
  const source = query.trim();
  if (!source) return tokens;
  TOKEN_RE.lastIndex = 0;
  let match: RegExpExecArray | null = TOKEN_RE.exec(source);
  while (match) {
    tokens.push(match[0]);
    match = TOKEN_RE.exec(source);
  }
  return tokens;
}

export function normalizeSearchTerm(term: string): string {
  const trimmed = term.trim().toLowerCase();
  const typed = trimmed.match(/^([a-z]+):"?(.+?)"?$/);
  if (!typed) return trimmed;
  return `${normalizeTagType(typed[1])}:${typed[2]}`;
}

export function matchTokenToTag(token: string, type: string, name: string): boolean {
  const cleanToken = token.trim();
  if (!cleanToken || cleanToken.startsWith("-")) return false;

  const targetType = normalizeTagType(type);
  const targetName = name.trim().toLowerCase();
  if (!targetName) return false;

  const colonIndex = cleanToken.indexOf(":");
  if (colonIndex !== -1) {
    const tokenTypeRaw = cleanToken.slice(0, colonIndex);
    const tokenValRaw = cleanToken.slice(colonIndex + 1);
    const tokenType = normalizeTagType(tokenTypeRaw);
    const tokenVal = tokenValRaw.replace(/^"|"$/g, "").trim().toLowerCase();

    return tokenType === targetType && tokenVal === targetName;
  }

  const tokenVal = cleanToken.replace(/^"|"$/g, "").trim().toLowerCase();
  return tokenVal === targetName;
}

export function queryContainsTerm(query: string, type: string, name: string): boolean {
  return tokenizeSearchQuery(query).some((token) => matchTokenToTag(token, type, name));
}

export function appendSearchTerm(
  query: string,
  type: string,
  name: string
): { query: string; added: boolean; term: string } {
  const term = formatSearchTerm(type, name);
  if (!term) {
    return { query: query.trim(), added: false, term: "" };
  }
  const tokens = tokenizeSearchQuery(query);
  if (tokens.some((token) => matchTokenToTag(token, type, name))) {
    return { query: tokens.join(" "), added: false, term };
  }
  const next = tokens.length > 0 ? `${tokens.join(" ")} ${term}` : term;
  return { query: next, added: true, term };
}

export function removeSearchTerm(
  query: string,
  type: string,
  name: string
): { query: string; removed: boolean; term: string } {
  const term = formatSearchTerm(type, name);
  const tokens = tokenizeSearchQuery(query);
  const remaining = tokens.filter((token) => !matchTokenToTag(token, type, name));
  const removed = remaining.length < tokens.length;
  return {
    query: remaining.join(" "),
    removed,
    term: term || name,
  };
}

export function toggleSearchTerm(
  query: string,
  type: string,
  name: string
): { query: string; added: boolean; removed: boolean; term: string } {
  if (queryContainsTerm(query, type, name)) {
    const res = removeSearchTerm(query, type, name);
    return {
      query: res.query,
      added: false,
      removed: res.removed,
      term: res.term,
    };
  } else {
    const res = appendSearchTerm(query, type, name);
    return {
      query: res.query,
      added: res.added,
      removed: false,
      term: res.term,
    };
  }
}

export function replaceSearchQuery(type: string, name: string): string {
  return formatSearchTerm(type, name);
}

export function firstRouteParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
}

/**
 * Utilitaires de scraping HTML partagés par les adaptateurs de sources.
 *
 * Fonctions pures (aucun import RN) : testables dans node --test via le
 * bundle esbuild. Pas de DOMParser — des regex ciblées sur du HTML
 * server-rendered, comme les extensions Mihon.
 */

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  "#39": "'",
  eacute: "é",
  egrave: "è",
  agrave: "à",
  ccedil: "ç",
  ugrave: "ù",
  ecirc: "ê",
  ocirc: "ô",
  icirc: "î",
  acirc: "â",
  ucirc: "û",
  laquo: "«",
  raquo: "»",
  hellip: "…",
  rsquo: "’",
  lsquo: "‘",
  ldquo: "“",
  rdquo: "”",
  mdash: "—",
  ndash: "–",
};

/** Décode les entités HTML nommées courantes et numériques. */
export function decodeEntities(input: string): string {
  return input
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) =>
      String.fromCodePoint(parseInt(hex, 16))
    )
    .replace(/&#(\d+);/g, (_, dec: string) =>
      String.fromCodePoint(parseInt(dec, 10))
    )
    .replace(/&([a-zA-Z#0-9]+);/g, (full, name: string) => {
      const key = name.toLowerCase();
      return ENTITIES[key] ?? full;
    });
}

/** Retire les balises et normalise les espaces. */
export function stripTags(input: string): string {
  return decodeEntities(input.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Retourne tous les groupes capturés pour chaque correspondance du pattern.
 * Renvoie string[][] — [][0] est le match complet si le pattern capture.
 */
export function extractMatches(html: string, pattern: RegExp): string[][] {
  const out: string[][] = [];
  const re = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    out.push(m.slice());
    if (m.index === re.lastIndex) re.lastIndex++;
  }
  return out;
}

/** Extrait la valeur d'un attribut depuis une balise (string brute). */
export function extractAttribute(tag: string, attr: string): string | null {
  const re = new RegExp(`${attr}\\s*=\\s*["']([^"']*)["']`, "i");
  const m = tag.match(re);
  return m ? decodeEntities(m[1]) : null;
}

/**
 * Retire les opérateurs nHentai (`language:english`, `pages:>20`…) d'une
 * requête avant de l'envoyer à une autre source.
 */
export function stripNhentaiOperators(query: string | undefined): string | undefined {
  if (!query) return undefined;
  const cleaned = query
    .replace(
      /\b(?:language|pages|uploaded|comments|favorites|category|order):(?:"[^"]+"|\S+)/gi,
      " "
    )
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || undefined;
}

/**
 * Traduit une requête nhentai pour les sources alternatives (3hentai,
 * doujins) qui n'ont que des recherches plein texte : on CONSERVE les
 * valeurs (`tag:"vanilla" language:english` → `vanilla english`) au lieu
 * de les jeter, et on retire les préfixes d'opérateurs non supportés.
 */
export function translateQueryForSource(
  query: string | undefined
): string | undefined {
  if (!query) return undefined;
  const cleaned = query
    // Valeurs d'opérateurs quotées : garde la valeur, jette le préfixe
    // (et l'éventuelle négation "-" qui n'a pas d'équivalent plein texte).
    .replace(/-?\b[a-z]+:\s*"([^"]+)"/gi, "$1")
    // Valeurs simples (pages:>20, language:english, -tag:"x"...) : garde la
    // valeur sauf pour les filtres techniques sans valeur textuelle utile.
    .replace(/\b(?:pages|uploaded|comments|favorites|order):"?[<>!]?\s*[^"\s]*"?(?=\s|$)/gi, " ")
    .replace(/\b(?:language|category|tag|artist|parody|character|group):\s*([^"\s]+)/gi, "$1")
    .replace(/"/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || undefined;
}

/** Enlève le suffixe srcset (` 2x`) et décode les entités d'une URL média. */
export function sanitizeMediaUrl(raw: string): string {
  if (!raw) return "";
  return decodeEntities(raw)
    .trim()
    .replace(/\s+\d+x$/i, "")
    .trim();
}

/** Nettoie une URL relative en absolue par rapport à la base d'une source. */
export function absoluteUrl(base: string, url: string): string {
  if (!url) return url;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("//")) return `https:${url}`;
  return `${base.replace(/\/$/, "")}/${url.replace(/^\//, "")}`;
}

const FILTERED = "[Filtered]";

function sensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, "");
  return /cookie|authorization|password|passwd|secret|token|session|apikey|csrf|credential|recoverykey|nonce/.test(normalized);
}

function scrubText(value: string): string {
  return value
    .replace(/https?:\/\/[^\s<>"']+/gi, (raw) => {
      try {
        const url = new URL(raw);
        if (url.username || url.password) { url.username = ""; url.password = ""; }
        // OAuth fragments and query values can contain credentials with arbitrary names.
        if (url.search) url.search = "?[Filtered]";
        if (url.hash) url.hash = "#[Filtered]";
        return url.toString();
      } catch { return "[Filtered URL]"; }
    })
    .replace(/\b(?:Bearer|Basic|Key|User)\s+[A-Za-z0-9_.~+\/-]{8,}=*/gi, FILTERED)
    .replace(/(["']?(?:[\w-]*(?:token|password|cookie|authorization|api[_-]?key|secret|session|credential|recovery[_-]?key)[\w-]*)["']?\s*[:=]\s*)(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\s,;&}]+)/gi, `$1${FILTERED}`)
    .replace(/\b(?:nhentai|3hentai|doujins|hitomi):\d+\b/gi, "[gallery]")
    .replace(/\/g\/\d+/gi, "/g/[id]")
    .replace(/gallery[_-]?\d{4,}/gi, "gallery_[id]");
}

/** For diagnostics only; never use a redacted value to make an authenticated request. */
export function redactSecrets(value: unknown): unknown {
  const seen = new WeakSet<object>();
  function scrub(key: string, item: unknown, depth: number): unknown {
    if (sensitiveKey(key)) return FILTERED;
    if (typeof item === "string") return scrubText(item);
    if (item && typeof item === "object") {
      if (depth > 12 || seen.has(item)) return FILTERED;
      seen.add(item);
      if (Array.isArray(item)) return item.map((entry) => scrub("", entry, depth + 1));
      const output: Record<string, unknown> = {};
      for (const [name, entry] of Object.entries(item)) output[name] = scrub(name, entry, depth + 1);
      return output;
    }
    return item;
  }
  return scrub("", value, 0);
}

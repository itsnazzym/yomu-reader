import type { EhentaiCookies } from "./authStore";

export const EH_LOGIN_URL = "https://forums.e-hentai.org/index.php?act=Login&CODE=00";
export const EH_COOKIE_URLS = ["https://forums.e-hentai.org", "https://e-hentai.org", "https://exhentai.org"];
const COOKIE_NAMES = ["ipb_member_id", "ipb_pass_hash", "igneous", "star", "sk"];

export function isEhAuthNavigation(raw: string): boolean {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && (["forums.e-hentai.org", "e-hentai.org", "exhentai.org", "challenges.cloudflare.com"].includes(url.hostname));
  } catch { return false; }
}

export interface EhCookieJar {
  get(url: string, webkit?: boolean): Promise<Record<string, { value: string }>>;
  set(url: string, cookie: { name: string; value: string; domain: string; path: string; secure: boolean; httpOnly: boolean; expires?: string }, webkit?: boolean): Promise<boolean>;
}

/** Read native cookies, including HttpOnly, without exposing them to page scripts. */
export async function readEhBrowserCookies(jar: EhCookieJar): Promise<EhentaiCookies | null> {
  const cookies: Record<string, string> = {};
  for (const url of EH_COOKIE_URLS.slice(0, 2)) {
    const values = await jar.get(url, true);
    for (const name of COOKIE_NAMES) if (values[name]?.value) cookies[name] = values[name].value;
  }
  if (!/^[1-9]\d*$/.test(cookies.ipb_member_id || "") || !cookies.ipb_pass_hash || cookies.ipb_pass_hash === "session") return null;
  return cookies as EhentaiCookies;
}

export async function seedExBrowserCookies(jar: EhCookieJar, cookies: EhentaiCookies): Promise<void> {
  // ExHentai uses the same account, but a separate cookie domain.
  for (const name of ["ipb_member_id", "ipb_pass_hash"]) {
    const ok = await jar.set("https://exhentai.org", { name, value: cookies[name]!, domain: ".exhentai.org", path: "/", secure: true, httpOnly: true }, true);
    if (!ok) throw new Error("Impossible de préparer la session ExHentai.");
  }
}

export async function clearEhBrowserCookies(jar: EhCookieJar): Promise<void> {
  for (const url of EH_COOKIE_URLS) {
    const host = new URL(url).hostname;
    for (const domain of [host, host.endsWith("e-hentai.org") ? ".e-hentai.org" : ".exhentai.org"]) {
      for (const name of COOKIE_NAMES) {
        const removed = await jar.set(url, { name, value: "", domain, path: "/", secure: true, httpOnly: true, expires: "1970-01-01T00:00:00.000Z" }, true);
        if (!removed) throw new Error("Impossible d’effacer la précédente session du navigateur.");
      }
    }
  }
}

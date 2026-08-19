import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

// The project's release folder lives one level above the web/ workspace.
const RELEASE_DIR = path.resolve(process.cwd(), "../release");

export interface ReleaseFile {
  fileName: string; // real file name on disk (with spaces)
  url: string; // encoded URL for the download route
  label: string; // human name shown on the page
  kind: "setup" | "portable" | "other";
  platform: "windows" | "android" | "linux" | "macos";
  sizeBytes: number;
  sizeHuman: string;
  sha512?: string;
}

interface Classified {
  fileName: string;
  url: string;
  label: string;
  kind: "setup" | "portable" | "other";
  platform: "windows" | "android" | "linux" | "macos";
}

function humanSize(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

function sha512Of(filePath: string): string | undefined {
  try {
    return crypto.createHash("sha512").update(fs.readFileSync(filePath)).digest("base64");
  } catch {
    return undefined;
  }
}

function classify(fileName: string): Classified {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".apk")) {
    return { fileName, url: encodeURIComponent(fileName), label: "Android APK", kind: "other", platform: "android" };
  }
  if (lower.includes("setup") && lower.endsWith(".exe")) {
    return { fileName, url: encodeURIComponent(fileName), label: "Windows Installer (NSIS)", kind: "setup", platform: "windows" };
  }
  if (lower.endsWith(".exe") && !lower.includes("unpacked")) {
    return { fileName, url: encodeURIComponent(fileName), label: "Windows Portable", kind: "portable", platform: "windows" };
  }
  if (lower.endsWith(".deb")) {
    return { fileName, url: encodeURIComponent(fileName), label: "Linux (.deb)", kind: "other", platform: "linux" };
  }
  if (lower.endsWith(".appimage")) {
    return { fileName, url: encodeURIComponent(fileName), label: "Linux (AppImage)", kind: "other", platform: "linux" };
  }
  if (lower.endsWith(".dmg")) {
    return { fileName, url: encodeURIComponent(fileName), label: "macOS (.dmg)", kind: "other", platform: "macos" };
  }
  return { fileName, url: encodeURIComponent(fileName), label: fileName, kind: "other", platform: "windows" };
}

/** Real installer files present in release/ at build time. */
export function getReleaseFiles(): ReleaseFile[] {
  if (!fs.existsSync(RELEASE_DIR)) return [];
  const entries = fs.readdirSync(RELEASE_DIR, { withFileTypes: true });
  const files = entries
    .filter((e) => e.isFile())
    .map((e) => e.name)
    .filter((name) => /\.(exe|apk|deb|appimage|dmg)$/i.test(name))
    .filter((name) => !name.toLowerCase().includes("unpacked"))
    .filter((name) => !name.toLowerCase().endsWith(".blockmap"));

  const seen = new Set<string>();
  return files
    .map((name) => {
      const base = classify(name);
      const filePath = path.join(RELEASE_DIR, name);
      const sizeBytes = fs.statSync(filePath).size;
      const key = `${base.platform}-${base.kind}`;
      if (seen.has(key)) return null;
      seen.add(key);
      return {
        ...base,
        sizeBytes,
        sizeHuman: humanSize(sizeBytes),
        sha512: base.kind === "setup" ? sha512Of(filePath) : undefined,
      };
    })
    .filter(Boolean) as ReleaseFile[];
}

/** Resolve a requested file name against release/ (prevents path traversal). */
export function resolveReleaseFile(fileName: string): string | null {
  const safe = path.basename(fileName);
  const full = path.resolve(RELEASE_DIR, safe);
  if (!full.startsWith(path.resolve(RELEASE_DIR))) return null;
  if (!fs.existsSync(full) || !fs.statSync(full).isFile()) return null;
  return full;
}

export const releaseVersion = "1.0.0";

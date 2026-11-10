import fs from "node:fs";
import path from "node:path";

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
  version?: string;
  architecture?: string;
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

type ManifestEntry = { fileName: string; version: string; architecture: string; sizeBytes: number; sha512: string };
function readManifest(): { version: string; files: ManifestEntry[] } | null {
  try {
    const file=path.join(RELEASE_DIR,"release-manifest.json");
    if(fs.statSync(file).size>1024*1024)return null;
    const value=JSON.parse(fs.readFileSync(file,"utf8"));
    if(!/^\d+\.\d+\.\d+$/.test(value.version)||!Array.isArray(value.files)||value.files.length>500)return null;
    if(value.files.some((entry: ManifestEntry)=>!entry||typeof entry.fileName!=="string"||entry.fileName!==path.basename(entry.fileName)||!/^\d+\.\d+\.\d+$/.test(entry.version)||!Number.isSafeInteger(entry.sizeBytes)||entry.sizeBytes<0||! /^[A-Za-z0-9+/]{86}==$/.test(entry.sha512)||!["arm64","armv7","x64","x86","universal","unknown"].includes(entry.architecture)))return null;
    return value;
  } catch {
    return null;
  }
}

function architectureOf(name: string): string {
  if(/universal/i.test(name))return "universal";
  if(/arm64|aarch64/i.test(name))return "arm64";
  if(/armeabi|armv7/i.test(name))return "armv7";
  if(/x86_64|x64/i.test(name))return "x64";
  if(/x86|ia32/i.test(name))return "x86";
  return /\.exe$/i.test(name)?"x64":"universal";
}
function versionOf(name: string): string {return name.match(/(?:^|[-_v])(\d+\.\d+\.\d+)/)?.[1]||"0.0.0";}
function compareVersions(left:string,right:string):number {const a=left.split(".").map(Number),b=right.split(".").map(Number);return (a[0]-b[0])||(a[1]-b[1])||(a[2]-b[2]);}

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
  const manifest=readManifest();
  const metadata=new Map(manifest?.files.map(entry=>[entry.fileName,entry]));
  const files = entries
    .filter((e) => e.isFile())
    .map((e) => e.name)
    .filter((name) => /\.(exe|apk|deb|appimage|dmg)$/i.test(name))
    .filter((name) => !name.toLowerCase().includes("unpacked"))
    .filter((name) => !/debug/i.test(name))
    .filter((name) => !name.toLowerCase().endsWith(".blockmap"))
    .sort((a,b)=>compareVersions(metadata.get(b)?.version||versionOf(b),metadata.get(a)?.version||versionOf(a))||a.localeCompare(b));

  const seen = new Set<string>();
  return files
    .map((name) => {
      const base = classify(name);
      const filePath = path.join(RELEASE_DIR, name);
      const sizeBytes = fs.statSync(filePath).size;
      const record=metadata.get(name);
      const architecture=record?.architecture||architectureOf(name);
      const key = `${base.platform}-${base.kind}-${architecture}`;
      if (seen.has(key)) return null;
      seen.add(key);
      return {
        ...base,
        label: base.platform==="android"?`Android APK · ${architecture}`:base.label,
        architecture,
        version:record?.version||versionOf(name),
        sizeBytes,
        sizeHuman: humanSize(sizeBytes),
        sha512: record?.sizeBytes===sizeBytes?record.sha512:undefined,
      };
    })
    .filter(Boolean) as ReleaseFile[];
}

function isPathInside(parent: string, candidate: string): boolean {
  const relative = path.relative(parent, candidate);
  return relative === "" || (!path.isAbsolute(relative) && relative !== ".." && !relative.startsWith(`..${path.sep}`));
}

/** Resolve a requested file name against release/, including its real path. */
export function resolveReleaseFile(fileName: string): string | null {
  if (!fileName || fileName !== path.basename(fileName)) return null;

  try {
    const releaseRoot = fs.realpathSync(RELEASE_DIR);
    const candidate = path.resolve(releaseRoot, fileName);
    if (!isPathInside(releaseRoot, candidate)) return null;

    const linkInfo = fs.lstatSync(candidate);
    if (linkInfo.isSymbolicLink() || !linkInfo.isFile()) return null;

    const realCandidate = fs.realpathSync(candidate);
    if (!isPathInside(releaseRoot, realCandidate) || !fs.statSync(realCandidate).isFile()) {
      return null;
    }
    return realCandidate;
  } catch {
    return null;
  }
}

export function createAttachmentDisposition(filePath: string): string {
  const fileName = path.basename(filePath).replace(/[\u0000-\u001f\u007f]/g, "_");
  const asciiName = fileName.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_") || "download";
  const encodedName = encodeURIComponent(fileName).replace(
    /['()*]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `attachment; filename="${asciiName}"; filename*=UTF-8''${encodedName}`;
}

export const releaseVersion = readManifest()?.version || getReleaseFiles()[0]?.version || "développement";

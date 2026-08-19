import type { Metadata } from "next";
import Image from "next/image";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { getReleaseFiles, releaseVersion } from "@/lib/releases";
import { platforms, site } from "@/lib/site-data";

export const metadata: Metadata = {
  title: "Download — NReader",
  description:
    "Download the NReader app for Windows, Android, Linux and macOS. Free, open source and independent.",
};

const platformMeta: Record<
  string,
  { label: string; icon: string; available: boolean; note: string }
> = {
  windows: {
    label: "Windows",
    icon: "🪟",
    available: true,
    note: "NSIS installer & portable build",
  },
  android: {
    label: "Android",
    icon: "🤖",
    available: false,
    note: "APK build pending — coming soon",
  },
  linux: {
    label: "Linux",
    icon: "🐧",
    available: false,
    note: "Build from source — see GitHub",
  },
  macos: {
    label: "macOS",
    icon: "🍎",
    available: false,
    note: "Build from source — see GitHub",
  },
};

export default function DownloadPage() {
  const files = getReleaseFiles();
  const setup = files.find((f) => f.kind === "setup");
  const portable = files.find((f) => f.kind === "portable");
  const others = files.filter((f) => f.kind === "other");

  return (
    <>
      <Navbar />
      <main className="mx-auto w-full max-w-[1200px] px-6 pb-24 pt-16">
        {/* Header */}
        <div className="mx-auto flex max-w-[720px] flex-col items-center gap-5 text-center">
          <p className="text-[12px] font-semibold uppercase leading-none tracking-[0.13em] text-accent-hover">
            Download
          </p>
          <h1 className="text-balance text-[42px] font-semibold leading-[1.08em] tracking-[-0.035em] text-ink sm:text-[52px]">
            Ready to try it?
          </h1>
          <p className="max-w-[520px] text-balance text-[15px] leading-[1.65em] text-muted">
            Get the unofficial app and enjoy a cleaner, faster way to manage your library.
            Version <span className="font-semibold text-ink">{releaseVersion}</span> · Free &amp;
            open source under the {site.license} license.
          </p>
        </div>

        {/* Windows installers (real files) */}
        <div className="mt-14 grid gap-4 md:grid-cols-2">
          {setup && (
            <DownloadCard
              label={setup.label}
              icon="🪟"
              description="Standard installer with automatic updates, desktop shortcut and start-menu entry."
              size={setup.sizeHuman}
              sha512={setup.sha512}
              fileName={setup.fileName}
              badge="Recommended"
            />
          )}
          {portable && (
            <DownloadCard
              label={portable.label}
              icon="📦"
              description="No installation required — run the app directly from the downloaded file."
              size={portable.sizeHuman}
              fileName={portable.fileName}
            />
          )}
          {others.map((f) => (
            <DownloadCard
              key={f.fileName}
              label={f.label}
              icon={platformMeta[f.platform]?.icon ?? "📄"}
              description={`Download ${f.label} for ${platformMeta[f.platform]?.label ?? "your platform"}.`}
              size={f.sizeHuman}
              fileName={f.fileName}
            />
          ))}
        </div>

        {/* Other platforms */}
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {platforms
            .filter((p) => p !== "Windows")
            .map((platform) => {
              const meta = platformMeta[platform.toLowerCase()];
              return (
                <div
                  key={platform}
                  className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-6"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-2xl">{meta.icon}</span>
                    <span className="rounded-full border border-line-soft bg-surface-4 px-2.5 py-1 text-[10px] font-semibold uppercase leading-none tracking-[0.1em] text-faint-2">
                      {meta.available ? "Ready" : "Soon"}
                    </span>
                  </div>
                  <h3 className="text-[17px] font-semibold leading-none text-ink">{platform}</h3>
                  <p className="text-[13px] leading-[1.6em] text-muted">{meta.note}</p>
                  <a
                    href={site.githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex w-fit items-center gap-2 rounded-full border border-line-soft bg-surface-2 px-4 py-2 text-[13px] font-semibold leading-none text-ink transition-colors duration-200 hover:border-line-soft-2 hover:bg-surface-3"
                  >
                    GitHub
                  </a>
                </div>
              );
            })}
        </div>

        {/* Mascot strip */}
        <div className="relative mt-14 overflow-hidden rounded-2xl border border-line bg-surface">
          <div className="flex flex-col items-center gap-4 px-6 py-10 text-center sm:flex-row sm:justify-between sm:px-10 sm:text-left">
            <div>
              <p className="text-[12px] font-semibold uppercase leading-none tracking-[0.13em] text-accent-hover">
                Good to know
              </p>
              <p className="mt-3 max-w-[520px] text-[14px] leading-[1.7em] text-muted">
                Independent third-party project. Not affiliated with or endorsed by NHentai.
                Your library stays personal — history and favorites are stored locally on your
                device.
              </p>
            </div>
            <div className="relative h-28 w-28 shrink-0">
              <Image
                src="/mascot.jpg"
                alt=""
                aria-hidden
                fill
                sizes="112px"
                className="object-contain"
              />
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

function DownloadCard({
  label,
  icon,
  description,
  size,
  sha512,
  fileName,
  badge,
}: {
  label: string;
  icon: string;
  description: string;
  size: string;
  sha512?: string;
  fileName: string;
  badge?: string;
}) {
  return (
    <div className="relative flex flex-col gap-4 rounded-2xl border border-line bg-surface p-6">
      {badge && (
        <span className="absolute right-5 top-5 rounded-full bg-accent/15 px-3 py-1 text-[10px] font-bold uppercase leading-none tracking-[0.1em] text-accent-hover">
          {badge}
        </span>
      )}
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/[0.06] text-xl">
          {icon}
        </span>
        <div>
          <h3 className="text-[18px] font-semibold leading-[1.25em] tracking-[-0.01em] text-ink">
            {label}
          </h3>
          <p className="mt-0.5 text-[12px] leading-none text-faint-2">
            v{releaseVersion} · {size}
          </p>
        </div>
      </div>
      <p className="text-[14px] leading-[1.6em] text-muted">{description}</p>
      {sha512 && (
        <div className="rounded-lg border border-line bg-surface-4 px-3 py-2">
          <p className="text-[10px] font-semibold uppercase leading-none tracking-[0.1em] text-faint-2">
            SHA-512
          </p>
          <p className="mt-1.5 break-all font-mono text-[10.5px] leading-[1.5] text-muted">
            {sha512}
          </p>
        </div>
      )}
      <a
        href={`/api/download/${encodeURIComponent(fileName)}`}
        className="mt-auto inline-flex items-center justify-center gap-2 rounded-full bg-accent px-6 py-3 text-[14px] font-semibold leading-none text-white transition-colors duration-200 hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        Download {size}
      </a>
    </div>
  );
}

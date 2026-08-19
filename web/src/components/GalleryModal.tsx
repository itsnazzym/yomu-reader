"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

interface GalleryDetail {
  id: number;
  media_id: string;
  title: { english: string; japanese: string; pretty: string };
  cover: string;
  num_pages: number;
  num_favorites: number;
  upload_date: number;
  tags: { id: number; type: string; name: string; count?: number }[];
  source: string;
}

// Pastel colors per tag type, matching the real app's BookCard chips
const TAG_COLORS: Record<string, string> = {
  artist: "#f472b6",
  group: "#c084fc",
  parody: "#a78bfa",
  character: "#22d3ee",
  tag: "#93c5fd",
  language: "#fbbf24",
  category: "#a3e635",
};

function formatDate(ts: number): string {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default function GalleryModal({
  galleryId,
  onClose,
}: {
  galleryId: number;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<GalleryDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/gallery/${galleryId}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: GalleryDetail) => {
        if (!cancelled) setDetail(data);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [galleryId]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Gallery details"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

      {/* Panel */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-line-soft-3 bg-[#12121a] shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <p className="text-[12px] font-semibold uppercase leading-none tracking-[0.13em] text-accent-hover">
            Gallery #{galleryId}
          </p>
          <button
            onClick={onClose}
            aria-label="Close gallery details"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-line-soft bg-surface text-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex flex-col items-center gap-3 px-6 py-16">
              <span className="h-8 w-8 animate-spin rounded-full border-2 border-line-soft-3 border-t-accent" />
              <p className="text-[13px] text-muted">Loading real gallery data…</p>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
              <p className="text-[15px] font-semibold text-ink">Could not load this gallery</p>
              <p className="text-[13px] text-muted">{error}</p>
              <button
                onClick={onClose}
                className="mt-1 rounded-full bg-accent px-5 py-2 text-[13px] font-semibold text-white"
              >
                Close
              </button>
            </div>
          )}

          {detail && !loading && (
            <div>
              {/* Cover + meta */}
              <div className="flex gap-5 px-5 pt-5">
                <div className="relative aspect-[1/1.414] w-[130px] shrink-0 overflow-hidden rounded-xl border border-line bg-surface-4">
                  <Image src={detail.cover} alt={detail.title.english} fill sizes="130px" className="object-cover" />
                </div>
                <div className="flex min-w-0 flex-col gap-2 py-1">
                  <h3 className="text-[17px] font-semibold leading-[1.3] tracking-[-0.01em] text-ink">
                    {detail.title.english}
                  </h3>
                  {detail.title.japanese && (
                    <p className="text-[13px] leading-[1.4] text-muted">{detail.title.japanese}</p>
                  )}
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-white/[0.06] px-3 py-1 text-[11.5px] font-semibold text-ink">
                      {detail.num_pages}p
                    </span>
                    <span className="rounded-full bg-accent/15 px-3 py-1 text-[11.5px] font-semibold text-accent-hover">
                      ♥ {formatCount(detail.num_favorites)}
                    </span>
                    <span className="rounded-full bg-white/[0.06] px-3 py-1 text-[11.5px] font-medium text-muted">
                      Uploaded {formatDate(detail.upload_date)}
                    </span>
                  </div>
                  <p className="mt-auto text-[10.5px] leading-none text-faint-2">
                    {detail.source === "v2" ? "Live from nHentai API v2" : "via Photon mirror"}
                  </p>
                </div>
              </div>

              {/* Tags */}
              <div className="px-5 py-5">
                <p className="text-[10px] font-semibold uppercase leading-none tracking-[0.13em] text-faint-2">
                  Tags · {detail.tags.length}
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {detail.tags.map((tag) => {
                    const color = TAG_COLORS[tag.type] || "#93c5fd";
                    return (
                      <span
                        key={`${tag.type}-${tag.name}`}
                        className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium"
                        style={{
                          color,
                          borderColor: `${color}45`,
                          backgroundColor: `${color}18`,
                        }}
                      >
                        {tag.name}
                        {typeof tag.count === "number" && tag.count > 0 && (
                          <span className="font-mono text-[9.5px] opacity-70">
                            {formatCount(tag.count)}
                          </span>
                        )}
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

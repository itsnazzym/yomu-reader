"use client";

import Image from "next/image";
import { useState } from "react";
import SectionHeading from "@/components/SectionHeading";
import GalleryModal from "@/components/GalleryModal";
import { galleryGrid } from "@/lib/site-data";

// ---------------------------------------------------------------------------
// High-fidelity mockups of the real app, built with the exact design tokens
// from mobile/components (BookCard, reader overlays, offline library).
// ---------------------------------------------------------------------------

/** Real BookCard: B6 ratio, #ID stamp, spec bar, tag chips. Click opens the real gallery details. */
function BookCard({
  cover,
  id,
  pages,
  lang,
  title,
  tags,
  onOpen,
}: {
  cover: string;
  id: number;
  pages: number;
  lang: string;
  title: string;
  tags: { label: string; color: string }[];
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group overflow-hidden rounded-[14px] border border-[#232332] bg-[#14141e] text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-[0_8px_24px_-8px_rgba(237,37,83,0.35)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <div className="relative aspect-[1/1.414] w-full bg-[#0d0d14]">
        <Image src={cover} alt={title} fill sizes="180px" className="object-cover" />
        {/* #ID archive stamp */}
        <span className="absolute left-1.5 top-1.5 rounded-[5px] border border-[rgba(255,255,255,0.12)] bg-[rgba(9,9,14,0.88)] px-1.5 py-0.5 text-[9px] font-extrabold tracking-[0.3px] text-[#e5e7eb]">
          #{id}
        </span>
        {/* bookmark notch */}
        <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full border border-[rgba(255,255,255,0.12)] bg-[rgba(9,9,14,0.85)] text-[10px] text-white/75">
          ♡
        </span>
        {/* spec bar */}
        <div className="absolute bottom-1.5 left-1.5 right-1.5 flex gap-1">
          <span className="rounded-[4px] border border-[rgba(255,255,255,0.12)] bg-[rgba(9,9,14,0.88)] px-1.5 py-[1.5px] text-[9.5px] font-bold text-[#e5e7eb]">
            {pages}p
          </span>
          {lang && (
            <span className="rounded-[4px] border border-[rgba(255,255,255,0.12)] bg-[rgba(9,9,14,0.9)] px-1.5 py-[1.5px] text-[9px] font-black text-[#fbbf24]">
              {lang}
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-[5px] border-t border-[#1e1e2c] px-2 py-2">
        <p className="text-[11.5px] font-bold leading-[15px] text-[#f3f4f6]">{title}</p>
        <div className="flex flex-wrap gap-[3px]">
          {tags.slice(0, 2).map((tag) => (
            <span
              key={tag.label}
              className="max-w-[78px] truncate rounded-[4px] border px-[5px] py-[1.5px] text-[9.5px] font-semibold"
              style={{ color: tag.color, borderColor: `${tag.color}45`, backgroundColor: `${tag.color}18` }}
            >
              {tag.label}
            </span>
          ))}
          {tags.length > 2 && (
            <span className="rounded-[4px] bg-[#1e1e2c] px-1 py-[1.5px] text-[8.5px] font-bold text-[#9ca3af]">
              +{tags.length - 2}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

// View 1 — Gallery grid (home screen)
function GalleryGridMock({ onOpenGallery }: { onOpenGallery: (id: number) => void }) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-line bg-[#12121a]">
      {/* real home header */}
      <div className="flex items-center justify-between border-b border-[#20202e] px-4 py-3">
        <span className="text-[19px] font-extrabold tracking-[0.3px] text-[#f3f4f6]">Home</span>
        <div className="flex items-center gap-1.5">
          {["↻", "⌕", "⤢", "#"].map((icon) => (
            <span
              key={icon}
              className="flex h-9 w-9 items-center justify-center rounded-[10px] text-[15px] font-semibold text-[#c5878d]"
            >
              {icon}
            </span>
          ))}
        </div>
      </div>
      <div className="flex-1 p-3">
        <div className="grid grid-cols-2 gap-2.5">
          {galleryGrid.map((g) => (
            <BookCard key={g.id} {...g} onOpen={() => onOpenGallery(g.id)} />
          ))}
        </div>
        <p className="mt-2.5 text-center text-[10px] text-[#6b7280]">Tap a card to see live details</p>
      </div>
    </div>
  );
}

// View 2 — Reader (Manga pager / Webtoon vertical, real page)
const TOTAL_READER_PAGES = 45;

function ModeToggle({
  mode,
  onChange,
}: {
  mode: "manga" | "webtoon";
  onChange: (m: "manga" | "webtoon") => void;
}) {
  const options = [
    { key: "manga" as const, label: "Manga", icon: "▤" },
    { key: "webtoon" as const, label: "Webtoon", icon: "☰" },
  ];
  return (
    <div
      role="group"
      aria-label="Reading mode"
      className="flex items-center rounded-full border border-white/15 bg-white/5 p-[3px]"
    >
      {options.map((opt) => {
        const active = mode === opt.key;
        return (
          <button
            key={opt.key}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.key)}
            className={`flex items-center gap-1 rounded-full px-2.5 py-[5px] text-[10px] font-extrabold uppercase tracking-[0.08em] transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#ff6a8b] ${
              active ? "bg-[#ed2553] text-white" : "text-white/60 hover:text-white/90"
            }`}
          >
            <span className="text-[11px]">{opt.icon}</span>
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function ReaderMock() {
  const [mode, setMode] = useState<"manga" | "webtoon">("manga");
  const [direction, setDirection] = useState<"rtl" | "ltr">("rtl");

  return (
    <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-line bg-black">
      {/* reader area */}
      <div className="relative flex-1 bg-black">
        {mode === "manga" ? (
          /* ---- Manga pager mode: full page, tap to turn ---- */
          <div className="relative h-full w-full">
            <Image
              src="/screenshots/covers/page-1.webp"
              alt="Manga page in the reader, pager mode"
              fill
              sizes="380px"
              className="object-contain"
            />
            {/* tap zones hint */}
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10 bg-black/50 px-2.5 py-1 text-[9px] font-bold tracking-[0.1em] text-white/70">
              TAP TO TURN
            </span>
          </div>
        ) : (
          /* ---- Webtoon mode: full-width vertical stack (continuous scroll) ---- */
          <div className="absolute inset-0 overflow-hidden">
            {["top", "center", "bottom"].map((pos, i) => (
              <div key={pos} className="relative h-1/3 w-full border-b border-white/5">
                <Image
                  src="/screenshots/covers/page-1.webp"
                  alt=""
                  fill
                  sizes="380px"
                  className={`object-cover ${pos === "top" ? "object-top" : pos === "bottom" ? "object-bottom" : "object-center"}`}
                />
                <span className="absolute bottom-1.5 right-2 rounded-md bg-black/70 px-2 py-0.5 text-[11px] font-bold text-white">
                  {i + 1} / {TOTAL_READER_PAGES}
                </span>
              </div>
            ))}
            {/* scroll progress rail */}
            <div className="absolute right-1.5 top-1/2 h-24 w-[3px] -translate-y-1/2 rounded-full bg-white/10">
              <div className="h-8 w-full rounded-full bg-[#ed2553]" />
            </div>
          </div>
        )}

        {/* top overlay: back + title + mode toggle */}
        <div className="absolute inset-x-0 top-0 flex items-center gap-2.5 bg-[rgba(0,0,0,0.85)] px-3 pb-2 pt-2.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-white">
            ←
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-bold text-white">[Hotate Chanpon] I called…</p>
            <p className="text-[11px] text-white/70">
              {mode === "manga"
                ? `Pager · ${direction.toUpperCase()} · 1 / ${TOTAL_READER_PAGES}`
                : `Webtoon · vertical · 1 / ${TOTAL_READER_PAGES}`}
            </p>
          </div>
          <ModeToggle mode={mode} onChange={setMode} />
          {mode === "manga" && (
            <button
              type="button"
              aria-label={`Reading direction: ${direction === "rtl" ? "right to left" : "left to right"}`}
              title={direction === "rtl" ? "Right to Left (manga standard)" : "Left to Right"}
              onClick={() => setDirection((d) => (d === "rtl" ? "ltr" : "rtl"))}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 text-[12px] text-[#ff6a8b] transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#ff6a8b]"
            >
              {direction === "rtl" ? "⟶" : "⟵"}
            </button>
          )}
        </div>
      </div>

      {/* bottom bar: thumb rail (manga) / progress hint (webtoon) */}
      {mode === "manga" ? (
        <div className="flex gap-2 border-t border-white/10 bg-black px-3 py-2.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <div
              key={n}
              className={`relative h-[68px] w-12 shrink-0 overflow-hidden rounded-lg ${
                n === 1 ? "border-2 border-[#ed2553]" : "border border-transparent"
              }`}
            >
              <Image
                src="/screenshots/covers/page-1.webp"
                alt=""
                fill
                sizes="48px"
                className="object-cover opacity-70"
              />
              <span className="absolute bottom-0.5 right-0.5 rounded-[4px] bg-black/80 px-1 text-[9px] font-bold text-white">
                {n}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-2 border-t border-white/10 bg-black px-3 py-2.5">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
            <div className="h-full w-1/4 rounded-full bg-[#ed2553]" />
          </div>
          <span className="text-[10px] font-bold text-white/60">SCROLL · 1 / {TOTAL_READER_PAGES}</span>
        </div>
      )}
    </div>
  );
}

// View 3 — Offline library (empty state with real seal design)
function LibraryMock() {
  return (
    <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-line bg-[#12121a]">
      {/* header */}
      <div className="border-b border-[#20202e] px-4 py-3">
        <p className="text-[20px] font-extrabold text-[#f3f4f6]">Bibliothèque Hors-Ligne</p>
        <p className="mt-0.5 text-[13px] text-[#9ca3af]">0 manga(s) téléchargé(s)</p>
      </div>
      {/* empty state — real AnimatedEmptyState seal */}
      <div className="flex flex-1 flex-col items-center justify-center gap-1 px-6 py-8 text-center">
        <div className="relative mb-2 flex h-24 w-24 items-center justify-center">
          <svg viewBox="0 0 96 96" className="absolute inset-0 h-full w-full">
            <circle cx="48" cy="48" r="44" stroke="#34c759" strokeWidth="1.5" strokeDasharray="4 2" opacity="0.3" fill="none" />
            <circle cx="48" cy="48" r="38" stroke="#34c759" strokeWidth="1" opacity="0.6" fill="none" />
            <rect x="24" y="24" width="48" height="48" rx="8" stroke="#34c759" strokeWidth="1" opacity="0.25" fill="none" />
          </svg>
          <div className="flex flex-col items-center">
            <span className="text-[26px] font-black leading-[30px] text-[#34c759] opacity-85">庫</span>
            <span className="mt-0.5 rounded-lg bg-[#34c759]/15 p-0.5 text-[11px] text-[#34c759]">⬇</span>
          </div>
        </div>
        <p className="text-[16px] font-extrabold tracking-[-0.2px] text-[#f3f4f6]">
          Bibliothèque Hors-Ligne Vide
        </p>
        <p className="max-w-[240px] text-[12.5px] leading-[18px] text-[#9ca3af]">
          Téléchargez des tomes entiers pour les dévorer partout sans connexion.
        </p>
        <div className="mt-4 flex w-full max-w-[200px] flex-col items-center gap-2">
          <span className="w-full rounded-xl bg-[#ed2553] py-3 text-center text-[13px] font-extrabold text-white">
            Explorer le catalogue →
          </span>
        </div>
      </div>
    </div>
  );
}

export default function ThreeViews() {
  const [openGalleryId, setOpenGalleryId] = useState<number | null>(null);

  return (
    <section id="screenshots" className="mx-auto w-full max-w-[1200px] scroll-mt-20 px-6 py-24">
      <SectionHeading
        eyebrow="Three Views. One Library."
        title="Built for a better experience."
        description="A calm interface that keeps discovery, organization and reading history in one coherent flow."
      />

      <div className="mt-16 grid gap-4 md:grid-cols-3">
        <GalleryGridMock onOpenGallery={setOpenGalleryId} />
        <ReaderMock />
        <LibraryMock />
      </div>

      <p className="mt-6 text-center text-[11px] text-faint-2">
        Faithful UI mockups built from the app&apos;s own design tokens — real covers fetched live
        from the archive. Click a gallery card for its live details, and toggle Manga / Webtoon
        on the reader to preview both reading engines.
      </p>

      {openGalleryId !== null && (
        <GalleryModal galleryId={openGalleryId} onClose={() => setOpenGalleryId(null)} />
      )}
    </section>
  );
}

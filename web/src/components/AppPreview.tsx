"use client";

import Image from "next/image";
import { useState } from "react";

// Real screenshots captured from the running app (Expo web + Photon proxy)
const screens = [
  {
    img: "/screenshots/home.png",
    label: "Home",
    sub: "Real galleries · Popular Now & New Uploads",
  },
  {
    img: "/screenshots/reader.png",
    label: "Reader",
    sub: "Manga mode · page-by-page",
  },
  {
    img: "/screenshots/library.png",
    label: "Offline Library",
    sub: "Downloaded volumes, readable offline",
  },
  {
    img: "/screenshots/favorites.png",
    label: "Favorites",
    sub: "Bookmarks & online favorites",
  },
  {
    img: "/screenshots/history.png",
    label: "History",
    sub: "Reading progress tracking",
  },
];

export default function AppPreview() {
  const [active, setActive] = useState(0);
  const current = screens[active];

  return (
    <section className="mx-auto w-full max-w-[1200px] px-6 pb-24">
      {/* Window frame like the real app */}
      <div className="overflow-hidden rounded-[10px] border border-[#2e2e3c] bg-[#12121a] shadow-[0_40px_80px_-20px_rgba(0,0,0,0.6)]">
        {/* Window bar */}
        <div className="flex items-center justify-between gap-4 border-b border-[#222230] bg-[#12121a] px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#ff6b6b]" />
            <span className="h-2 w-2 rounded-full bg-[#fbbf24]" />
            <span className="h-2 w-2 rounded-full bg-[#34d399]" />
          </div>
          <span className="text-[12px] font-medium leading-none text-muted">
            nHentai • Archive & Reader
          </span>
          <span className="hidden items-center gap-1.5 rounded-md border border-[rgba(82,196,26,0.25)] bg-[rgba(82,196,26,0.12)] px-2 py-1 sm:inline-flex">
            <span className="h-[5px] w-[5px] rounded-full bg-[#52c41a]" />
            <span className="text-[9px] font-extrabold leading-none text-[#52c41a]">Photon</span>
          </span>
        </div>

        {/* Body */}
        <div className="flex flex-col items-center gap-8 px-6 py-10 md:flex-row md:items-start md:justify-center md:gap-12">
          {/* Phone frame with real screenshot */}
          <div className="relative w-[240px] shrink-0 sm:w-[270px]">
            {/* Phone bezel */}
            <div className="relative rounded-[36px] border border-[#2e2e3c] bg-[#0b0b0f] p-2.5 shadow-2xl">
              <div className="relative aspect-[420/900] w-full overflow-hidden rounded-[26px] bg-black">
                <Image
                  key={current.img}
                  src={current.img}
                  alt={`${current.label} screenshot`}
                  fill
                  sizes="270px"
                  className="object-cover object-top"
                  priority
                />
              </div>
              {/* Notch */}
              <div className="pointer-events-none absolute left-1/2 top-[14px] h-[16px] w-[64px] -translate-x-1/2 rounded-full bg-black" />
            </div>
          </div>

          {/* Details + thumbnails */}
          <div className="flex w-full max-w-[300px] flex-col items-center gap-6 text-center md:items-start md:text-left">
            <div className="flex flex-col gap-2">
              <p className="text-[12px] font-semibold uppercase leading-none tracking-[0.13em] text-accent-hover">
                {current.label}
              </p>
              <h3 className="text-[24px] font-semibold leading-[1.1em] tracking-[-0.025em] text-ink">
                {current.sub}
              </h3>
              <p className="text-[13px] leading-[1.6em] text-muted">
                Captured live from the real app — real galleries fetched through the Photon
                mirror proxy.
              </p>
            </div>

            {/* Thumbnails */}
            <div className="flex items-center gap-2">
              {screens.map((s, i) => (
                <button
                  key={s.img}
                  onClick={() => setActive(i)}
                  aria-label={`Show ${s.label} screenshot`}
                  aria-pressed={i === active}
                  className={`relative h-16 w-9 overflow-hidden rounded-md border transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                    i === active
                      ? "border-accent opacity-100"
                      : "border-line-soft opacity-50 hover:opacity-80"
                  }`}
                >
                  <Image src={s.img} alt="" fill sizes="36px" className="object-cover object-top" />
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              {screens.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-200 ${
                    i === active ? "w-5 bg-accent" : "w-1.5 bg-line-soft-3"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

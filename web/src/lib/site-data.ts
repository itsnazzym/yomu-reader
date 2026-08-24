// ---------------------------------------------------------------------------
// All site copy in one place — edit here, everything updates.
// Content is sourced from the actual project: README.md, mobile/ and src/.
// ---------------------------------------------------------------------------

export const site = {
  name: "Yomu",
  tagline: "One library. Two devices.",
  description:
    "Yomu Reader is an unofficial open-source manga & webtoon client for desktop and Android — CBZ exports, local library, and a shared backup between phone and PC.",
  disclaimer:
    "Independent third-party project. Not affiliated with or endorsed by nHentai.",
  githubUrl: "https://github.com/itsnazzym/yomu-reader",
  license: "MIT",
};

export const navLinks = [
  { label: "Features", href: "#features" },
  { label: "Screenshots", href: "#screenshots" },
  { label: "FAQ", href: "#faq" },
  { label: "GitHub", href: site.githubUrl, external: true },
];

export const qualityChips = [
  "Manga & Webtoon",
  "Offline Library",
  "CBZ + ComicInfo",
  "PoW Solver",
];

// Real features from the project README
export const features = [
  {
    title: "Dual Reader Engine",
    description:
      "Manga mode page-by-page (RTL/LTR) with double-page spreads, plus a high-performance continuous Webtoon scroll with dynamic memory management.",
    icon: "book",
  },
  {
    title: "Fast CBZ Downloads",
    description:
      "Parallel multi-stream downloader with live speed (Mo/s) and ETA, packaging standard CBZ archives with ComicInfo.xml for Komga, Kavita and YACReader.",
    icon: "bolt",
  },
  {
    title: "Offline Library",
    description:
      "Instant reading of downloaded volumes straight from local storage — your library, entirely yours, even without a connection.",
    icon: "grid",
  },
  {
    title: "Search & Continuity",
    description:
      "Full search syntax over tags, artists, parodies and characters. Export a Yomu backup JSON and resume the same page on your other device.",
    icon: "devices",
  },
  {
    title: "Anti-block & PoW Solver",
    description:
      "DoH resolution (AdGuard, Cloudflare, Google, Quad9) and an automatic SHA-256 Proof-of-Work solver that clears nHentai challenges in milliseconds.",
    icon: "shield",
  },
  {
    title: "Open Source",
    description:
      "Transparent, community-driven and free under the MIT license. Desktop (Electron), mobile (Expo) and a resilient Photon mirror proxy.",
    icon: "github",
  },
];

// Real app screens: Home/Discover, Reader, Offline Library
export const views = [
  {
    index: "01",
    label: "DISCOVERY",
    title: "Browse the archive",
    meta: "Search, tags & filters",
    rows: [
      { label: "Search tags, artists, parodies or code", muted: "" },
      { label: "Sort: recent • popular • favorites", muted: "" },
      { label: "Smart blacklist (hide or discreet blur)", muted: "" },
    ],
  },
  {
    index: "02",
    label: "READER",
    title: "Read your way",
    meta: "Manga & Webtoon",
    rows: [
      { label: "RTL / LTR manga with double-page spreads", muted: "" },
      { label: "Continuous webtoon scroll", muted: "" },
      { label: "Resume exactly where you left off", muted: "" },
    ],
  },
  {
    index: "03",
    label: "LIBRARY",
    title: "Keep it offline",
    meta: "CBZ + ComicInfo",
    rows: [
      { label: "Batch downloads with ETA", muted: "" },
      { label: "Standard CBZ for Komga / Kavita", muted: "" },
      { label: "Backup JSON shared phone ↔ PC", muted: "" },
    ],
  },
];

export const stats = [
  { value: "2", label: "Platforms" },
  { value: "MIT", label: "License" },
  { value: "CBZ", label: "Export" },
  { value: "OTA", label: "Mobile updates" },
];

export const galleryGrid = [
  {
    id: 672545,
    cover: "/screenshots/covers/cover-1.webp",
    title: "[Hotate Chanpon] I called an escort…",
    pages: 62,
    favorites: 56827,
    lang: "EN",
    tags: [
      { label: "milf", type: "tag", color: "#93c5fd" },
      { label: "netorare", type: "tag", color: "#93c5fd" },
      { label: "hotate chanpon", type: "artist", color: "#f472b6" },
    ],
  },
  {
    id: 672555,
    cover: "/screenshots/covers/cover-2.webp",
    title: "[Contllenge] Ikoku no Onna Heishi…",
    pages: 45,
    favorites: 39250,
    lang: "JP",
    tags: [
      { label: "amazoness", type: "character", color: "#22d3ee" },
      { label: "vanilla", type: "tag", color: "#93c5fd" },
      { label: "contllenge", type: "artist", color: "#f472b6" },
    ],
  },
  {
    id: 672297,
    cover: "/screenshots/covers/cover-3.webp",
    title: "[Gya-tei] Tomodachi no Muchimuchi…",
    pages: 33,
    favorites: 36295,
    lang: "JP",
    tags: [
      { label: "big breasts", type: "tag", color: "#93c5fd" },
      { label: "paizuri", type: "tag", color: "#93c5fd" },
      { label: "gya-tei", type: "artist", color: "#f472b6" },
    ],
  },
  {
    id: 671952,
    cover: "/screenshots/covers/cover-4.webp",
    title: "[Hekino Palace] Jimi-tomo, Mesu ni Naru",
    pages: 47,
    favorites: 32295,
    lang: "JP",
    tags: [
      { label: "nakadashi", type: "tag", color: "#93c5fd" },
      { label: "schoolgirl", type: "tag", color: "#93c5fd" },
      { label: "hekino palace", type: "artist", color: "#f472b6" },
    ],
  },
];

export const platforms = ["Windows", "Android", "Linux", "macOS"];

export const faqs = [
  {
    question: "Is this an official nHentai app?",
    answer:
      "No. Yomu is an independent, unofficial third-party project. It is neither affiliated with, sponsored by, nor endorsed by nHentai.",
  },
  {
    question: "Is the app free?",
    answer:
      "Yes. The entire project is free and open source under the MIT license — no paywalls, no subscriptions, no hidden costs.",
  },
  {
    question: "Which reading modes are supported?",
    answer:
      "Two: a page-by-page Manga mode (RTL/LTR, with double-page spreads) and a continuous Webtoon scroll mode. Both support immersive fullscreen and tap-to-turn.",
  },
  {
    question: "What about offline reading?",
    answer:
      "Downloaded volumes are stored locally and readable instantly, offline, as standard CBZ archives with ComicInfo.xml metadata, compatible with Komga, Kavita and YACReader.",
  },
  {
    question: "Can I move my library between phone and PC?",
    answer:
      "Yes. Export a Yomu backup JSON from Settings on either device and import it on the other. Favorites, reading history and blacklist travel with you.",
  },
  {
    question: "Where can I report bugs?",
    answer:
      "Open an issue on the GitHub repository and describe the problem you encountered.",
  },
];

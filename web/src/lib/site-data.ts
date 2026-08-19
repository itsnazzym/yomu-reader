// ---------------------------------------------------------------------------
// All site copy in one place — edit here, everything updates.
// Content is sourced from the actual project: README.md, mobile/ and src/.
// ---------------------------------------------------------------------------

export const site = {
  name: "NReader",
  tagline: "Your library. Your way.",
  description:
    "A modern unofficial app designed to make browsing, organizing and discovering your personal manga library faster and more enjoyable.",
  disclaimer: "Independent third-party project. Not affiliated with or endorsed by NHentai.",
  githubUrl: "https://github.com/",
  license: "MIT",
};

export const navLinks = [
  { label: "Features", href: "#features" },
  { label: "Screenshots", href: "#screenshots" },
  { label: "FAQ", href: "#faq" },
  { label: "GitHub", href: "https://github.com/", external: true },
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
    title: "Search & Recommendations",
    description:
      "Full search syntax over tags, artists, parodies and characters, plus a local predictive engine scoring personalized recommendations from your history.",
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
    title: "Manga & Webtoon",
    meta: "Dual engine",
    rows: [
      { label: "Manga mode", muted: "RTL / LTR" },
      { label: "Webtoon mode", muted: "Continuous" },
      { label: "Tap-to-turn", muted: "Edge zones" },
    ],
  },
  {
    index: "03",
    label: "LIBRARY",
    title: "Offline library",
    meta: "Downloaded volumes",
    rows: [
      { label: "Favorites", muted: "Bookmarked" },
      { label: "Reading now", muted: "In progress" },
      { label: "Read later", muted: "Queued" },
      { label: "Archived", muted: "CBZ files" },
    ],
  },
];

// Real numbers from the project
export const stats = [
  { value: "2 Engines", label: "Manga & Webtoon" },
  { value: "4 Platforms", label: "Win • Android • Linux • macOS" },
  { value: "25 Themes", label: "OLED & hue-tuned" },
  { value: "CBZ", label: "ComicInfo.xml ready" },
];

// Real galleries from the nHentai API (popular-week top), with real covers
// downloaded from the Photon mirror proxy.
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

// FAQ answers sourced from the README legal notice & features
export const faqs = [
  {
    question: "Is this an official NHentai app?",
    answer:
      "No. NReader is an independent, unofficial third-party project. It is neither affiliated with, sponsored by, nor endorsed by NHentai.",
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
    question: "Where can I report bugs?",
    answer:
      "Open an issue on the GitHub repository and describe the problem you encountered. We try to respond quickly.",
  },
];

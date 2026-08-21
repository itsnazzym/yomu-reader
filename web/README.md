# NReader — Web

Faithful re-creation of the NReader landing page (originally designed in Framer)
built with **Next.js 16** (App Router) + **TypeScript** + **Tailwind CSS v4**.

## Getting started

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build
npm start          # serve production build
```

## Optional mirror

Server-side gallery requests use the direct nHentai v2 API by default. To enable
the Photon fallback, set `NHENTAI_MIRROR_URL` to an origin only:

```bash
NHENTAI_MIRROR_URL=https://mirror.example.com
```

The value must use HTTPS, with HTTP accepted only for loopback development
(`localhost`, `127.0.0.1`, or `[::1]`). Credentials, paths, queries, and
fragments are rejected. If the setting is missing or invalid, the web app safely
skips the mirror and falls back to direct API data (or zero/unavailable live
statistics when the direct service cannot provide them). Do not expose this
server-only setting with a `NEXT_PUBLIC_` prefix.

## Editing content

**All copy lives in one file:** [`src/lib/site-data.ts`](src/lib/site-data.ts).
Change the tagline, features, FAQ answers, platforms, links, etc. there and every
section updates — no component edits needed.

## Design tokens

Colors, fonts and surfaces are defined as Tailwind theme tokens in
[`src/app/globals.css`](src/app/globals.css). The design system was extracted from
the original Framer site:

| Token            | Value     | Usage                        |
| ---------------- | --------- | ---------------------------- |
| `--color-background` | `#0b0b0b` | Page background           |
| `--color-accent`     | `#ed2553` | Primary buttons, accents   |
| `--color-accent-hover`| `#ff6a8b`| Hover / eyebrow text        |
| `--color-muted`      | `#a5a5ad` | Secondary text             |
| `--color-surface`    | `#141414` | Cards, panels              |
| `--color-line`       | `#232323` | Borders                    |
| Font               | Exo 2    | Loaded via `next/font/google` |

## Structure

```
src/
  app/
    layout.tsx            # Root layout + metadata
    page.tsx              # Page assembly
    globals.css           # Tailwind theme / design tokens
    api/downloads/route.ts# JSON API exposing download data
  components/
    Navbar.tsx, Hero.tsx, AppPreview.tsx, Features.tsx,
    ThreeViews.tsx, Stats.tsx, Cta.tsx, Faq.tsx, Footer.tsx,
    SectionHeading.tsx, icons.tsx
  lib/
    site-data.ts          # ALL editable content
```

## Fullstack

The site is statically rendered for speed. A small API route
`GET /api/downloads` exposes download links + platforms as JSON for future
in-app clients or integrations.

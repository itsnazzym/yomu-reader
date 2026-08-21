---
type: project
created: 2026-08-22
updated: 2026-08-22
---

# Desktop & Web Architecture

## 1. Desktop Application (Electron 43 + React 19 + Tailwind CSS v4)
- **Point d'entrée principal :** `electron/main.cjs` (Processus Principal Node.js).
- **Preload sécurisé :** `electron/preload.cjs` (ContextBridge exposant `window.electronAPI`).
- **Interface Utilisateur :** `src/App.tsx`, `src/components/`, `src/stores/` (Zustand 5).
- **Résolveur DoH Multi-DNS :** Résolution DNS intégrée dans `main.cjs` supportant Cloudflare (1.1.1.1), Google (8.8.8.8), AdGuard et Quad9 pour contourner les blocages FAI sans modification système.
- **Archivage CBZ Standardisé :** Génération d'archives `.cbz` via `archiver` avec injection automatique de métadonnées `ComicInfo.xml` (titre, artiste, parodie, tags, nombre de pages, sens de lecture Manga).
- **Liseuse Desktop Double Moteur :** `ReaderModal.tsx` avec modes Manga (Simple / Double page) et Webtoon, complétée par `FastScrollRail.tsx` pour le défilement accéléré.
- **Passerelle Cloudflare :** `CloudflareGateModal.tsx` permettant la validation interactive en 1-clic des challenges Cloudflare.
- **Packaging Windows :** Configuration `electron-builder` (`package.json`) générant des exécutables NSIS et versions portables dans `release/`.

## 2. Proxy Miroir Photon (`proxy/nhentai-mirror.mjs`)
- **Port d'écoute :** `8787` (local loopback `127.0.0.1` sur PC hôte / `10.0.2.2` sur émulateur Android).
- **Solveur PoW SHA-256 :** Module autonome calculant dynamiquement les défis cryptographiques imposés par les endpoints nHentai v2 (`action=create_api_key`, `comments`, etc.).
- **Pass-through `/img` résilient :** Réécriture des URLs d'images miroirs avec mise en cache mémoire et gestion des en-têtes `Range` (HTTP 206) pour les téléchargements reprenables.
- **Endpoint `/api/tags/ids` :** Résolution en lot des tags numériques des favoris v2 avec cache LRU / mémoire persistant.
- **Tests unitaires automatisés :** `proxy/nhentai-mirror.test.mjs` validant le binding local, la sécurité CORS, les limites de corps et le rate limiting.

## 3. Portail Web & API Next.js (`web/`)
- **Framework :** Next.js 15+ App Router (`web/src/app/`).
- **Endpoints API :** Proxy de téléchargement (`/api/download/[file]`) et détails de galerie (`/api/gallery/[id]`).
- **Composants :** `GalleryModal.tsx`, `live-stats.ts`, `server-config.ts`, `upstream-api.ts`.

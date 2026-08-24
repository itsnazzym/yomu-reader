# Yomu V2 Continuity Design

Date: 2026-08-24

## Goal

Ship Yomu as one product on phone and PC: same name, same backup JSON, same resume page. Extra catalog sources stay mobile-only for this release.

## Brand

- UI name: Yomu / Yomu Reader
- Version: 2.0.0
- GitHub repo name unchanged
- Web landing uses Yomu and real release artifact names

## Data contract

- Canonical key: GlobalGalleryId (`nhentai:123`)
- Desktop favorites and history migrate legacy numeric ids to `nhentai:{id}`
- Exchange format: BackupData v3 from mobile (`favorites`, `history`, `blacklistTags`, `readerSettings`)
- Imported `3hentai:*` (etc.) stay tagged sourceUnavailable on desktop

## Bridges

1. `yomu-backup.json` import/export in desktop Settings
2. CBZ ComicInfo `<Bookmark>` (1-based page)
3. Deep link `yomureader://gallery/nhentai:{id}`

## Desktop craft

- Resume strip on explorer home
- Reader bar shows page, title, source id
- Reader settings persisted under `yomu_reader_settings_v1`
- Tauri invoke path frozen unless `window.__YOMU_ENABLE_TAURI__`

## Out of scope

IOS, Tauri shipping, desktop multi-source adapters, cloud sync, PIN on desktop, web reader

## Done when

- One name in APK, EXE, site, window title
- Mobile backup imports on desktop without rewriting foreign source ids
- Continue resumes last unfinished book
- `/download` lists Android as available


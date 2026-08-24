import type { Gallery, Tag } from "./api/types";

const LANG_ISO: Record<string, string> = {
  english: "en",
  en: "en",
  japanese: "ja",
  jp: "ja",
  chinese: "zh",
  cn: "zh",
  french: "fr",
  français: "fr",
  francais: "fr",
  spanish: "es",
  español: "es",
  german: "de",
  deutsch: "de",
  russian: "ru",
  italian: "it",
  italiano: "it",
  korean: "ko",
  portuguese: "pt",
};

export function escapeXml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function firstTagName(tags: Tag[] | undefined, type: string): string {
  if (!Array.isArray(tags)) return "";
  const hit = tags.find((tag) => tag && tag.type === type && tag.name);
  return hit?.name || "";
}

export function languageIsoFromTags(tags: Tag[] | undefined): string {
  if (!Array.isArray(tags)) return "";
  const lang = tags.find(
    (tag) => tag?.type === "language" && tag.name && tag.name.toLowerCase() !== "translated"
  );
  if (!lang?.name) return "";
  return LANG_ISO[lang.name.toLowerCase()] || lang.name.slice(0, 2).toLowerCase();
}

export function galleryDisplayTitle(gallery: Gallery): string {
  return (
    gallery.title?.pretty ||
    gallery.title?.english ||
    gallery.title?.japanese ||
    `Gallery #${gallery.id}`
  );
}

/** ComicInfo.xml aligned with desktop exporter (Komga / Kavita / Mihon). */
export function buildComicInfoXml(
  gallery: Gallery,
  options?: { bookmarkPage?: number }
): string {
  const tags = Array.isArray(gallery.tags) ? gallery.tags : [];
  const title = galleryDisplayTitle(gallery);
  const parody = firstTagName(tags, "parody");
  const group = firstTagName(tags, "group");
  const artist = firstTagName(tags, "artist");
  const category = firstTagName(tags, "category") || "Doujinshi";
  const tagNames = tags.map((tag) => tag.name).filter(Boolean).join(", ");
  const pages = gallery.num_pages || gallery.images?.pages?.length || 0;
  const lang = languageIsoFromTags(tags);
  const id = Number(gallery.id) || 0;
  const bookmarkPage =
    typeof options?.bookmarkPage === "number" && options.bookmarkPage >= 1
      ? Math.floor(options.bookmarkPage)
      : null;
  const bookmarkXml = bookmarkPage
    ? `\n  <Bookmark>${bookmarkPage}</Bookmark>`
    : "";

  return `<?xml version="1.0" encoding="utf-8"?>
<ComicInfo xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <Title>${escapeXml(title)}</Title>
  <Series>${escapeXml(parody)}</Series>
  <Number>${id}</Number>
  <Summary>Source: https://nhentai.net/g/${id}/</Summary>
  <Writer>${escapeXml(group)}</Writer>
  <Penciller>${escapeXml(artist)}</Penciller>
  <Genre>${escapeXml(category)}</Genre>
  <Tags>${escapeXml(tagNames)}</Tags>
  <PageCount>${pages}</PageCount>
  <LanguageISO>${escapeXml(lang)}</LanguageISO>
  <Web>https://nhentai.net/g/${id}/</Web>
  <Manga>YesAndRightToLeft</Manga>${bookmarkXml}
</ComicInfo>`;
}

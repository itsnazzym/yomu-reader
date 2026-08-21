type JsonObject = Record<string, unknown>;

export interface UpstreamTag {
  id: number;
  type: string;
  name: string;
  slug?: string;
  count?: number;
  description?: string;
}

export interface UpstreamPage {
  type: string;
  width: number;
  height: number;
}

export interface UpstreamGallery {
  id: number;
  mediaId: string;
  englishTitle: string;
  japaneseTitle: string;
  prettyTitle: string;
  coverPath: string;
  thumbnailPath: string;
  numPages: number;
  numFavorites: number;
  uploadDate: number;
  tags: UpstreamTag[];
  pages: UpstreamPage[];
}

export interface GalleryMetrics {
  numPages: number;
  numFavorites: number;
}

const ALLOWED_IMAGE_HOSTS = new Set([
  "i.nhentai.net",
  "i1.nhentai.net",
  "i2.nhentai.net",
  "i3.nhentai.net",
  "i4.nhentai.net",
  "t.nhentai.net",
  "t1.nhentai.net",
  "t2.nhentai.net",
  "t3.nhentai.net",
  "t4.nhentai.net",
  "zrocdn.xyz",
]);

function asObject(value: unknown): JsonObject | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonObject)
    : null;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asFiniteNumber(value: unknown): number {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : 0;
  return Number.isFinite(number) ? number : 0;
}

function readImagePath(value: unknown): string {
  if (typeof value === "string") return value;
  const image = asObject(value);
  return image ? asString(image.path) || asString(image.url) : "";
}

function parseTags(value: unknown): UpstreamTag[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry) => {
    const tag = asObject(entry);
    if (!tag) return [];

    const id = asFiniteNumber(tag.id);
    const name = asString(tag.name) || (id > 0 ? String(id) : "");
    if (!name) return [];

    const slug = asString(tag.slug);
    const count = asFiniteNumber(tag.count);
    const description = asString(tag.description);
    return [{
      id,
      type: asString(tag.type) || "tag",
      name,
      ...(slug ? { slug } : {}),
      ...(count > 0 ? { count } : {}),
      ...(description ? { description } : {}),
    }];
  });
}

function parsePages(value: unknown): UpstreamPage[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry) => {
    const page = asObject(entry);
    if (!page) return [];

    return [{
      type: asString(page.t) || asString(page.type) || "w",
      width: asFiniteNumber(page.width) || asFiniteNumber(page.w),
      height: asFiniteNumber(page.height) || asFiniteNumber(page.h),
    }];
  });
}

export function parseUpstreamGallery(value: unknown): UpstreamGallery | null {
  const gallery = asObject(value);
  if (!gallery) return null;

  const id = asFiniteNumber(gallery.id);
  const mediaId = asString(gallery.media_id) || (id > 0 ? String(id) : "");
  if (id <= 0 && !mediaId) return null;

  const title = asObject(gallery.title);
  const images = asObject(gallery.images);
  const imagePages = images?.pages;
  const englishTitle =
    asString(gallery.english_title) ||
    (title ? asString(title.english) || asString(title.pretty) : "");
  const prettyTitle =
    (title ? asString(title.pretty) || asString(title.english) : "") ||
    asString(gallery.english_title);

  return {
    id,
    mediaId,
    englishTitle,
    japaneseTitle:
      asString(gallery.japanese_title) || (title ? asString(title.japanese) : ""),
    prettyTitle,
    coverPath: readImagePath(gallery.cover),
    thumbnailPath: readImagePath(gallery.thumbnail),
    numPages:
      asFiniteNumber(gallery.num_pages) ||
      (Array.isArray(imagePages) ? imagePages.length : 0),
    numFavorites: asFiniteNumber(gallery.num_favorites),
    uploadDate: asFiniteNumber(gallery.upload_date),
    tags: parseTags(gallery.tags),
    pages: parsePages(gallery.pages ?? imagePages),
  };
}

export function parseGalleryList(value: unknown): GalleryMetrics[] | null {
  const payload = asObject(value);
  if (!payload || !Array.isArray(payload.result)) return null;

  return payload.result.flatMap((entry) => {
    const gallery = asObject(entry);
    if (!gallery) return [];
    return [{
      numPages: asFiniteNumber(gallery.num_pages),
      numFavorites: asFiniteNumber(gallery.num_favorites),
    }];
  });
}

export function parseGalleryTotal(value: unknown): number | null {
  const payload = asObject(value);
  if (!payload) return null;

  const total = asFiniteNumber(payload.total);
  if (total > 0) return total;

  const pageCount = asFiniteNumber(payload.num_pages);
  const perPage = asFiniteNumber(payload.per_page) || 25;
  return pageCount > 0 ? pageCount * perPage : null;
}

export function resolveGalleryImageUrl(
  imagePath: string,
  mediaId: string,
  kind: "cover" | "thumbnail",
): string {
  if (imagePath) {
    try {
      const url = new URL(imagePath, "https://t1.nhentai.net");
      if (
        url.protocol === "https:" &&
        url.username === "" &&
        url.password === "" &&
        ALLOWED_IMAGE_HOSTS.has(url.hostname.toLowerCase())
      ) {
        return url.toString();
      }
    } catch {
      // Use the known CDN fallback below.
    }
  }

  return /^\d+$/.test(mediaId)
    ? `https://zrocdn.xyz/galleries/${mediaId}/${kind === "cover" ? "cover" : "thumb"}.webp`
    : "";
}

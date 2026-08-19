import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const MIRROR = "http://localhost:8787";
const DIRECT_V2 = "https://nhentai.net/api/v2";
const TIMEOUT_MS = 10000;

async function fetchJson(url: string): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36",
        Accept: "application/json",
      },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

interface Tag {
  id: number;
  type: string;
  name: string;
  slug?: string;
  count?: number;
  description?: string;
}

interface GalleryDetail {
  id: number;
  media_id: string;
  title: { english: string; japanese: string; pretty: string };
  cover: string;
  thumbnail: string;
  num_pages: number;
  num_favorites: number;
  upload_date: number;
  tags: Tag[];
  pages: { t: string; w: number; h: number }[];
}

/**
 * GET /api/gallery/<id>
 * Real gallery details from the nHentai API (v2 direct, Photon proxy fallback),
 * normalized for the site's detail modal.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: "Invalid gallery id" }, { status: 400 });
  }

  let raw: any;
  let source = "v2";

  // v2 direct carries real favorites; proxy v1 zeroes them out.
  try {
    raw = await fetchJson(`${DIRECT_V2}/galleries/${id}`);
  } catch {
    try {
      raw = await fetchJson(`${MIRROR}/api/gallery/${id}`);
      source = "proxy";
    } catch {
      return NextResponse.json({ error: "Gallery unavailable" }, { status: 502 });
    }
  }

  const media_id = String(raw.media_id || raw.id || "");
  const title = {
    english: raw.english_title || raw.title?.english || raw.title?.pretty || `Gallery #${id}`,
    japanese: raw.japanese_title || raw.title?.japanese || "",
    pretty: raw.title?.pretty || raw.english_title || `Gallery #${id}`,
  };

  const tags: Tag[] = Array.isArray(raw.tags)
    ? raw.tags.map((t: any) => ({
        id: Number(t.id) || 0,
        type: t.type || "tag",
        name: t.name || String(t.id),
        slug: t.slug,
        count: t.count,
        description: t.description,
      }))
    : [];

  const detail: GalleryDetail = {
    id: Number(raw.id || id),
    media_id,
    title,
    cover:
      raw.cover?.url ||
      raw.cover ||
      (media_id ? `${MIRROR}/img?u=${encodeURIComponent(`https://zrocdn.xyz/galleries/${media_id}/cover.webp`)}` : ""),
    thumbnail:
      raw.thumbnail?.url ||
      raw.thumbnail ||
      (media_id ? `${MIRROR}/img?u=${encodeURIComponent(`https://zrocdn.xyz/galleries/${media_id}/thumb.webp`)}` : ""),
    num_pages: Number(raw.num_pages || raw.images?.pages?.length || 0),
    num_favorites: Number(raw.num_favorites || 0),
    upload_date: Number(raw.upload_date || 0),
    tags,
    pages: Array.isArray(raw.pages)
      ? raw.pages.map((p: any) => ({ t: p.t || "w", w: p.width || p.w || 0, h: p.height || p.h || 0 }))
      : [],
  };

  return NextResponse.json({ ...detail, source });
}

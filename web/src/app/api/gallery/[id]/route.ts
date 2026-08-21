import { NextRequest, NextResponse } from "next/server";
import { DIRECT_V2_BASE_URL, getMirrorBaseUrl } from "@/lib/server-config";
import {
  parseUpstreamGallery,
  resolveGalleryImageUrl,
  type UpstreamGallery,
  type UpstreamTag,
} from "@/lib/upstream-api";

export const dynamic = "force-dynamic";

const TIMEOUT_MS = 10000;

async function fetchGallery(url: string): Promise<UpstreamGallery> {
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
    const gallery = parseUpstreamGallery(await res.json());
    if (!gallery) throw new Error("Invalid gallery response");
    return gallery;
  } finally {
    clearTimeout(timer);
  }
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
  tags: UpstreamTag[];
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

  let raw: UpstreamGallery;
  let source = "v2";
  const mirrorBaseUrl = getMirrorBaseUrl();

  // v2 direct carries real favorites; proxy v1 zeroes them out.
  try {
    raw = await fetchGallery(`${DIRECT_V2_BASE_URL}/galleries/${id}`);
  } catch {
    if (!mirrorBaseUrl) {
      return NextResponse.json({ error: "Gallery unavailable" }, { status: 502 });
    }
    try {
      raw = await fetchGallery(`${mirrorBaseUrl}/api/gallery/${id}`);
      source = "proxy";
    } catch {
      return NextResponse.json({ error: "Gallery unavailable" }, { status: 502 });
    }
  }

  const media_id = raw.mediaId || String(raw.id || "");
  const title = {
    english: raw.englishTitle || raw.prettyTitle || `Gallery #${id}`,
    japanese: raw.japaneseTitle,
    pretty: raw.prettyTitle || raw.englishTitle || `Gallery #${id}`,
  };

  const detail: GalleryDetail = {
    id: raw.id || Number(id),
    media_id,
    title,
    cover: resolveGalleryImageUrl(raw.coverPath, media_id, "cover"),
    thumbnail: resolveGalleryImageUrl(raw.thumbnailPath, media_id, "thumbnail"),
    num_pages: raw.numPages,
    num_favorites: raw.numFavorites,
    upload_date: raw.uploadDate,
    tags: raw.tags,
    pages: raw.pages.map((page) => ({
      t: page.type,
      w: page.width,
      h: page.height,
    })),
  };

  return NextResponse.json({ ...detail, source });
}

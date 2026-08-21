import { NextRequest, NextResponse } from "next/server";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createAttachmentDisposition, resolveReleaseFile } from "@/lib/releases";

export const dynamic = "force-dynamic";

/**
 * GET /api/download/<file>
 * Streams a real installer from the project's release/ folder.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ file: string }> }
) {
  const { file } = await params;
  const filePath = resolveReleaseFile(file);
  if (!filePath) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const info = await stat(filePath);
  const stream = createReadStream(filePath);

  return new NextResponse(stream as unknown as ReadableStream, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Length": String(info.size),
      "Content-Disposition": createAttachmentDisposition(filePath),
      "Cache-Control": "public, max-age=3600",
    },
  });
}

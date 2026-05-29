import { get } from "@vercel/blob";
import { NextResponse } from "next/server";
import { isAllowedCatalogBlobPathname } from "@/lib/catalogBlob";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const pathname = String(searchParams.get("pathname") || "").trim();

    if (!isAllowedCatalogBlobPathname(pathname)) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const result = await get(pathname, { access: "private" });
    if (!result || result.statusCode !== 200 || !result.stream) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const headers = new Headers();
    const contentType = result.blob.contentType || "application/octet-stream";
    headers.set("Content-Type", contentType);
    if (contentType === "application/pdf") {
      headers.set("Content-Disposition", "inline");
    }
    headers.set("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
    headers.set("ETag", result.blob.etag);

    return new Response(result.stream, { status: 200, headers });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to load blob." },
      { status: 500 }
    );
  }
}

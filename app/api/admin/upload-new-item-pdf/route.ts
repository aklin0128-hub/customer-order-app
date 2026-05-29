import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { productRedisKey, saveRedisProduct } from "@/lib/productRedisStore";
import { redis } from "@/lib/redis";
import { bustServerDataCache, SERVER_CACHE } from "@/lib/serverDataCache";

export const dynamic = "force-dynamic";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "536678";
const MAX_PDF_BYTES = 12 * 1024 * 1024;

function checkAdmin(req: Request) {
  return (req.headers.get("x-admin-password") || "") === ADMIN_PASSWORD;
}

export async function POST(req: Request) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const sku = String(formData.get("sku") || "").trim().toUpperCase();
    const file = formData.get("file") as File | null;

    if (!sku) {
      return NextResponse.json({ error: "Missing SKU." }, { status: 400 });
    }

    if (!file) {
      return NextResponse.json({ error: "Missing PDF file." }, { status: 400 });
    }

    const type = String(file.type || "").toLowerCase();
    const name = String(file.name || "").toLowerCase();
    const isPdf = type === "application/pdf" || name.endsWith(".pdf");
    if (!isPdf) {
      return NextResponse.json({ error: "Only PDF files are allowed." }, { status: 400 });
    }

    if (file.size > MAX_PDF_BYTES) {
      return NextResponse.json({ error: "PDF must be 12 MB or smaller." }, { status: 400 });
    }

    const blob = await put(`new-item-pdfs/${sku}.pdf`, file, {
      access: "private",
      addRandomSuffix: true,
      contentType: "application/pdf",
    });

    const pdfUrl = `/api/blob?pathname=${encodeURIComponent(blob.pathname)}`;
    const existing = (await redis.get<Record<string, unknown>>(productRedisKey(sku))) || {};

    await saveRedisProduct({
      ...existing,
      sku,
      newItemDescriptionPdfUrl: pdfUrl,
      newItemDescriptionPdfPathname: blob.pathname,
      source: "Redis",
      updatedAt: new Date().toISOString(),
    } as { sku: string });

    bustServerDataCache(SERVER_CACHE.catalog);
    bustServerDataCache(SERVER_CACHE.showcase);

    return NextResponse.json({
      success: true,
      newItemDescriptionPdfUrl: pdfUrl,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to upload PDF.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

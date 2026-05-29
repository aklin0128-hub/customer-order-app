import { NextResponse } from "next/server";

import { attachNewItemPdfToProduct } from "@/lib/attachNewItemPdf";

export const dynamic = "force-dynamic";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "536678";

function checkAdmin(req: Request) {
  return (req.headers.get("x-admin-password") || "") === ADMIN_PASSWORD;
}

export async function POST(req: Request) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = await req.json();
    const sku = String(body?.sku || "").trim().toUpperCase();
    const pathname = String(body?.pathname || "").trim();

    if (!sku) {
      return NextResponse.json({ error: "Missing SKU." }, { status: 400 });
    }
    if (!pathname) {
      return NextResponse.json({ error: "Missing PDF pathname." }, { status: 400 });
    }

    const newItemDescriptionPdfUrl = await attachNewItemPdfToProduct(sku, pathname);

    return NextResponse.json({
      success: true,
      newItemDescriptionPdfUrl,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to register PDF.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

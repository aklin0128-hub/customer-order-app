import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/adminAuth";
import {
  getProductSheet,
  normalizeProductSheet,
  resolveProductSheet,
} from "@/lib/productSheet";
import { buildProductSheetPdf } from "@/lib/productSheetPdf";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function requestOrigin(req: Request) {
  const url = new URL(req.url);
  const proto = req.headers.get("x-forwarded-proto") || url.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || url.host;
  return `${proto}://${host}`;
}

function safeFilename(value: string) {
  return String(value || "product-sheet")
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "product-sheet";
}

export async function POST(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  try {
    const body = await req.json();
    const id = String(body?.id || "").trim();
    const saved = id ? await getProductSheet(id) : null;
    const sheet = normalizeProductSheet(saved ? { ...saved, ...body, id: saved.id } : body);
    if (!sheet) {
      return NextResponse.json({ error: "Invalid product sheet." }, { status: 400 });
    }
    if (!sheet.items.length) {
      return NextResponse.json({ error: "Add at least one product." }, { status: 400 });
    }

    const resolved = await resolveProductSheet(sheet);
    const pdf = await buildProductSheetPdf({
      sheet: resolved.sheet,
      items: resolved.items,
      origin: requestOrigin(req),
    });

    const stamp = new Date().toISOString().slice(0, 10);
    const name = safeFilename(
      [sheet.title, sheet.accountNo || sheet.customerLabel, stamp].filter(Boolean).join("-")
    );

    return new NextResponse(Buffer.from(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${name}.pdf"`,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to generate PDF.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

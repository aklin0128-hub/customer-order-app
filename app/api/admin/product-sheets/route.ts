import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/adminAuth";
import {
  deleteProductSheet,
  getProductSheet,
  listProductSheets,
  saveProductSheet,
} from "@/lib/productSheet";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  try {
    const url = new URL(req.url);
    const id = String(url.searchParams.get("id") || "").trim();
    if (id) {
      const sheet = await getProductSheet(id);
      if (!sheet) {
        return NextResponse.json({ error: "Sheet not found." }, { status: 404 });
      }
      return NextResponse.json({ success: true, sheet });
    }

    const sheets = await listProductSheets();
    return NextResponse.json({ success: true, sheets });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load product sheets.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  try {
    const body = await req.json();
    const sheet = await saveProductSheet(body || {});
    return NextResponse.json({ success: true, sheet });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to save product sheet.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  try {
    const url = new URL(req.url);
    const id = String(url.searchParams.get("id") || "").trim();
    if (!id) {
      return NextResponse.json({ error: "id is required." }, { status: 400 });
    }
    const ok = await deleteProductSheet(id);
    if (!ok) {
      return NextResponse.json({ error: "Sheet not found." }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to delete product sheet.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { lookupClearanceCatalogProduct } from "@/lib/clearance";
import {
  enrichNdhRecords,
  getNdhProducts,
  getNdhRecords,
  saveNdhRecords,
  upsertNdhRecord,
} from "@/lib/ndh";
import { bustServerDataCache, SERVER_CACHE } from "@/lib/serverDataCache";

export const dynamic = "force-dynamic";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "536678";

function checkAdmin(req: Request) {
  return (req.headers.get("x-admin-password") || "") === ADMIN_PASSWORD;
}

export async function GET(req: Request) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const url = new URL(req.url);
    const lookupSku = String(url.searchParams.get("lookupSku") || "")
      .trim()
      .toUpperCase();

    if (lookupSku) {
      const product = await lookupClearanceCatalogProduct(lookupSku);
      return NextResponse.json({ success: true, product });
    }

    const records = await getNdhRecords();
    const products = await getNdhProducts({ records });

    return NextResponse.json({
      success: true,
      items: enrichNdhRecords(records),
      products,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load NDH items.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = await req.json();
    const result = await upsertNdhRecord({
      sku: body?.sku,
      description: body?.description,
      note: body?.note,
      expiryDate: body?.expiryDate,
      clearancePrice: body?.clearancePrice,
      startDate: body?.startDate,
      saleEndDate: body?.saleEndDate,
      clearanceQty: body?.clearanceQty,
      resetSoldQty: Boolean(body?.resetSoldQty),
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    bustServerDataCache(SERVER_CACHE.ndh);

    return NextResponse.json({
      success: true,
      items: enrichNdhRecords(result.records),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to save NDH item.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const url = new URL(req.url);
    const sku = String(url.searchParams.get("sku") || "")
      .trim()
      .toUpperCase();
    const expiryDate = String(url.searchParams.get("expiryDate") || "").trim();
    if (!sku) {
      return NextResponse.json({ error: "Missing SKU." }, { status: 400 });
    }

    const current = await getNdhRecords();
    const next = current.filter((row) => {
      if (row.sku !== sku) return true;
      if (!expiryDate) return false;
      return row.expiryDate !== expiryDate;
    });
    await saveNdhRecords(next);
    bustServerDataCache(SERVER_CACHE.ndh);

    return NextResponse.json({
      success: true,
      items: enrichNdhRecords(next),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to delete NDH item.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

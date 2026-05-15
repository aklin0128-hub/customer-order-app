import { NextResponse } from "next/server";
import {
  getPromotionProducts,
  getPromotionRecords,
  savePromotionRecords,
  type PromotionRecord,
} from "@/lib/promotions";

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
    const promotions = await getPromotionRecords();
    const products = await getPromotionProducts();

    return NextResponse.json({
      success: true,
      promotions,
      products,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to load promotions." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = await req.json();
    const sku = String(body?.sku || "")
      .trim()
      .toUpperCase();
    const note = String(body?.note || "").trim();

    if (!sku) {
      return NextResponse.json({ error: "Missing SKU." }, { status: 400 });
    }

    const current = await getPromotionRecords();
    const without = current.filter((p) => p.sku !== sku);
    const next: PromotionRecord[] = [
      { sku, note, updatedAt: new Date().toISOString() },
      ...without,
    ];

    await savePromotionRecords(next);

    return NextResponse.json({
      success: true,
      promotions: next,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to save promotion." },
      { status: 500 }
    );
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

    if (!sku) {
      return NextResponse.json({ error: "Missing SKU." }, { status: 400 });
    }

    const current = await getPromotionRecords();
    const next = current.filter((p) => p.sku !== sku);
    await savePromotionRecords(next);

    return NextResponse.json({
      success: true,
      promotions: next,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to delete promotion." },
      { status: 500 }
    );
  }
}

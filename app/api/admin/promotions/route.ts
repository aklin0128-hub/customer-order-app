import { NextResponse } from "next/server";
import {
  getPromotionProducts,
  getPromotionRecords,
  getPromotionStatus,
  savePromotionRecords,
  validatePromotionInput,
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
    const products = await getPromotionProducts({ records: promotions });

    const enriched = promotions.map((record) => ({
      ...record,
      promoStatus: getPromotionStatus(record),
    }));

    return NextResponse.json({
      success: true,
      promotions: enriched,
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

    const validated = validatePromotionInput({
      sku: body?.sku,
      startDate: body?.startDate,
      endDate: body?.endDate,
      promoQty: body?.promoQty,
      promoPrice: body?.promoPrice,
      buyQty: body?.buyQty,
      getQtyFree: body?.getQtyFree,
    });

    if ("error" in validated && validated.error) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    const sku = validated.record!.sku!;
    const note = String(body?.note || "").trim();
    const startDate = validated.record!.startDate;
    const endDate = validated.record!.endDate;
    const promoQty = validated.record!.promoQty;
    const promoPrice = validated.record!.promoPrice;
    const buyQty = validated.record!.buyQty;
    const getQtyFree = validated.record!.getQtyFree;

    const current = await getPromotionRecords();
    const existing = current.find((p) => p.sku === sku);

    const resetSoldQty = Boolean(body?.resetSoldQty);

    const nextRecord: PromotionRecord = {
      sku,
      note: note || undefined,
      startDate,
      endDate,
      promoQty,
      promoPrice,
      buyQty,
      getQtyFree,
      soldQty: resetSoldQty ? 0 : existing?.soldQty || 0,
      updatedAt: new Date().toISOString(),
    };

    const without = current.filter((p) => p.sku !== sku);
    const next: PromotionRecord[] = [nextRecord, ...without];

    await savePromotionRecords(next);

    return NextResponse.json({
      success: true,
      promotions: next.map((record) => ({
        ...record,
        promoStatus: getPromotionStatus(record),
      })),
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

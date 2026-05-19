import { NextResponse } from "next/server";
import {
  getClearanceProducts,
  getClearanceRecords,
  getClearanceStatus,
  saveClearanceRecords,
  validateClearanceInput,
  type ClearanceRecord,
} from "@/lib/clearance";

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
    const clearances = await getClearanceRecords();
    const products = await getClearanceProducts({ records: clearances });

    const enriched = clearances.map((record) => ({
      ...record,
      clearanceStatus: getClearanceStatus(record),
    }));

    return NextResponse.json({
      success: true,
      clearances: enriched,
      products,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to load clearance items." },
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

    const validated = validateClearanceInput({
      sku: body?.sku,
      note: body?.note,
      expiryDate: body?.expiryDate,
      clearancePrice: body?.clearancePrice,
      startDate: body?.startDate,
      saleEndDate: body?.saleEndDate,
      clearanceQty: body?.clearanceQty,
    });

    if ("error" in validated && validated.error) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    const sku = validated.record!.sku!;
    const current = await getClearanceRecords();
    const existing = current.find((p) => p.sku === sku);
    const resetSoldQty = Boolean(body?.resetSoldQty);

    const nextRecord: ClearanceRecord = {
      sku,
      note: validated.record!.note,
      expiryDate: validated.record!.expiryDate!,
      clearancePrice: validated.record!.clearancePrice!,
      startDate: validated.record!.startDate,
      saleEndDate: validated.record!.saleEndDate,
      clearanceQty: validated.record!.clearanceQty,
      soldQty: resetSoldQty ? 0 : existing?.soldQty || 0,
      updatedAt: new Date().toISOString(),
    };

    const without = current.filter((p) => p.sku !== sku);
    const next: ClearanceRecord[] = [nextRecord, ...without];

    await saveClearanceRecords(next);

    return NextResponse.json({
      success: true,
      clearances: next.map((record) => ({
        ...record,
        clearanceStatus: getClearanceStatus(record),
      })),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to save clearance item." },
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

    const current = await getClearanceRecords();
    const next = current.filter((p) => p.sku !== sku);
    await saveClearanceRecords(next);

    return NextResponse.json({
      success: true,
      clearances: next,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to delete clearance item." },
      { status: 500 }
    );
  }
}

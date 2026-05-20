import { NextResponse } from "next/server";
import { getPromoRoi } from "@/lib/promoRoi";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await getPromoRoi(30);
    return NextResponse.json({ success: true, rows });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load promo ROI.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

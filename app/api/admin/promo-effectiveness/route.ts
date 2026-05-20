import { NextResponse } from "next/server";
import { getPromoEffectiveness } from "@/lib/businessInsights";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") || 50)));
    const rows = await getPromoEffectiveness(limit);
    return NextResponse.json({ success: true, rows });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load promo stats.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

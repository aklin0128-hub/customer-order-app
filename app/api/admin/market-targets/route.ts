import { NextResponse } from "next/server";
import { getMarketTargets, saveMarketTargets, type MarketRegionTarget } from "@/lib/marketTargets";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getMarketTargets();
    return NextResponse.json({ success: true, ...data });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load targets.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const regions = (body?.regions || []) as MarketRegionTarget[];
    const saved = await saveMarketTargets(regions);
    return NextResponse.json({ success: true, ...saved });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to save targets.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

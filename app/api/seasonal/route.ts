import { NextResponse } from "next/server";
import { getSeasonalItemProducts } from "@/lib/seasonalItems";
import { cachedServerData, SERVER_CACHE } from "@/lib/serverDataCache";

export const dynamic = "force-dynamic";

const CACHE_CONTROL = "public, s-maxage=60, stale-while-revalidate=300";

export async function GET() {
  try {
    const products = await cachedServerData(SERVER_CACHE.seasonal, "active", () =>
      getSeasonalItemProducts()
    );

    const res = NextResponse.json({
      success: true,
      products,
    });
    res.headers.set("Cache-Control", CACHE_CONTROL);
    return res;
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to load Seasonal items." },
      { status: 500 }
    );
  }
}

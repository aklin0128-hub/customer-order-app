import { NextResponse } from "next/server";
import { getPromotionProducts } from "@/lib/promotions";
import { cachedServerData, SERVER_CACHE } from "@/lib/serverDataCache";

export const dynamic = "force-dynamic";

const CACHE_CONTROL = "public, s-maxage=120, stale-while-revalidate=600";

export async function GET() {
  try {
    const products = await cachedServerData(SERVER_CACHE.promotions, "active", () =>
      getPromotionProducts({ activeOnly: true })
    );

    const res = NextResponse.json({
      success: true,
      products,
    });
    res.headers.set("Cache-Control", CACHE_CONTROL);
    return res;
  } catch (error: any) {
    const res = NextResponse.json(
      { error: error?.message || "Failed to load promotions." },
      { status: 500 }
    );
    return res;
  }
}

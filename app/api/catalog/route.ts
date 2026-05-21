import { NextResponse } from "next/server";
import { getMergedCatalogProducts } from "@/lib/catalogMerge";
import { cachedServerData, SERVER_CACHE } from "@/lib/serverDataCache";

export const dynamic = "force-dynamic";

const CACHE_CONTROL = "public, s-maxage=120, stale-while-revalidate=600";

export async function GET() {
  try {
    const products = await cachedServerData(SERVER_CACHE.catalog, "merged", () =>
      getMergedCatalogProducts()
    );

    const res = NextResponse.json({
      success: true,
      products,
    });
    res.headers.set("Cache-Control", CACHE_CONTROL);
    return res;
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to load catalog." },
      { status: 500 }
    );
  }
}
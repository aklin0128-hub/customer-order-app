import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import catalogData from "@/data/catalog_sku_master_extracted.json";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const map = new Map<string, any>();

    for (const item of catalogData as any[]) {
      const sku = String(item.sku || "")
        .trim()
        .toUpperCase();
      if (!sku || sku.includes(" ")) continue;

      map.set(sku, {
        ...item,
        sku,
      });
    }

    const keys = await redis.keys("product:*");
    const redisProducts = await Promise.all(keys.map((key) => redis.get<any>(key)));

    for (const item of redisProducts) {
      if (!item?.sku) continue;

      const sku = String(item.sku).toUpperCase();

      map.set(sku, {
        ...(map.get(sku) || {}),
        ...item,
        sku,
      });
    }

    const res = NextResponse.json({
      success: true,
      products: Array.from(map.values()),
    });
    res.headers.set("Cache-Control", "public, s-maxage=120, stale-while-revalidate=600");
    return res;
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to load catalog." },
      { status: 500 }
    );
  }
}
import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import catalogData from "@/data/catalog_sku_master_extracted.json";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const map = new Map<string, any>();

    for (const item of catalogData as any[]) {
      if (!item.sku) continue;

      const sku = String(item.sku).toUpperCase();

      map.set(sku, {
        ...item,
        sku,
      });
    }

    const keys = await redis.keys("product:*");

    for (const key of keys) {
      const item = await redis.get<any>(key);
      if (!item?.sku) continue;

      const sku = String(item.sku).toUpperCase();

      map.set(sku, {
        ...(map.get(sku) || {}),
        ...item,
        sku,
      });
    }

    return NextResponse.json({
      success: true,
      products: Array.from(map.values()),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to load catalog." },
      { status: 500 }
    );
  }
}
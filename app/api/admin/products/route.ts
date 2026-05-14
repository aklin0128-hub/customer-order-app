import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import catalogData from "@/data/catalog_sku_master_extracted.json";

export const dynamic = "force-dynamic";

type Product = {
  sku: string;
  name?: string;
  brand?: string;
  status?: string;
  size?: string;
  barcode?: string;
  upc?: string;
};

export async function GET() {
  try {
    const map = new Map<string, Product>();

    for (const item of catalogData as Product[]) {
      if (!item.sku) continue;
      map.set(item.sku.toUpperCase(), { ...item, sku: item.sku.toUpperCase() });
    }

    const keys = await redis.keys("product:*");

    for (const key of keys) {
      const item = await redis.get<Product>(key);
      if (!item?.sku) continue;

      const sku = item.sku.toUpperCase();
      map.set(sku, {
        ...(map.get(sku) || {}),
        ...item,
        sku,
      });
    }

    return NextResponse.json({
      success: true,
      products: Array.from(map.values()).sort((a, b) =>
        a.sku.localeCompare(b.sku)
      ),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to load products." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const sku = String(body?.sku || "").trim().toUpperCase();
    const name = String(body?.name || "").trim();
    const brand = String(body?.brand || "").trim();
    const status = String(body?.status || "").trim().toUpperCase();
    const size = String(body?.size || "").trim();
    const barcode = String(body?.barcode || "").trim();
    const upc = String(body?.upc || "").trim();

    if (!sku) {
      return NextResponse.json({ error: "Missing SKU." }, { status: 400 });
    }

    const product = {
      sku,
      name,
      brand,
      status,
      size,
      barcode,
      upc,
      updatedAt: new Date().toISOString(),
      source: "Redis",
    };

    await redis.set(`product:${sku}`, product);

    return NextResponse.json({
      success: true,
      product,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to save product." },
      { status: 500 }
    );
  }
}
import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import catalogData from "@/data/catalog_sku_master_extracted.json";

export const dynamic = "force-dynamic";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "536678";

type Product = {
  sku: string;
  name?: string;
  brand?: string;
  status?: string;
  size?: string;
  barcode?: string;
  upc?: string;
  limitedQty?: string;
  palletSize?: string;
  imageUrl?: string;
  source?: string;
  updatedAt?: string;
};

function checkAdmin(req: Request) {
  return (req.headers.get("x-admin-password") || "") === ADMIN_PASSWORD;
}

export async function GET(req: Request) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const map = new Map<string, Product>();

    for (const item of catalogData as Product[]) {
      if (!item.sku) continue;

      const sku = String(item.sku).toUpperCase();

      map.set(sku, {
        ...item,
        sku,
        source: "Catalog",
      });
    }

    const keys = await redis.keys("product:*");

    for (const key of keys) {
      const item = await redis.get<Product>(key);
      if (!item?.sku) continue;

      const sku = String(item.sku).toUpperCase();

      map.set(sku, {
        ...(map.get(sku) || {}),
        ...item,
        sku,
        source: "Redis",
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
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = await req.json();

    const sku = String(body?.sku || "").trim().toUpperCase();
    const name = String(body?.name || "").trim();
    const brand = String(body?.brand || "").trim();
    const status = String(body?.status || "").trim().toUpperCase();
    const size = String(body?.size || "").trim();
    const barcode = String(body?.barcode || "").trim();
    const upc = String(body?.upc || "").trim();
    const limitedQty = String(body?.limitedQty || "").trim();
    const palletSize = String(body?.palletSize || "").trim();
    const imageUrl = String(body?.imageUrl || "").trim();

    if (!sku) {
      return NextResponse.json({ error: "Missing SKU." }, { status: 400 });
    }

    const product: Product = {
      sku,
      name,
      brand,
      status,
      size,
      barcode,
      upc,
      limitedQty,
      palletSize,
      imageUrl,
      source: "Redis",
      updatedAt: new Date().toISOString(),
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
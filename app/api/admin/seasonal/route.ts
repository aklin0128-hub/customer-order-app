import { NextResponse } from "next/server";
import {
  getSeasonalItemProducts,
  getSeasonalItemRecords,
  lookupSeasonalItemCatalogProduct,
  parseSeasonalItemSkuList,
  saveSeasonalItemRecords,
  type SeasonalItemRecord,
} from "@/lib/seasonalItems";
import { bustServerDataCache, SERVER_CACHE } from "@/lib/serverDataCache";

export const dynamic = "force-dynamic";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "536678";

function checkAdmin(req: Request) {
  return (req.headers.get("x-admin-password") || "") === ADMIN_PASSWORD;
}

function bust() {
  bustServerDataCache(SERVER_CACHE.seasonal);
}

export async function GET(req: Request) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const url = new URL(req.url);
    const lookupSku = String(url.searchParams.get("lookupSku") || "")
      .trim()
      .toUpperCase();

    if (lookupSku) {
      const product = await lookupSeasonalItemCatalogProduct(lookupSku);
      return NextResponse.json({ success: true, product });
    }

    const records = await getSeasonalItemRecords();
    const products = await getSeasonalItemProducts({ records });

    return NextResponse.json({
      success: true,
      records,
      products,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to load Seasonal." },
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
    const bulkText = String(body?.text || body?.bulkText || "").trim();

    if (bulkText) {
      const skus = parseSeasonalItemSkuList(bulkText);
      if (skus.length === 0) {
        return NextResponse.json({ error: "Paste at least one SKU." }, { status: 400 });
      }

      const existing = await getSeasonalItemRecords();
      const map = new Map(existing.map((r) => [r.sku, r]));
      const added: string[] = [];
      const skippedExisting: string[] = [];
      const missingCatalog: string[] = [];

      for (const sku of skus) {
        if (map.has(sku)) {
          skippedExisting.push(sku);
          continue;
        }
        const product = await lookupSeasonalItemCatalogProduct(sku);
        if (!product?.name) missingCatalog.push(sku);
        map.set(sku, {
          sku,
          updatedAt: new Date().toISOString(),
        });
        added.push(sku);
      }

      const next = Array.from(map.values());
      await saveSeasonalItemRecords(next);
      bust();

      return NextResponse.json({
        success: true,
        added,
        skippedExisting,
        missingCatalog,
        records: next,
        products: await getSeasonalItemProducts({ records: next }),
      });
    }

    const sku = String(body?.sku || "")
      .trim()
      .toUpperCase();
    if (!sku) {
      return NextResponse.json({ error: "Missing SKU." }, { status: 400 });
    }

    const note = String(body?.note || "").trim() || undefined;
    const sortRaw = body?.sortOrder;
    const sortOrder =
      sortRaw === undefined || sortRaw === null || sortRaw === ""
        ? undefined
        : Number.isFinite(Number(sortRaw))
          ? Math.floor(Number(sortRaw))
          : undefined;

    const existing = await getSeasonalItemRecords();
    const next: SeasonalItemRecord[] = existing.filter((r) => r.sku !== sku);
    next.push({
      sku,
      note,
      sortOrder,
      updatedAt: new Date().toISOString(),
    });
    await saveSeasonalItemRecords(next);
    bust();

    return NextResponse.json({
      success: true,
      records: next,
      products: await getSeasonalItemProducts({ records: next }),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to save Seasonal item." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const url = new URL(req.url);
    const sku = String(url.searchParams.get("sku") || "")
      .trim()
      .toUpperCase();
    if (!sku) {
      return NextResponse.json({ error: "Missing SKU." }, { status: 400 });
    }

    const existing = await getSeasonalItemRecords();
    const next = existing.filter((r) => r.sku !== sku);
    await saveSeasonalItemRecords(next);
    bust();

    return NextResponse.json({
      success: true,
      records: next,
      products: await getSeasonalItemProducts({ records: next }),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to remove Seasonal item." },
      { status: 500 }
    );
  }
}

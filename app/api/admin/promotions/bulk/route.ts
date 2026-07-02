import { NextResponse } from "next/server";

import { bulkImportPromotionSkus, getPromotionProducts, getPromotionRecords, getPromotionStatus } from "@/lib/promotions";
import { bustServerDataCache, SERVER_CACHE } from "@/lib/serverDataCache";

export const dynamic = "force-dynamic";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "536678";

function checkAdmin(req: Request) {
  return (req.headers.get("x-admin-password") || "") === ADMIN_PASSWORD;
}

export async function POST(req: Request) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = await req.json();
    const text = String(body?.text || "").trim();
    const skus = Array.isArray(body?.skus)
      ? body.skus.map((sku: unknown) => String(sku || ""))
      : text
        ? [text]
        : [];

    if (!skus.length) {
      return NextResponse.json({ error: "Paste at least one SKU." }, { status: 400 });
    }

    const result = await bulkImportPromotionSkus(skus);
    bustServerDataCache(SERVER_CACHE.promotions);
    bustServerDataCache(SERVER_CACHE.showcase);

    const promotions = await getPromotionRecords();
    const products = await getPromotionProducts({ records: promotions });

    return NextResponse.json({
      success: true,
      ...result,
      promotions: promotions.map((record) => ({
        ...record,
        promoStatus: getPromotionStatus(record),
      })),
      products,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to bulk import promotions.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

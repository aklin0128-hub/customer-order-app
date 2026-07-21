import { NextResponse } from "next/server";

import { requireExp } from "@/lib/expAuth";
import {
  lookupStatusEtaProduct,
  parseStatusEtaCsvText,
} from "@/lib/inventoryStatusEta";
import {
  getStatusEtaCsvMeta,
  loadStatusEtaProducts,
  loadUploadedStatusEtaCsvText,
} from "@/lib/inventoryStatusEtaStore";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const unauthorized = requireExp(req);
  if (unauthorized) return unauthorized;

  try {
    const url = new URL(req.url);
    const sku = url.searchParams.get("sku") || "";
    const meta = await getStatusEtaCsvMeta();

    let products = await loadStatusEtaProducts();
    if (!products.length) {
      const text = await loadUploadedStatusEtaCsvText();
      if (text) products = parseStatusEtaCsvText(text);
    }

    if (sku.trim()) {
      const result = lookupStatusEtaProduct(products, sku);
      return NextResponse.json({
        success: true,
        meta,
        ...result,
      });
    }

    return NextResponse.json({
      success: true,
      meta,
      skuCount: meta?.skuCount ?? products.length,
      rowCount: meta?.rowCount ?? 0,
      availableInvCount: products.filter((p) => p.availableInv != null).length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load status/ETA inventory.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

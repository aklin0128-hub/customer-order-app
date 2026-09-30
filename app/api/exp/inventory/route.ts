import { NextResponse } from "next/server";

import { resolveOnhandInventory } from "@/lib/catalogOnhand";
import { requireExp } from "@/lib/expAuth";
import { getSkuExpiration, loadInventoryLots } from "@/lib/inventoryExpiry";
import { getInventoryCsvMeta } from "@/lib/inventoryExpiryStore";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const unauthorized = requireExp(req);
  if (unauthorized) return unauthorized;

  try {
    const url = new URL(req.url);
    const sku = url.searchParams.get("sku") || "";

    const meta = await getInventoryCsvMeta();
    const rows = await loadInventoryLots();

    if (sku.trim()) {
      const status = url.searchParams.get("status") || undefined;
      const onlyFuture = url.searchParams.get("onlyFuture") === "1";
      const [result, onhand] = await Promise.all([
        getSkuExpiration(sku, { status, onlyFutureExpiry: onlyFuture }),
        resolveOnhandInventory(sku),
      ]);
      return NextResponse.json({
        success: true,
        meta,
        loadedRows: rows.length,
        onhandInventory: onhand.onhandInventory,
        ...result,
      });
    }

    return NextResponse.json({
      success: true,
      meta,
      loadedRows: rows.length,
      skuCount: meta?.skuCount ?? new Set(rows.map((r) => r.sku)).size,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load inventory.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";

import { getMergedCatalogProducts } from "@/lib/catalogMerge";
import { requireExp } from "@/lib/expAuth";
import {
  compactCatalogForOfflinePack,
  EXP_OFFLINE_PACK_VERSION,
  type ExpOfflinePack,
} from "@/lib/expOfflinePack";
import { loadInventoryLots } from "@/lib/inventoryExpiry";
import { getInventoryCsvMeta } from "@/lib/inventoryExpiryStore";
import { parseStatusEtaCsvText } from "@/lib/inventoryStatusEta";
import {
  getStatusEtaCsvMeta,
  loadStatusEtaProducts,
  loadUploadedStatusEtaCsvText,
} from "@/lib/inventoryStatusEtaStore";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const unauthorized = requireExp(req);
  if (unauthorized) return unauthorized;

  try {
    const [expMeta, etaMeta, lots, catalogProducts] = await Promise.all([
      getInventoryCsvMeta(),
      getStatusEtaCsvMeta(),
      loadInventoryLots(),
      getMergedCatalogProducts(),
    ]);

    let etaProducts = await loadStatusEtaProducts();
    if (!etaProducts.length) {
      const text = await loadUploadedStatusEtaCsvText();
      if (text) etaProducts = parseStatusEtaCsvText(text);
    }

    const pack: ExpOfflinePack = {
      version: EXP_OFFLINE_PACK_VERSION,
      generatedAt: new Date().toISOString(),
      expMeta: expMeta
        ? {
            uploadedAt: expMeta.uploadedAt,
            rowCount: expMeta.rowCount,
            skuCount: expMeta.skuCount,
            fileName: expMeta.fileName,
          }
        : null,
      etaMeta: etaMeta
        ? {
            uploadedAt: etaMeta.uploadedAt,
            rowCount: etaMeta.rowCount,
            skuCount: etaMeta.skuCount,
            fileName: etaMeta.fileName,
          }
        : null,
      catalog: compactCatalogForOfflinePack(catalogProducts),
      lots,
      etaProducts,
    };

    return NextResponse.json({ success: true, pack });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to build offline pack.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

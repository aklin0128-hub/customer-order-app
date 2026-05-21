import { get, put } from "@vercel/blob";

import type { InventoryLot } from "@/lib/inventoryExpiry";
import { redis } from "@/lib/redis";

export const INVENTORY_BY_ITEM_META_KEY = "inventory:by-item:meta";
export const INVENTORY_BY_ITEM_BLOB_PATH = "inventory/by-item.csv";

export type InventoryCsvMeta = {
  uploadedAt: string;
  blobPathname: string;
  rowCount: number;
  skuCount: number;
  fileName?: string;
};

export async function getInventoryCsvMeta(): Promise<InventoryCsvMeta | null> {
  const meta = await redis.get<InventoryCsvMeta>(INVENTORY_BY_ITEM_META_KEY);
  return meta?.blobPathname ? meta : null;
}

async function readBlobText(pathname: string) {
  const result = await get(pathname, { access: "private" });
  if (!result?.stream) return null;
  return new Response(result.stream).text();
}

export async function loadUploadedInventoryCsvText(): Promise<string | null> {
  const meta = await getInventoryCsvMeta();
  if (!meta?.blobPathname) return null;
  const text = await readBlobText(meta.blobPathname);
  return text?.trim() ? text : null;
}

export async function saveInventoryCsvUpload(
  csvText: string,
  stats: { rowCount: number; skuCount: number },
  fileName?: string
) {
  if (stats.rowCount <= 0) {
    throw new Error("No inventory rows found. Export the By Item sheet as CSV.");
  }

  const blob = await put(INVENTORY_BY_ITEM_BLOB_PATH, csvText, {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "text/csv",
  });

  const meta: InventoryCsvMeta = {
    uploadedAt: new Date().toISOString(),
    blobPathname: blob.pathname,
    rowCount: stats.rowCount,
    skuCount: stats.skuCount,
    fileName: fileName || undefined,
  };

  await redis.set(INVENTORY_BY_ITEM_META_KEY, meta);

  return meta;
}

export function summarizeInventoryRows(rows: InventoryLot[]) {
  return {
    rowCount: rows.length,
    skuCount: new Set(rows.map((r) => r.sku)).size,
  };
}

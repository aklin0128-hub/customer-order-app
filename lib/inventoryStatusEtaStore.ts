import { get, put } from "@vercel/blob";

import type { StatusEtaProduct } from "@/lib/inventoryStatusEta";
import { redis } from "@/lib/redis";

export const INVENTORY_STATUS_ETA_META_KEY = "inventory:status-eta:meta";
export const INVENTORY_STATUS_ETA_BLOB_PATH = "inventory/status-eta.csv";
export const INVENTORY_STATUS_ETA_JSON_KEY = "inventory:status-eta:products";

export type StatusEtaCsvMeta = {
  uploadedAt: string;
  blobPathname: string;
  rowCount: number;
  skuCount: number;
  fileName?: string;
};

export async function getStatusEtaCsvMeta(): Promise<StatusEtaCsvMeta | null> {
  const meta = await redis.get<StatusEtaCsvMeta>(INVENTORY_STATUS_ETA_META_KEY);
  return meta?.blobPathname ? meta : null;
}

async function readBlobText(pathname: string) {
  const result = await get(pathname, { access: "private" });
  if (!result?.stream) return null;
  return new Response(result.stream).text();
}

export async function loadUploadedStatusEtaCsvText(): Promise<string | null> {
  const meta = await getStatusEtaCsvMeta();
  if (!meta?.blobPathname) return null;
  const text = await readBlobText(meta.blobPathname);
  return text?.trim() ? text : null;
}

export async function saveStatusEtaUpload(
  csvText: string,
  products: StatusEtaProduct[],
  stats: { rowCount: number; skuCount: number },
  fileName?: string
) {
  if (stats.skuCount <= 0) {
    throw new Error(
      "No status/ETA rows found. Use columns PID, Description, Status, Aval. INV, Port ETA, Inbound QTY."
    );
  }

  const blob = await put(INVENTORY_STATUS_ETA_BLOB_PATH, csvText, {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "text/csv",
  });

  const meta: StatusEtaCsvMeta = {
    uploadedAt: new Date().toISOString(),
    blobPathname: blob.pathname,
    rowCount: stats.rowCount,
    skuCount: stats.skuCount,
    fileName: fileName || undefined,
  };

  await redis.set(INVENTORY_STATUS_ETA_META_KEY, meta);
  await redis.set(INVENTORY_STATUS_ETA_JSON_KEY, products);

  return meta;
}

export async function loadStatusEtaProducts(): Promise<StatusEtaProduct[]> {
  const cached = await redis.get<StatusEtaProduct[]>(INVENTORY_STATUS_ETA_JSON_KEY);
  if (Array.isArray(cached) && cached.length > 0) return cached;

  const { parseStatusEtaCsvText } = await import("@/lib/inventoryStatusEta");
  const text = await loadUploadedStatusEtaCsvText();
  if (!text) return [];
  const products = parseStatusEtaCsvText(text);
  if (products.length) {
    await redis.set(INVENTORY_STATUS_ETA_JSON_KEY, products);
  }
  return products;
}

import fs from "node:fs";

import {
  parseInventoryCsvText,
  replaceInventoryCache,
  type InventoryLot,
} from "@/lib/inventoryExpiry";

/** Tests / local scripts only — not imported by API routes. */
export async function loadInventoryLotsFromFile(filePath: string): Promise<InventoryLot[]> {
  if (!fs.existsSync(filePath)) return [];

  const stat = fs.statSync(filePath);
  const sourceKey = `file:${filePath}:${stat.mtimeMs}`;
  const raw = fs.readFileSync(filePath, "utf-8");
  const rows = parseInventoryCsvText(raw);
  replaceInventoryCache(sourceKey, rows);
  return rows;
}

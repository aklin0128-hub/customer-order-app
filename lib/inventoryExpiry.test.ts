import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import * as XLSX from "xlsx";

import {
  getSkuExpiration,
  normalizeInventorySku,
  parseInventoryCsvText,
  skuLookupKeys,
} from "@/lib/inventoryExpiry";
import { loadInventoryLotsFromFile } from "@/lib/inventoryExpiry.local";
import { parseInventoryXlsxBuffer } from "@/lib/inventoryExpiryXlsx";

const SAMPLE_CSV = `Loc Item,Loc Item Desc,Loc Qty UM,Loc Inventory Status,Loc Received Date,Loc Expire Date,Loc On Hand Qty
000020,"PREMIUM MEDIUM GRAIN RICE",BG,Available,2/11/2026,2/10/2028,100
000020,"PREMIUM MEDIUM GRAIN RICE",BG,Damaged,1/5/2026,3/15/2028,5
000030,"EXTRA FANCY RICE",CS,Available,2/1/2026,6/1/2027,50
`;

test("skuLookupKeys bridges catalog and inventory formats", () => {
  assert.ok(skuLookupKeys("00002D").includes("00002"));
  assert.ok(skuLookupKeys("000020").includes("00002"));
});

test("getSkuExpiration returns lots and sorted expire dates", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "inv-exp-"));
  const filePath = path.join(dir, "inventory.csv");
  fs.writeFileSync(filePath, SAMPLE_CSV, "utf-8");

  const result = await getSkuExpiration("00002D", { filePath, status: "Available" });

  assert.equal(result.found, true);
  assert.equal(result.lots.length, 1);
  assert.equal(result.earliestExpireDate, "2028-02-10");

  await loadInventoryLotsFromFile(filePath);
  assert.equal(normalizeInventorySku(" 000030 "), "000030");
});

test("parseInventoryCsvText rejects missing columns", () => {
  assert.throws(() => parseInventoryCsvText("a,b\n1,2"), /Loc Item/);
});

test("parseInventoryXlsxBuffer reads By Item sheet", () => {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    [
      "Loc Item",
      "Loc Item Desc",
      "Loc Qty UM",
      "Loc Inventory Status",
      "Loc Received Date",
      "Loc Expire Date",
      "Loc On Hand Qty",
    ],
    ["000020", "RICE", "BG", "Available", "2/11/2026", "2/10/2028", 100],
  ]);
  XLSX.utils.book_append_sheet(workbook, sheet, "By Item");
  const buffer = Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));

  const { rows } = parseInventoryXlsxBuffer(buffer);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.sku, "000020");
  assert.equal(rows[0]?.expireDate, "2028-02-10");
});

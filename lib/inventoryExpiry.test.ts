import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import * as XLSX from "xlsx";

import {
  getSkuExpiration,
  getSkuExpirationFromRows,
  mergeInventoryLotsByReceivedAndExpire,
  normalizeInventorySku,
  parseInventoryCsvText,
  parseInventoryDate,
  sortInventoryLotsByExpireDate,
  skuLookupKeys,
  type InventoryLot,
} from "@/lib/inventoryExpiry";
import { loadInventoryLotsFromFile } from "@/lib/inventoryExpiry.local";
import { parseInventoryXlsxBuffer } from "@/lib/inventoryExpiryXlsx";

const SAMPLE_CSV = `Loc Item,Loc Item Desc,Loc Qty UM,Loc Inventory Status,Loc Received Date,Loc Expire Date,Loc On Hand Qty
00002D,"PREMIUM MEDIUM GRAIN RICE (USA, 15#_NEW)",BG,Available,2/11/2026,2/10/2028,473
00002D,"PREMIUM MEDIUM GRAIN RICE (USA, 15#_NEW)",BG,Available,2/19/2026,2/18/2028,319
00002D,"PREMIUM MEDIUM GRAIN RICE (USA, 15#_NEW)",BG,Damaged,2/11/2026,2/10/2028,1
000030,"EXTRA FANCY RICE",CS,Available,2/1/2026,6/1/2027,50
`;

test("skuLookupKeys bridges catalog and inventory formats", () => {
  assert.ok(skuLookupKeys("00002D").includes("00002"));
  assert.ok(skuLookupKeys("000020").includes("00002"));
});

test("normalizeInventorySku restores Excel-truncated loc items", () => {
  assert.equal(normalizeInventorySku("2D"), "00002D");
  assert.equal(normalizeInventorySku("20"), "000020");
  assert.equal(normalizeInventorySku(" 000030 "), "000030");
  assert.equal(normalizeInventorySku("10480K"), "10480K");
});

test("getSkuExpiration finds catalog sku when csv has truncated loc item", () => {
  const csv = `Loc Item,Loc Item Desc,Loc Qty UM,Loc Inventory Status,Loc Received Date,Loc Expire Date,Loc On Hand Qty
2D,RICE,BG,Available,2/11/2026,2/10/2028,10
`;
  const result = getSkuExpirationFromRows("00002D", parseInventoryCsvText(csv));
  assert.equal(result.found, true);
  assert.equal(result.lots.length, 1);
});

test("getSkuExpiration returns lots and sorted expire dates", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "inv-exp-"));
  const filePath = path.join(dir, "inventory.csv");
  fs.writeFileSync(filePath, SAMPLE_CSV, "utf-8");

  const result = await getSkuExpiration("00002D", { filePath, status: "Available" });

  assert.equal(result.found, true);
  assert.equal(result.lots.length, 2);
  assert.equal(result.earliestExpireDate, "2028-02-10");
  assert.ok(result.expireDates.includes("2028-02-18"));
  assert.equal(result.lots[0]?.receivedDate, "2026-02-11");
  assert.equal(result.lots[0]?.expireDate, "2028-02-10");
  assert.equal(result.lots[1]?.expireDate, "2028-02-18");

  await loadInventoryLotsFromFile(filePath);
  assert.equal(normalizeInventorySku(" 000030 "), "000030");
});

test("sortInventoryLotsByExpireDate orders earliest expire first", () => {
  const lots: InventoryLot[] = [
    { sku: "00033D", expireDate: "2028-05-07", onHandQty: 1 },
    { sku: "00033D", expireDate: "2027-05-11", onHandQty: 2 },
    { sku: "00033D", expireDate: "2028-03-09", onHandQty: 3 },
    { sku: "00033D", onHandQty: 4 },
  ];
  const sorted = sortInventoryLotsByExpireDate(lots);
  assert.deepEqual(
    sorted.map((l) => l.expireDate || ""),
    ["2027-05-11", "2028-03-09", "2028-05-07", ""]
  );
});

test("parseInventoryCsvText rejects missing columns", () => {
  assert.throws(() => parseInventoryCsvText("a,b\n1,2"), /Loc Item/);
});

test("parseInventoryCsvText skips title rows and carries forward blank Loc Item", () => {
  const csv = `Inventory Exp Report,,,,,,
Loc Item,Loc Item Desc,Loc Qty UM,Loc Inventory Status,Loc Received Date,Loc Expire Date,Loc On Hand Qty
00002D,RICE,BG,Available,2/11/2026,2/10/2028,473
,RICE,BG,Available,2/19/2026,2/18/2028,319
000030,RICE 2,CS,Available,2/1/2026,6/1/2027,50
`;
  const rows = parseInventoryCsvText(csv);
  assert.equal(rows.length, 3);
  assert.equal(rows[0]?.sku, "00002D");
  assert.equal(rows[0]?.expireDate, "2028-02-10");
  assert.equal(rows[1]?.sku, "00002D");
  assert.equal(rows[1]?.expireDate, "2028-02-18");
  assert.equal(rows[1]?.onHandQty, 319);
});

test("parseInventoryXlsxBuffer carries forward blank Loc Item cells", () => {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    ["Loc Item", "Loc Expire Date", "Loc On Hand Qty", "Loc Inventory Status"],
    ["00033D", "2/10/2028", 10, "Available"],
    ["", "2/18/2028", 20, "Available"],
  ]);
  XLSX.utils.book_append_sheet(workbook, sheet, "By Item");
  const buffer = Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));

  const { rows } = parseInventoryXlsxBuffer(buffer);
  assert.equal(rows.length, 2);
  assert.equal(rows[0]?.sku, "00033D");
  assert.equal(rows[1]?.sku, "00033D");
  assert.equal(rows[1]?.expireDate, "2028-02-18");
});

test("parseInventoryDate handles Excel serial numbers", () => {
  assert.equal(parseInventoryDate("2/10/2028"), "2028-02-10");
  assert.equal(parseInventoryDate(45323)?.startsWith("2024"), true);
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
    ["000020", "RICE", "BG", "Available", new Date(2026, 1, 11), new Date(2028, 1, 10), 100],
  ]);
  XLSX.utils.book_append_sheet(workbook, sheet, "By Item");
  const buffer = Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));

  const { rows } = parseInventoryXlsxBuffer(buffer);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.sku, "000020");
  assert.equal(rows[0]?.receivedDate, "2026-02-11");
  assert.equal(rows[0]?.expireDate, "2028-02-10");
});

test("parseInventoryXlsxBuffer skips title rows before headers", () => {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    ["Inventory Exp Report"],
    ["Generated", "5/12/2026"],
    [],
    [
      "Loc Item",
      "Loc Item Desc",
      "Loc Qty UM",
      "Loc Inventory Status",
      "Loc Received Date",
      "Loc Expire Date",
      "Loc On Hand Qty",
    ],
    ["29931V", "SAMPLE PRODUCT", "CS", "Available", "2/11/2026", "2/10/2028", 859],
  ]);
  XLSX.utils.book_append_sheet(workbook, sheet, "Inventory Exp Report");
  const buffer = Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));

  const { rows } = parseInventoryXlsxBuffer(buffer);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.sku, "29931V");
  assert.equal(rows[0]?.receivedDate, "2026-02-11");
  assert.equal(rows[0]?.expireDate, "2028-02-10");
});

test("mergeInventoryLotsByReceivedAndExpire sums on hand when received and expire match", () => {
  const merged = mergeInventoryLotsByReceivedAndExpire([
    {
      sku: "10480K",
      receivedDate: "2026-03-19",
      expireDate: "2028-09-14",
      onHandQty: 50,
      location: "BIN-A",
    },
    {
      sku: "10480K",
      receivedDate: "2026-03-19",
      expireDate: "2028-09-14",
      onHandQty: 40,
      location: "BIN-B",
    },
    {
      sku: "10480K",
      receivedDate: "2026-03-02",
      expireDate: "2028-09-14",
      onHandQty: 40,
    },
  ]);
  assert.equal(merged.length, 2);
  const mar19 = merged.find((l) => l.receivedDate === "2026-03-19");
  assert.equal(mar19?.onHandQty, 90);
  assert.equal(mar19?.location, "BIN-A; BIN-B");
});

test("getSkuExpiration merges lots with same received and expire dates", () => {
  const rows: InventoryLot[] = [
    {
      sku: "10480K",
      status: "Available",
      receivedDate: "2026-03-19",
      expireDate: "2028-09-14",
      onHandQty: 50,
    },
    {
      sku: "10480K",
      status: "Available",
      receivedDate: "2026-03-19",
      expireDate: "2028-09-14",
      onHandQty: 40,
    },
    {
      sku: "10480K",
      status: "Available",
      receivedDate: "2026-03-19",
      expireDate: "2028-09-14",
      onHandQty: 0,
    },
    {
      sku: "10480K",
      status: "Available",
      receivedDate: "2026-03-02",
      expireDate: "2028-09-14",
      onHandQty: 40,
    },
  ];
  const result = getSkuExpirationFromRows("10480K", rows);
  assert.equal(result.lots.length, 2);
  assert.equal(
    result.lots.find((l) => l.receivedDate === "2026-03-19")?.onHandQty,
    90
  );
  assert.equal(result.totalOnHandQty, 130);
});

test("parseInventoryXlsxBuffer reads Loca/Local column headers", () => {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    ["Loc Item", "Loca Received Date", "Local Expire Date", "Loc On Hand Qty"],
    ["000033", 46064, 49500, 50],
  ]);
  XLSX.utils.book_append_sheet(workbook, sheet, "Inventory Exp Report");
  const buffer = Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));

  const { rows } = parseInventoryXlsxBuffer(buffer);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.sku, "000033");
  assert.ok(rows[0]?.expireDate);
  assert.ok(rows[0]?.receivedDate);
});

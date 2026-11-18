import assert from "node:assert/strict";
import test from "node:test";
import * as XLSX from "xlsx";

import { resolveOnhandInventory } from "./catalogOnhand";
import { parseInventoryFromXlsxRow, parseProductFieldsFromXlsxRow } from "./catalogXlsxFields";

test("parseInventoryFromXlsxRow reads INV (10)", () => {
  assert.equal(parseInventoryFromXlsxRow({ PID: "00002D", "INV (10)": 869 }), 869);
  assert.equal(parseInventoryFromXlsxRow({ PID: "00002D", INV: "1,234" }), 1234);
});

test("parseProductFieldsFromXlsxRow includes inventory from today_update columns", () => {
  const fields = parseProductFieldsFromXlsxRow(
    {
      PID: "00002D",
      Description: "RICE",
      "INV (10)": 869,
      UPC: "081652000020",
    },
    "00002D"
  );
  assert.equal(fields.inventory, 869);
});

test("today_update.xlsx INV column parses for sample PID", () => {
  const wb = XLSX.readFile("catalog_updates/today_update.xlsx");
  const sheet = wb.Sheets.Export || wb.Sheets[wb.SheetNames[0]!];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: true });
  const row = rows.find((r) => String(r.PID || "").toUpperCase() === "00002D");
  assert.ok(row);
  assert.equal(parseInventoryFromXlsxRow(row!), 869);
});

test("resolveOnhandInventory falls back to catalog INV", async () => {
  const result = await resolveOnhandInventory("00002D");
  assert.equal(result.sku, "00002D");
  assert.equal(typeof result.onhandInventory, "number");
  assert.ok((result.onhandInventory ?? -1) >= 0);
});

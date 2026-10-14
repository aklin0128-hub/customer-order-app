import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeProductSheet,
  resolveSheetItems,
  type ProductSheet,
} from "./productSheet";

test("normalizeProductSheet keeps order and dedupes SKUs", () => {
  const sheet = normalizeProductSheet({
    title: " Guest pack ",
    customerLabel: "ABC Market",
    accountNo: "fl0156",
    showPrice: true,
    items: [{ sku: "00002d" }, { sku: "00003D", note: "hot" }, { sku: "00002D" }, { sku: "" }],
  });

  assert.ok(sheet);
  assert.equal(sheet!.title, "Guest pack");
  assert.equal(sheet!.accountNo, "FL0156");
  assert.equal(sheet!.items.length, 2);
  assert.deepEqual(
    sheet!.items.map((item) => item.sku),
    ["00002D", "00003D"]
  );
  assert.equal(sheet!.items[1]?.note, "hot");
});

test("resolveSheetItems uses catalog fields and optional price", () => {
  const sheet: ProductSheet = {
    id: "ps_test",
    title: "Test",
    showPrice: true,
    items: [{ sku: "00002D" }, { sku: "MISSING" }],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };

  const resolved = resolveSheetItems(sheet, [
    {
      sku: "00002D",
      name: "Rice",
      brand: "Brand",
      size: "20LB",
      bp: 12.5,
    },
  ]);

  assert.equal(resolved[0]?.name, "Rice");
  assert.equal(resolved[0]?.priceLabel, "$12.50");
  assert.equal(resolved[0]?.imageUrl, "/product/00002D.jpg");
  assert.equal(resolved[1]?.sku, "MISSING");
  assert.equal(resolved[1]?.name, undefined);
});

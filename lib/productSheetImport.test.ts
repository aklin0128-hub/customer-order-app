import assert from "node:assert/strict";
import test from "node:test";

import { mergeSheetItemsWithImport } from "./productSheetImport";

test("mergeSheetItemsWithImport appends new SKUs and skips duplicates", () => {
  const result = mergeSheetItemsWithImport(
    [{ sku: "00002D", name: "Existing" }],
    [
      { sku: "00002d", name: "Dup" },
      { sku: "00003D", name: "Noodle", brand: "Brand" },
      { sku: "" },
    ]
  );

  assert.equal(result.added, 1);
  assert.equal(result.skipped, 1);
  assert.equal(result.items.length, 2);
  assert.equal(result.items[1]?.sku, "00003D");
  assert.equal((result.items[1] as { imageUrl?: string }).imageUrl, "/product/00003D.jpg");
});

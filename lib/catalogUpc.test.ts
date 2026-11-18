import assert from "node:assert/strict";
import { test } from "node:test";

import { barcodeFormatForUpc, resolveCatalogUpc } from "@/lib/catalogUpc";

test("resolveCatalogUpc prefers upc then barcode", () => {
  assert.equal(resolveCatalogUpc({ upc: "081652000020", barcode: "123" }), "081652000020");
  assert.equal(resolveCatalogUpc({ upc: "", barcode: "8801176101018" }), "8801176101018");
  assert.equal(resolveCatalogUpc({ upc: "12", barcode: "34" }), "");
});

test("barcodeFormatForUpc picks format by length", () => {
  assert.equal(barcodeFormatForUpc("081652000020"), "UPC");
  assert.equal(barcodeFormatForUpc("8801176101018"), "EAN13");
  assert.equal(barcodeFormatForUpc("12345678"), "EAN8");
  assert.equal(barcodeFormatForUpc("ABC123"), "CODE128");
});

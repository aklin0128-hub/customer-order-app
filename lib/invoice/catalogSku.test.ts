import assert from "node:assert/strict";
import { test } from "node:test";

import {
  canonicalizeInvoiceSku,
  findCatalogSkusForInvoiceSku,
  invoiceSkuLookupKeys,
  skuIsInCatalog,
} from "@/lib/invoice/catalogSku";

test("invoiceSkuLookupKeys pads short numeric invoice SKUs", () => {
  assert.deepEqual(invoiceSkuLookupKeys("8180"), ["8180", "08180"]);
  assert.deepEqual(invoiceSkuLookupKeys("03293T"), ["03293T"]);
});

test("findCatalogSkusForInvoiceSku matches catalog when PDF drops leading zero", () => {
  assert.deepEqual(findCatalogSkusForInvoiceSku("8180"), ["08180K"]);
  assert.deepEqual(findCatalogSkusForInvoiceSku("08180K"), ["08180K"]);
  assert.deepEqual(findCatalogSkusForInvoiceSku("03293T"), ["03293T"]);
  assert.deepEqual(findCatalogSkusForInvoiceSku("3851"), []);
});

test("canonicalizeInvoiceSku rewrites unique leading-zero matches", () => {
  assert.equal(canonicalizeInvoiceSku("8180"), "08180K");
  assert.equal(canonicalizeInvoiceSku("08180K"), "08180K");
});

test("skuIsInCatalog accepts short numeric invoice SKUs", async () => {
  assert.equal(await skuIsInCatalog("8180"), true);
  assert.equal(await skuIsInCatalog("08180K"), true);
});

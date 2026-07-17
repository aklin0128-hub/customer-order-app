import assert from "node:assert/strict";
import { test } from "node:test";

import {
  lookupStatusEtaProduct,
  parseStatusEtaAoa,
  parseStatusEtaCsvText,
  serializeStatusEtaProductsToCsv,
} from "@/lib/inventoryStatusEta";

const SAMPLE = `PID,Description,Stauts,Aval. INV,Port ETA,Inbound QTY
50074L,SWEET SOY SAUCE,NORMAL,27,07/24/26,80
06622T,ORGANIC COCONUT MILK,NORMAL,287,07/29/26,176
,,,,08/02/26,160
,,,,08/16/26,264
06907T,COCONUT MILK (UHT_1L),NORMAL,-245,07/16/26,150
,,,,07/29/26,200
`;

test("parseStatusEtaCsvText forward-fills continuation rows", () => {
  const products = parseStatusEtaCsvText(SAMPLE);
  assert.equal(products.length, 3);

  const organic = products.find((p) => p.pid === "06622T");
  assert.ok(organic);
  assert.equal(organic!.description, "ORGANIC COCONUT MILK");
  assert.equal(organic!.status, "NORMAL");
  assert.equal(organic!.availableInv, 287);
  assert.equal(organic!.inbound.length, 3);
  assert.equal(organic!.inbound[0]!.portEta, "2026-07-29");
  assert.equal(organic!.inbound[1]!.inboundQty, 160);
  assert.equal(organic!.inbound[2]!.inboundQty, 264);

  const coconut = products.find((p) => p.pid === "06907T");
  assert.equal(coconut!.availableInv, -245);
  assert.equal(coconut!.inbound.length, 2);
});

test("lookupStatusEtaProduct matches pid", () => {
  const products = parseStatusEtaCsvText(SAMPLE);
  const hit = lookupStatusEtaProduct(products, "06622T");
  assert.equal(hit.found, true);
  assert.equal(hit.product?.pid, "06622T");

  const miss = lookupStatusEtaProduct(products, "ZZZZZ");
  assert.equal(miss.found, false);
});

test("serialize round-trip keeps inbound lots", () => {
  const products = parseStatusEtaCsvText(SAMPLE);
  const csv = serializeStatusEtaProductsToCsv(products);
  const again = parseStatusEtaCsvText(csv);
  assert.equal(again.length, products.length);
  assert.equal(again.find((p) => p.pid === "06622T")?.inbound.length, 3);
});

test("parseStatusEtaAoa accepts Stauts typo header", () => {
  const products = parseStatusEtaAoa([
    ["PID", "Description", "Stauts", "Aval. INV", "Port ETA", "Inbound QTY"],
    ["ABC01", "TEST ITEM", "NORMAL", "10", "07/01/26", "5"],
  ]);
  assert.equal(products[0]!.status, "NORMAL");
  assert.equal(products[0]!.availableInv, 10);
});

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  attachNdhPrices,
  buildCsv,
  buildOrderDownloadCsv,
  buildOrderEmail,
  lineTag,
  splitOrderLinesForEmail,
} from "./orderSubmitEmail";

const here = dirname(fileURLToPath(import.meta.url));
const sendOrder = readFileSync(join(here, "../app/api/send-order/route.ts"), "utf8");

test("splitOrderLinesForEmail puts NDH and leftover NH lines in the NDH batch", () => {
  const { catalog, ndh } = splitOrderLinesForEmail([
    { sku: "A1", qty: "2" },
    { sku: "B2", qty: "1", ndh: true, expiryDate: "2026-11-08" },
    { sku: "C3", qty: "3", nhItems: true },
  ]);
  assert.deepEqual(
    catalog.map((row) => row.sku),
    ["A1"]
  );
  assert.deepEqual(
    ndh.map((row) => row.sku),
    ["B2", "C3"]
  );
});

test("NDH email is labeled separately from the regular order email", () => {
  const catalog = buildOrderEmail({
    kind: "catalog",
    accountNo: "FL111",
    storeName: "Store",
    phone: "",
    note: "",
    orderEmail: "orders@example.com",
    orderRef: "FL111-1101",
    items: [{ sku: "A1", qty: "2" }],
    companionSplit: true,
  });
  const ndh = buildOrderEmail({
    kind: "ndh",
    accountNo: "FL111",
    storeName: "Store",
    phone: "",
    note: "",
    orderEmail: "orders@example.com",
    orderRef: "FL111-1101",
    items: [{ sku: "B2", qty: "1", ndh: true, expiryDate: "2026-11-08", price: "4.17" }],
    companionSplit: true,
  });
  assert.match(catalog.subject, /^New Order -/);
  assert.match(ndh.subject, /^New NDH Order -/);
  assert.match(ndh.subject, /FL111-1101-NDH/);
  assert.match(ndh.filename, /^FL111_NDH_\d{4}-\d{2}-\d{2}\.csv$/);
  assert.match(ndh.text, /B2 - 1 - \$4\.17/);
  assert.doesNotMatch(ndh.text, /NDH 2026-11-08/);
  assert.doesNotMatch(ndh.csv, /2026-11-08/);
  assert.match(ndh.csv, /^SKU,QTY,PRICE\nB2,1,\$4\.17$/m);
  assert.doesNotMatch(ndh.text, /A1 - 2/);
  assert.match(catalog.text, /separate NDH email/);
  assert.match(catalog.csv, /^SKU,Qty,Tag\n/m);
});

test("NDH order lines are SKU QTY PRICE", () => {
  assert.equal(lineTag({ sku: "B2", qty: "1", ndh: true, expiryDate: "2026-11-08", price: "$5.38" }), "$5.38");
  assert.equal(lineTag({ sku: "B2", qty: "1", ndh: true, expiryDate: "2026-11-08" }), "");
  assert.equal(lineTag({ sku: "C3", qty: "3", nhItems: true }), "NH_ITEMS");
});

test("send-order sends catalog and NDH emails as separate messages", () => {
  assert.match(sendOrder, /splitOrderLinesForEmail/);
  assert.match(sendOrder, /sendBatch\("catalog"/);
  assert.match(sendOrder, /sendBatch\("ndh"/);
  assert.match(sendOrder, /attachNdhPrices/);
  assert.match(sendOrder, /getNdhProducts/);
});

test("attachNdhPrices fills PRICE from listing and sku fallback", () => {
  const exact = attachNdhPrices(
    [{ sku: "B2", qty: "1", ndh: true, expiryDate: "2026-11-08" }],
    [{ sku: "B2", expiryDate: "2026-11-08", clearancePrice: "4.17" }]
  );
  assert.equal(exact[0].price, "4.17");
  assert.match(buildCsv(exact, "ndh"), /^SKU,QTY,PRICE\nB2,1,\$4\.17$/m);

  const skuOnly = attachNdhPrices(
    [{ sku: "B2", qty: "1", ndh: true, expiryDate: "2026-12-01" }],
    [{ sku: "B2", expiryDate: "2026-11-08", clearancePrice: "4.17" }]
  );
  assert.equal(skuOnly[0].price, "4.17");

  const keepClient = attachNdhPrices(
    [{ sku: "B2", qty: "1", ndh: true, price: "9.99" }],
    []
  );
  assert.equal(keepClient[0].price, "9.99");
});

test("order download CSV uses SKU QTY PRICE for NDH lines", () => {
  assert.equal(
    buildOrderDownloadCsv([{ sku: "A1", qty: "2" }]),
    "SKU,Qty\nA1,2"
  );
  assert.equal(
    buildOrderDownloadCsv([{ sku: "B2", qty: "1", ndh: true, price: "4.17" }]),
    "SKU,QTY,PRICE\nB2,1,$4.17"
  );
});

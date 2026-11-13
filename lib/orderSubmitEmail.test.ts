import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { buildOrderEmail, splitOrderLinesForEmail } from "./orderSubmitEmail";

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
    items: [{ sku: "B2", qty: "1", ndh: true, expiryDate: "2026-11-08" }],
    companionSplit: true,
  });
  assert.match(catalog.subject, /^New Order -/);
  assert.match(ndh.subject, /^New NDH Order -/);
  assert.match(ndh.subject, /FL111-1101-NDH/);
  assert.match(ndh.filename, /^FL111_NDH_\d{4}-\d{2}-\d{2}\.csv$/);
  assert.match(ndh.text, /B2 - 1 - NDH 2026-11-08/);
  assert.doesNotMatch(ndh.text, /A1 - 2/);
  assert.match(catalog.text, /separate NDH email/);
});

test("send-order sends catalog and NDH emails as separate messages", () => {
  assert.match(sendOrder, /splitOrderLinesForEmail/);
  assert.match(sendOrder, /sendBatch\("catalog"/);
  assert.match(sendOrder, /sendBatch\("ndh"/);
});

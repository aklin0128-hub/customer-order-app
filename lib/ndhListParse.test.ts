import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { normalizeNdhDate, parseNdhListText } from "./ndhListParse";

const here = dirname(fileURLToPath(import.meta.url));
const adminPage = readFileSync(join(here, "../app/admin/ndh/page.tsx"), "utf8");
const publicPage = readFileSync(join(here, "../app/NDH/page.tsx"), "utf8");
const orderPage = readFileSync(join(here, "../app/order/page.tsx"), "utf8");
const uploadRoute = readFileSync(join(here, "../app/api/admin/ndh/upload/route.ts"), "utf8");
const sendOrder = readFileSync(join(here, "../app/api/send-order/route.ts"), "utf8");

test("parseNdhListText reads header csv", () => {
  const rows = parseNdhListText(
    "sku,price,expiry,qty,note\n000150,12.99,2026-11-20,8,Sell as is\n000160,9,11/21/2026,4,"
  );
  assert.equal(rows.length, 2);
  assert.equal(rows[0].sku, "000150");
  assert.equal(rows[0].clearancePrice, "12.99");
  assert.equal(rows[0].expiryDate, "2026-11-20");
  assert.equal(rows[0].clearanceQty, "8");
  assert.equal(rows[1].expiryDate, "2026-11-21");
});

test("parseNdhListText applies defaults to sku-only paste", () => {
  const rows = parseNdhListText("000150\n000160", {
    clearancePrice: "7.50",
    expiryDate: "2026-12-01",
    note: "NDH",
  });
  assert.equal(rows.length, 2);
  assert.equal(rows[0].sku, "000150");
  assert.equal(rows[0].clearancePrice, "7.50");
  assert.equal(rows[0].expiryDate, "2026-12-01");
  assert.equal(rows[0].note, "NDH");
});

test("normalizeNdhDate accepts US and ISO dates", () => {
  assert.equal(normalizeNdhDate("2026-11-20"), "2026-11-20");
  assert.equal(normalizeNdhDate("11/5/2026"), "2026-11-05");
});

test("NDH pages wire upload and order tab", () => {
  assert.match(adminPage, /Upload list/);
  assert.match(adminPage, /\/api\/admin\/ndh\/upload/);
  assert.match(uploadRoute, /parseNdhUpload/);
  assert.match(publicPage, /\/api\/ndh/);
  assert.match(orderPage, /changeMode\("ndh"\)/);
  assert.match(orderPage, /\/api\/ndh/);
  assert.match(sendOrder, /NDH_ORDER_EMAIL_TAG/);
  assert.match(sendOrder, /incrementNdhSold/);
});

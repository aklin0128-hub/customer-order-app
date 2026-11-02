import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { mergeNdhListRows, normalizeNdhDate, parseNdhListText } from "./ndhListParse";

import { mergeNdhWithLegacyClearance } from "./ndh";

const here = dirname(fileURLToPath(import.meta.url));
const adminPage = readFileSync(join(here, "../app/admin/ndh/page.tsx"), "utf8");
const adminNav = readFileSync(join(here, "../app/admin/_components/admin-nav.ts"), "utf8");
const nextConfig = readFileSync(join(here, "../next.config.ts"), "utf8");
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

test("warehouse CSV uses PID Description Exp Date Inv", () => {
  const rows = parseNdhListText(
    [
      "PID,Brand,Description,Description K,Status,Size,S Type,S Life (D),LOT,Exp Date,Life,Inv,TP,BP",
      "08494K,SAMYANG,TACO BULDAK,타코,TBD,6X2.46 OZ,Dry,280,QC-MPL,1/10/2027,68,22,$4.17,8.46",
      "10724K,SAMJIP,CAFE SNOW K,카페,NORMAL,5X10X7.77 OZ,Dry,460,D-16-12-4-D,12/25/2026,52,48,$12.16,36.32",
      ",,,,,,, ,D-18-15-1-D,12/25/2026,52,43,$12.16,36.32",
      "10466K,ORION,O' JELLY COCO,오 젤리,NORMAL,12X6X1.27 OZ,Dry,285,QC-MPL,12/16/2026,43,54,$10.15,35.72",
      "10466K,ORION,O' JELLY PEACH,오 젤리,NORMAL,12X6X1.27 OZ,Dry,285,QC-MPL,11/12/2026,5,54,$5.24,35.67",
    ].join("\n")
  );

  const snow = rows.filter((row) => row.sku === "10724K");
  assert.equal(snow.length, 1);
  assert.equal(snow[0].expiryDate, "2026-12-25");
  assert.equal(snow[0].clearanceQty, "91");
  assert.equal(snow[0].description, "CAFE SNOW K");

  const jelly = rows.filter((row) => row.sku === "10466K");
  assert.equal(jelly.length, 2);
  assert.equal(jelly.find((row) => row.expiryDate === "2026-12-16")?.clearanceQty, "54");
  assert.equal(jelly.find((row) => row.expiryDate === "2026-11-12")?.clearanceQty, "54");

  const taco = rows.find((row) => row.sku === "08494K");
  assert.equal(taco?.expiryDate, "2027-01-10");
  assert.equal(taco?.clearanceQty, "22");
  assert.equal(taco?.description, "TACO BULDAK");
  assert.equal(taco?.clearancePrice, "$4.17");
});

test("warehouse CSV skips rows whose Life is 0 or negative", () => {
  const rows = parseNdhListText(
    [
      "PID,Brand,Description,Description K,Status,Size,S Type,S Life (D),LOT,Exp Date,Life,Inv,TP,BP",
      "10482K,SAMYANG,BULDAK LIME,불닭,NORMAL,12X4.23 OZ,Dry,180,QC-MPL,11/2/2026,0,176,$5.38,12.00",
      "10482K,SAMYANG,BULDAK LIME,불닭,NORMAL,12X4.23 OZ,Dry,180,QC-MPL,11/1/2026,-4,10,$5.38,12.00",
      "10570K,EDIYA,ICED AMERICANO,아메리카노,NORMAL,6X3.53 OZ,Dry,200,QC-MPL,11/6/2026,4,31,$8.22,10.00",
      "10724K,SAMJIP,CAFE SNOW K,카페,NORMAL,5X10X7.77 OZ,Dry,460,D-16-12-4-D,12/25/2026,52,48,$12.16,36.32",
      ",,,,,,, ,D-18-15-1-D,12/25/2026,0,43,$12.16,36.32",
    ].join("\n")
  );

  assert.equal(rows.find((row) => row.sku === "10482K"), undefined);
  const iced = rows.find((row) => row.sku === "10570K");
  assert.equal(iced?.expiryDate, "2026-11-06");
  assert.equal(iced?.clearanceQty, "31");
  const snow = rows.find((row) => row.sku === "10724K");
  assert.equal(snow?.expiryDate, "2026-12-25");
  assert.equal(snow?.clearanceQty, "48");
});

test("mergeNdhListRows sums same exp and splits different exp", () => {
  const rows = mergeNdhListRows([
    { sku: "10998K", expiryDate: "2026-11-18", clearanceQty: "180" },
    { sku: "10998K", expiryDate: "2026-11-18", clearanceQty: "32" },
    { sku: "10998K", expiryDate: "2026-11-01", clearanceQty: "10" },
  ]);
  assert.equal(rows.length, 2);
  assert.equal(rows.find((row) => row.expiryDate === "2026-11-18")?.clearanceQty, "212");
  assert.equal(rows.find((row) => row.expiryDate === "2026-11-01")?.clearanceQty, "10");
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
  assert.equal(normalizeNdhDate("1/10/2027"), "2027-01-10");
});

test("NDH pages wire upload and order tab", () => {
  assert.match(adminPage, /Upload list/);
  assert.match(adminPage, /PID/);
  assert.match(adminPage, /\/api\/admin\/ndh\/upload/);
  assert.match(uploadRoute, /parseNdhUpload/);
  assert.match(publicPage, /\/api\/ndh/);
  assert.match(publicPage, /CatalogQtyCard/);
  assert.match(publicPage, /order-promo-grid/);
  assert.match(publicPage, /hideQtyControls/);
  assert.doesNotMatch(publicPage, /showcase-grid/);
  assert.doesNotMatch(publicPage, /showcase-card/);
  assert.match(orderPage, /changeMode\("ndh"\)/);
  assert.match(orderPage, /\/api\/ndh/);
  assert.match(sendOrder, /NDH_ORDER_EMAIL_TAG/);
  assert.match(sendOrder, /incrementNdhSold/);
});

test("Near Date Sale is folded into NDH only", () => {
  assert.doesNotMatch(orderPage, /changeMode\("clearance"\)/);
  assert.doesNotMatch(orderPage, /order-mode-tab--clearance/);
  assert.doesNotMatch(orderPage, /order-shop-tag--clearance/);
  assert.match(orderPage, /if \(resolved === "clearance"\) resolved = "ndh"/);
  assert.doesNotMatch(adminNav, /Near Date Sale/);
  assert.match(adminNav, /href: "\/admin\/ndh"/);
  assert.match(nextConfig, /source: "\/admin\/clearance"/);
  assert.match(nextConfig, /destination: "\/admin\/ndh"/);
  assert.match(sendOrder, /ndhSoldQtyItems.map\(\(item\) => \(\{ sku: item.sku, qty: item.qty \}\)\)/);
});

test("mergeNdhWithLegacyClearance keeps NDH row and leftover SKU+exp", () => {
  const merged = mergeNdhWithLegacyClearance(
    [
      {
        sku: "A1",
        expiryDate: "2026-11-20",
        clearancePrice: "1",
        clearanceQty: 4,
        soldQty: 0,
      },
    ],
    [
      {
        sku: "A1",
        expiryDate: "2026-11-20",
        clearancePrice: "9",
        clearanceQty: 99,
        soldQty: 0,
      },
      {
        sku: "B2",
        expiryDate: "2026-12-01",
        clearancePrice: "2",
        clearanceQty: 3,
        soldQty: 0,
      },
    ]
  );
  assert.equal(merged.length, 2);
  assert.equal(merged[0].clearanceQty, 4);
  assert.equal(merged[1].sku, "B2");
});

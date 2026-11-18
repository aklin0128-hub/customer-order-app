import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = join(process.cwd());

test("public order-notice API is a GET that returns the notice payload", () => {
  const src = readFileSync(join(root, "app/api/order-notice/route.ts"), "utf8");
  assert.match(src, /export async function GET/);
  assert.match(src, /getPublicOrderNotice/);
  assert.doesNotMatch(src, /x-admin-password/);
});

test("admin order-notice API requires the admin password", () => {
  const src = readFileSync(join(root, "app/api/admin/order-notice/route.ts"), "utf8");
  assert.match(src, /x-admin-password/);
  assert.match(src, /export async function GET/);
  assert.match(src, /export async function POST/);
  assert.match(src, /saveOrderNoticeRecord/);
});

test("order page mounts the notice popup", () => {
  const src = readFileSync(join(root, "app/order/page.tsx"), "utf8");
  assert.match(src, /OrderNoticePopup/);
  const popup = readFileSync(join(root, "app/order/components/OrderNoticePopup.tsx"), "utf8");
  assert.match(popup, /ORDER_NOTICE_AUTO_CLOSE_MS/);
  assert.match(popup, /sessionStorage/);
  assert.match(popup, /order-notice-close/);
});

test("admin notice page is linked in the catalog nav", () => {
  const nav = readFileSync(join(root, "app/admin/_components/admin-nav.ts"), "utf8");
  assert.match(nav, /\/admin\/notice/);
  const page = readFileSync(join(root, "app/admin/notice/page.tsx"), "utf8");
  assert.match(page, /Save notice/);
  assert.match(page, /Hide from customers/);
  assert.match(page, /English/);
  assert.match(page, /中文/);
  assert.match(page, /한국어/);
  assert.match(page, /Tiếng Việt/);
  assert.match(page, /Hide on date/);
});

import assert from "node:assert/strict";
import test from "node:test";

import {
  ORDER_NOTICE_AUTO_CLOSE_MS,
  emptyOrderNotice,
  isOrderNoticeExpired,
  normalizeOrderNotice,
  toPublicOrderNotice,
} from "./orderNotice";

test("order notice auto-closes after 20 seconds", () => {
  assert.equal(ORDER_NOTICE_AUTO_CLOSE_MS, 20_000);
});

test("normalizeOrderNotice stores multiple product rows", () => {
  const notice = normalizeOrderNotice({
    heading: " Inventory ",
    items: [
      { name: " Honeydew ", note: " Out until 12/1 ", hideOnDate: "2026-12-01" },
      { name: "Napa", note: "Limited this week" },
      { name: "", note: "" },
    ],
    enabled: true,
    updatedAt: 123,
  });
  assert.equal(notice.heading, "Inventory");
  assert.equal(notice.items.length, 2);
  assert.equal(notice.items[0].name, "Honeydew");
  assert.equal(notice.items[0].hideOnDate, "2026-12-01");
  assert.equal(notice.items[1].name, "Napa");
  assert.equal(notice.enabled, true);
  assert.equal(notice.updatedAt, 123);
});

test("normalizeOrderNotice migrates a single legacy title/body into one item", () => {
  const notice = normalizeOrderNotice({
    title: "Melon",
    body: "Out of stock until 12/1",
    hideOnDate: "2026-12-01",
    enabled: true,
  });
  assert.deepEqual(notice.items, [{ name: "Melon", note: "Out of stock until 12/1", hideOnDate: "2026-12-01" }]);
});

test("empty, disabled, or fully expired notices are not shown to customers", () => {
  assert.equal(toPublicOrderNotice(emptyOrderNotice()), null);
  assert.equal(toPublicOrderNotice(normalizeOrderNotice({ items: [], enabled: true })), null);
  assert.equal(
    toPublicOrderNotice(normalizeOrderNotice({ items: [{ name: "Melon", note: "Later" }], enabled: false })),
    null
  );

  const mixed = normalizeOrderNotice({
    heading: "ETA",
    items: [
      { name: "Gone", note: "Was out", hideOnDate: "2026-11-17" },
      { name: "Honeydew", note: "Late Nov" },
    ],
    enabled: true,
    updatedAt: 9,
  });
  const live = toPublicOrderNotice(mixed, new Date("2026-11-17T12:00:00-05:00"));
  assert.deepEqual(live, {
    heading: "ETA",
    items: [{ name: "Honeydew", note: "Late Nov" }],
    updatedAt: 9,
  });

  const expired = normalizeOrderNotice({
    items: [{ name: "Gone", note: "Was out", hideOnDate: "2026-11-17" }],
    enabled: true,
  });
  assert.equal(toPublicOrderNotice(expired, new Date("2026-11-17T12:00:00-05:00")), null);
});

test("isOrderNoticeExpired uses the hide-on date in US Eastern time", () => {
  assert.equal(isOrderNoticeExpired(undefined, new Date("2026-11-17T12:00:00-05:00")), false);
  assert.equal(isOrderNoticeExpired("2026-11-18", new Date("2026-11-17T23:30:00-05:00")), false);
  assert.equal(isOrderNoticeExpired("2026-11-18", new Date("2026-11-18T00:05:00-05:00")), true);
});

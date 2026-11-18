import assert from "node:assert/strict";
import test from "node:test";

import {
  ORDER_NOTICE_AUTO_CLOSE_MS,
  emptyOrderNotice,
  normalizeOrderNotice,
  toPublicOrderNotice,
} from "./orderNotice";

test("order notice auto-closes after 20 seconds", () => {
  assert.equal(ORDER_NOTICE_AUTO_CLOSE_MS, 20_000);
});

test("normalizeOrderNotice trims and caps fields", () => {
  const notice = normalizeOrderNotice({
    title: "  Melon  ",
    body: "  Out until 12/1  ",
    enabled: true,
    updatedAt: 123,
  });
  assert.equal(notice.title, "Melon");
  assert.equal(notice.body, "Out until 12/1");
  assert.equal(notice.enabled, true);
  assert.equal(notice.updatedAt, 123);
});

test("empty or disabled notices are not shown to customers", () => {
  assert.equal(toPublicOrderNotice(emptyOrderNotice()), null);
  assert.equal(toPublicOrderNotice(normalizeOrderNotice({ body: "", enabled: true })), null);
  assert.equal(
    toPublicOrderNotice(normalizeOrderNotice({ body: "Later this week", enabled: false })),
    null
  );
  const live = toPublicOrderNotice(
    normalizeOrderNotice({ title: "ETA", body: "Honeydew late Nov", enabled: true, updatedAt: 9 })
  );
  assert.deepEqual(live, { title: "ETA", body: "Honeydew late Nov", updatedAt: 9 });
});

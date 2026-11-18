import assert from "node:assert/strict";
import test from "node:test";

import {
  ORDER_NOTICE_AUTO_CLOSE_MS,
  emptyOrderNotice,
  isOrderNoticeExpired,
  normalizeOrderNotice,
  pickNoticeCopy,
  toPublicOrderNotice,
} from "./orderNotice";

test("order notice auto-closes after 20 seconds", () => {
  assert.equal(ORDER_NOTICE_AUTO_CLOSE_MS, 20_000);
});

test("normalizeOrderNotice stores per-language copy and migrates old title/body into English", () => {
  const notice = normalizeOrderNotice({
    title: "  Melon  ",
    body: "  Out until 12/1  ",
    translations: {
      zh: { title: "蜜瓜", body: "暂时没货" },
    },
    enabled: true,
    hideOnDate: "2026-12-01",
    updatedAt: 123,
  });
  assert.equal(notice.translations.en.title, "Melon");
  assert.equal(notice.translations.en.body, "Out until 12/1");
  assert.equal(notice.translations.zh.body, "暂时没货");
  assert.equal(notice.hideOnDate, "2026-12-01");
  assert.equal(notice.enabled, true);
  assert.equal(notice.updatedAt, 123);
});

test("empty, disabled, or expired notices are not shown to customers", () => {
  assert.equal(toPublicOrderNotice(emptyOrderNotice()), null);
  assert.equal(toPublicOrderNotice(normalizeOrderNotice({ body: "", enabled: true })), null);
  assert.equal(
    toPublicOrderNotice(normalizeOrderNotice({ body: "Later this week", enabled: false })),
    null
  );
  const live = toPublicOrderNotice(
    normalizeOrderNotice({ title: "ETA", body: "Honeydew late Nov", enabled: true, updatedAt: 9 })
  );
  assert.equal(live?.updatedAt, 9);
  assert.equal(live?.translations.en.body, "Honeydew late Nov");

  const expired = normalizeOrderNotice({
    body: "Gone",
    enabled: true,
    hideOnDate: "2026-11-17",
  });
  assert.equal(toPublicOrderNotice(expired, new Date("2026-11-17T12:00:00-05:00")), null);
  assert.ok(toPublicOrderNotice(expired, new Date("2026-11-16T23:30:00-05:00")));
});

test("isOrderNoticeExpired uses the hide-on date in US Eastern time", () => {
  assert.equal(isOrderNoticeExpired(undefined, new Date("2026-11-17T12:00:00-05:00")), false);
  assert.equal(isOrderNoticeExpired("2026-11-18", new Date("2026-11-17T23:30:00-05:00")), false);
  assert.equal(isOrderNoticeExpired("2026-11-18", new Date("2026-11-18T00:05:00-05:00")), true);
});

test("pickNoticeCopy prefers the active language then English then any filled language", () => {
  const translations = normalizeOrderNotice({
    translations: {
      zh: { title: "通告", body: "中文" },
      ko: { title: "", body: "한국어" },
    },
  }).translations;
  assert.equal(pickNoticeCopy(translations, "zh")?.body, "中文");
  assert.equal(pickNoticeCopy(translations, "en")?.body, "中文");
  assert.equal(pickNoticeCopy(translations, "ko")?.body, "한국어");
  assert.equal(pickNoticeCopy(translations, "vi")?.body, "中文");
});

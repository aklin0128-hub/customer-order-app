"use client";

import { useEffect, useState } from "react";

import { ORDER_NOTICE_AUTO_CLOSE_MS, type PublicOrderNotice } from "@/lib/orderNotice";

const NOTICE_COPY = {
  notice: "Notice",
  close: "Close",
  noticeAutoClose: "Closes in {sec}s",
};

function dismissKey(notice: PublicOrderNotice) {
  return `order_notice_dismissed:${notice.updatedAt}`;
}

function wasDismissed(notice: PublicOrderNotice) {
  try {
    return sessionStorage.getItem(dismissKey(notice)) === "1";
  } catch {
    return false;
  }
}

function rememberDismiss(notice: PublicOrderNotice) {
  try {
    sessionStorage.setItem(dismissKey(notice), "1");
  } catch {
    /* private mode */
  }
}

export function OrderNoticePopup({ ready }: { ready: boolean }) {
  const [notice, setNotice] = useState<PublicOrderNotice | null>(null);
  const [open, setOpen] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(ORDER_NOTICE_AUTO_CLOSE_MS / 1000);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    fetch("/api/order-notice", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const next = data?.notice as PublicOrderNotice | null;
        if (!next?.items?.length || wasDismissed(next)) return;
        setNotice(next);
        setOpen(true);
        setSecondsLeft(ORDER_NOTICE_AUTO_CLOSE_MS / 1000);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [ready]);

  useEffect(() => {
    if (!open || !notice) return;
    const started = Date.now();
    const tick = window.setInterval(() => {
      const left = Math.max(0, Math.ceil((ORDER_NOTICE_AUTO_CLOSE_MS - (Date.now() - started)) / 1000));
      setSecondsLeft(left);
      if (left <= 0) {
        window.clearInterval(tick);
        rememberDismiss(notice);
        setOpen(false);
      }
    }, 250);
    return () => window.clearInterval(tick);
  }, [open, notice]);

  if (!open || !notice || notice.items.length === 0) return null;

  const close = () => {
    rememberDismiss(notice);
    setOpen(false);
  };

  const heading = notice.heading || NOTICE_COPY.notice;

  return (
    <div className="order-notice-overlay" role="dialog" aria-modal="true" aria-labelledby="order-notice-title" lang="en">
      <div className="order-notice-card">
        <button type="button" className="order-notice-close" onClick={close} aria-label={NOTICE_COPY.close}>
          ×
        </button>
        {notice.heading ? <p className="order-notice-kicker">{NOTICE_COPY.notice}</p> : null}
        <h2 id="order-notice-title" className="order-notice-title">
          {heading}
        </h2>
        <ul className="order-notice-list">
          {notice.items.map((item, index) => (
            <li key={`${item.name}-${index}`} className="order-notice-item">
              {item.name ? <p className="order-notice-item-name">{item.name}</p> : null}
              {item.note ? <p className="order-notice-item-note">{item.note}</p> : null}
            </li>
          ))}
        </ul>
        <p className="order-notice-timer">{NOTICE_COPY.noticeAutoClose.replace("{sec}", String(secondsLeft))}</p>
      </div>
    </div>
  );
}

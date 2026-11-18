"use client";

import { useEffect, useState } from "react";

import { ORDER_NOTICE_AUTO_CLOSE_MS, pickNoticeCopy, type PublicOrderNotice } from "@/lib/orderNotice";
import type { Lang } from "../types";

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

export function OrderNoticePopup({
  lang,
  copy,
  ready,
}: {
  lang: Lang;
  copy: { notice: string; close: string; noticeAutoClose: string };
  ready: boolean;
}) {
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
        if (!next?.translations || wasDismissed(next)) return;
        if (!pickNoticeCopy(next.translations, "en")) return;
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

  const localized = notice ? pickNoticeCopy(notice.translations, lang) : null;
  if (!open || !notice || !localized) return null;

  const close = () => {
    rememberDismiss(notice);
    setOpen(false);
  };

  return (
    <div className="order-notice-overlay" role="dialog" aria-modal="true" aria-labelledby="order-notice-title" lang={lang}>
      <div className="order-notice-card">
        <button type="button" className="order-notice-close" onClick={close} aria-label={copy.close}>
          ×
        </button>
        {localized.title ? <p className="order-notice-kicker">{copy.notice}</p> : null}
        <h2 id="order-notice-title" className="order-notice-title">
          {localized.title || copy.notice}
        </h2>
        <p className="order-notice-body">{localized.body}</p>
        <p className="order-notice-timer">{copy.noticeAutoClose.replace("{sec}", String(secondsLeft))}</p>
      </div>
    </div>
  );
}

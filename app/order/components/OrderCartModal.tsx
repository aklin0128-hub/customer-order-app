"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";

import { copy } from "../orderCopy";
import { secondaryButtonStyle, submitButtonStyle } from "../orderStyles";
import type { CartItem, Lang } from "../types";
import { OrderCartSection } from "./OrderCartSection";

export function OrderCartModal({
  open,
  onClose,
  onReview,
  onConfirm,
  lang,
  items,
  nhItemsSkus,
  lineCount,
  totalCases,
  submitting,
  statusMessage,
  onAdjustQty,
  onQtyInput,
  onRemove,
  onRemoveUnavailable,
  unavailableItems = [],
  nudge,
  tools,
}: {
  open: boolean;
  onClose: () => void;
  onReview: () => void;
  onConfirm?: () => void;
  lang: Lang;
  items: CartItem[];
  nhItemsSkus?: Set<string>;
  lineCount: number;
  totalCases: number;
  submitting: boolean;
  statusMessage?: string;
  onAdjustQty: (sku: string, delta: number, nhItems?: boolean) => void;
  onQtyInput: (sku: string, value: string, nhItems?: boolean) => void;
  onRemove: (sku: string, nhItems?: boolean) => void;
  onRemoveUnavailable?: () => void;
  unavailableItems?: Array<{ sku: string; status: string; nhItems?: boolean }>;
  nudge?: ReactNode;
  tools?: ReactNode;
}) {
  const t = copy[lang];

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="order-cart-modal-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div
        className="order-cart-modal"
        role="dialog"
        aria-labelledby="order-cart-heading"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <OrderCartSection
          lang={lang}
          items={items}
          nhItemsSkus={nhItemsSkus}
          expanded
          onToggleExpanded={onClose}
          onClose={onClose}
          lineCount={lineCount}
          totalCases={totalCases}
          onAdjustQty={onAdjustQty}
          onQtyInput={onQtyInput}
          onRemove={onRemove}
          onRemoveUnavailable={onRemoveUnavailable}
          unavailableItems={unavailableItems}
          nudge={nudge}
          tools={tools}
        />

        {statusMessage ? (
          <div
            className={`order-cart-modal-status${statusMessage.toLowerCase().includes("failed") ? " is-error" : " is-ok"}`}
          >
            {statusMessage}
          </div>
        ) : null}

        <footer className="order-cart-modal-footer">
          <button type="button" onClick={onClose} className="order-cart-modal-footer-btn" style={secondaryButtonStyle}>
            {t.close}
          </button>
          <button
            type="button"
            onClick={onReview}
            disabled={submitting || lineCount === 0}
            className="order-cart-modal-footer-btn"
            style={secondaryButtonStyle}
          >
            {t.reviewCart}
          </button>
          <button
            type="button"
            onClick={onConfirm ?? onReview}
            disabled={submitting || lineCount === 0}
            className="order-cart-modal-footer-btn is-submit"
            style={{ ...submitButtonStyle, background: submitting || lineCount === 0 ? "#93c5fd" : "#16a34a" }}
          >
            {submitting ? t.submitting : t.submitOrder}
          </button>
        </footer>
      </div>
    </div>
  );
}

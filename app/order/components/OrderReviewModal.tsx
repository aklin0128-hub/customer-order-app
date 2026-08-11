"use client";

import { useEffect, useState } from "react";

import { getCatalogItemBySku, isOrderableItem } from "../catalogUtils";
import { copy } from "../orderCopy";
import {
  compactQtyStripWrapStyle,
  dangerSmallButtonStyle,
  reviewItemStyle,
  reviewListStyle,
  reviewModalBodyStyle,
  reviewModalFooterStyle,
  reviewModalHeaderStyle,
  reviewModalStyle,
  reviewOverlayStyle,
  reviewQtyButtonStyle,
  reviewQtyControlStyle,
  reviewQtyInputStyle,
  reviewRemoveButtonStyle,
  clearancePolicyStyle,
  promoDealStyle,
  secondaryButtonStyle,
  submitButtonStyle,
} from "../orderStyles";
import type { CartItem, Lang } from "../types";
import { ProductImage } from "./ProductImage";
import { SalesUpsellPanel, type UpsellLine } from "./SalesUpsellPanel";

export type UnavailableReviewItem = {
  sku: string;
  status: string;
  nhItems?: boolean;
};

export function OrderReviewModal({
  open,
  onClose,
  lang,
  items,
  warnings = [],
  unavailableItems = [],
  clearanceUpsellLines,
  onAddUpsellCase,
  onAddAllClearanceUpsell,
  nhItemsSkus,
  promoDealBySku,
  newItemsReminder,
  accountNo,
  storeName,
  submitting,
  onAdjustQty,
  onQtyInput,
  onRemove,
  onRemoveUnavailable,
  onRemoveUnavailableAndSubmit,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  lang: Lang;
  items: CartItem[];
  warnings?: string[];
  unavailableItems?: UnavailableReviewItem[];
  clearanceUpsellLines?: UpsellLine[];
  onAddUpsellCase: (sku: string) => void;
  onAddAllClearanceUpsell: () => void;
  nhItemsSkus?: Set<string>;
  promoDealBySku?: Record<string, string>;
  newItemsReminder?: {
    count: number;
    onView: () => void;
  } | null;
  accountNo: string;
  storeName: string;
  submitting: boolean;
  onAdjustQty: (sku: string, delta: number, nhItems?: boolean) => void;
  onQtyInput: (sku: string, value: string, nhItems?: boolean) => void;
  onRemove: (sku: string, nhItems?: boolean) => void;
  onRemoveUnavailable: () => void;
  onRemoveUnavailableAndSubmit: () => void;
  onSubmit: () => void | Promise<void>;
}) {
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
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || submitting) return;
      onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, submitting, onClose]);

  if (!open) return null;

  return (
    <OrderReviewModalContent
      lang={lang}
      items={items}
      warnings={warnings}
      unavailableItems={unavailableItems}
      clearanceUpsellLines={clearanceUpsellLines}
      onAddUpsellCase={onAddUpsellCase}
      onAddAllClearanceUpsell={onAddAllClearanceUpsell}
      nhItemsSkus={nhItemsSkus}
      promoDealBySku={promoDealBySku}
      newItemsReminder={newItemsReminder}
      accountNo={accountNo}
      storeName={storeName}
      submitting={submitting}
      onAdjustQty={onAdjustQty}
      onQtyInput={onQtyInput}
      onRemove={onRemove}
      onRemoveUnavailable={onRemoveUnavailable}
      onRemoveUnavailableAndSubmit={onRemoveUnavailableAndSubmit}
      onSubmit={onSubmit}
      onClose={onClose}
    />
  );
}

function OrderReviewModalContent({
  onClose,
  lang,
  items,
  warnings = [],
  unavailableItems = [],
  clearanceUpsellLines,
  onAddUpsellCase,
  onAddAllClearanceUpsell,
  nhItemsSkus,
  promoDealBySku,
  newItemsReminder,
  accountNo,
  storeName,
  submitting,
  onAdjustQty,
  onQtyInput,
  onRemove,
  onRemoveUnavailable,
  onRemoveUnavailableAndSubmit,
  onSubmit,
}: Omit<Parameters<typeof OrderReviewModal>[0], "open">) {
  const t = copy[lang];
  const [hideWarnings, setHideWarnings] = useState(false);
  const [hideClearanceUpsell, setHideClearanceUpsell] = useState(false);

  const hasClearanceInOrder = nhItemsSkus
    ? items.some((item) => nhItemsSkus.has(item.sku.toUpperCase()))
    : false;

  const showClearanceUpsell = !hideClearanceUpsell && clearanceUpsellLines && clearanceUpsellLines.length > 0;
  const showWarnings = !hideWarnings && warnings.length > 0;
  const unavailableList = unavailableItems || [];
  const hasUnavailable = unavailableList.length > 0;
  const unavailableKey = new Set(
    unavailableList.map((item) => `${item.sku.toUpperCase()}::${item.nhItems ? "nh" : "cat"}`)
  );

  return (
    <div
      style={reviewOverlayStyle}
      onClick={(e) => {
        if (submitting || e.target !== e.currentTarget) return;
        onClose();
      }}
      role="presentation"
    >
      <div
        style={reviewModalStyle}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="review-order-heading"
        aria-modal="true"
      >
        <header style={reviewModalHeaderStyle}>
          <div style={{ minWidth: 0 }}>
            <div id="review-order-heading" style={{ fontSize: 18, fontWeight: 900, color: "#111827" }}>
              {t.reviewOrder}
            </div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4, lineHeight: 1.4, wordBreak: "break-word" }}>
              <span>{accountNo}</span>
              {(accountNo || storeName) ? " · " : null}
              <span>{storeName}</span>
              {(accountNo || storeName) ? " · " : null}
              {items.length} {t.items}
            </div>
          </div>
          <button type="button" onClick={() => (submitting ? undefined : onClose())} disabled={submitting} style={dangerSmallButtonStyle}>
            {t.close}
          </button>
        </header>

        <div style={reviewModalBodyStyle}>
          {hasUnavailable ? (
            <div
              style={{
                border: "1px solid #fca5a5",
                background: "#fef2f2",
                color: "#991b1b",
                borderRadius: 12,
                padding: 12,
                fontSize: 12,
                lineHeight: 1.45,
                marginBottom: 10,
              }}
            >
              <div style={{ fontWeight: 900, fontSize: 13 }}>{t.unavailableInCartTitle}</div>
              <div style={{ marginTop: 4, opacity: 0.95 }}>{t.unavailableInCartHint}</div>
              <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                {unavailableList.map((item) => (
                  <div key={`${item.sku}-${item.nhItems ? "nh" : "cat"}`} style={{ fontWeight: 800 }}>
                    • {item.sku}
                    {item.status ? ` — ${item.status}` : ""}
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={onRemoveUnavailable}
                  style={{
                    border: "1px solid #fecaca",
                    background: "#fff",
                    color: "#b91c1c",
                    borderRadius: 999,
                    padding: "8px 12px",
                    fontSize: 12,
                    fontWeight: 900,
                    cursor: submitting ? "not-allowed" : "pointer",
                  }}
                >
                  {t.removeUnavailable}
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => {
                    void onRemoveUnavailableAndSubmit();
                  }}
                  style={{
                    border: "none",
                    background: submitting ? "#fca5a5" : "#dc2626",
                    color: "#fff",
                    borderRadius: 999,
                    padding: "8px 12px",
                    fontSize: 12,
                    fontWeight: 900,
                    cursor: submitting ? "not-allowed" : "pointer",
                  }}
                >
                  {t.removeUnavailableAndSubmit}
                </button>
              </div>
            </div>
          ) : null}

          {hasClearanceInOrder ? (
            <div style={{ border: "1px solid #fdba74", background: "#fff7ed", color: "#9a3412", borderRadius: 12, padding: 10, fontSize: 12, lineHeight: 1.45, marginBottom: 10, fontWeight: 800 }}>
              {t.clearancePolicyReviewNote}
            </div>
          ) : null}

          {showWarnings ? (
            <div style={{ border: "1px solid #fde68a", background: "#fffbeb", color: "#92400e", borderRadius: 12, padding: 10, fontSize: 12, lineHeight: 1.45, marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start", marginBottom: 4 }}>
                <div>
                  <div style={{ fontWeight: 900 }}>{t.reviewWarnings}</div>
                  <div style={{ fontSize: 11, marginTop: 4, opacity: 0.9 }}>{t.reviewWarningsHint}</div>
                </div>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setHideWarnings(true)}
                  style={{
                    border: "1px solid #fde68a",
                    background: "#fff",
                    color: "#92400e",
                    borderRadius: 999,
                    padding: "6px 10px",
                    fontSize: 11,
                    fontWeight: 800,
                    cursor: submitting ? "not-allowed" : "pointer",
                    flexShrink: 0,
                  }}
                >
                  {t.skipSection}
                </button>
              </div>
              {warnings.slice(0, 6).map((warning) => (
                <div key={warning}>• {warning}</div>
              ))}
              {warnings.length > 6 ? <div>• ...</div> : null}
            </div>
          ) : null}

          {showClearanceUpsell ? (
            <SalesUpsellPanel
              lang={lang}
              title={t.missingClearancePicksTitle}
              lines={clearanceUpsellLines}
              disabled={submitting}
              onAddOne={onAddUpsellCase}
              onAddAll={onAddAllClearanceUpsell}
              onSkip={() => setHideClearanceUpsell(true)}
              skipLabel={t.skipClearanceUpsell}
            />
          ) : null}

          {newItemsReminder ? (
            <div style={{ border: "1px solid #fdba74", background: "#fff7ed", color: "#9a3412", borderRadius: 12, padding: 10, fontSize: 12, lineHeight: 1.45, marginBottom: 10 }}>
              <div style={{ fontWeight: 900, marginBottom: 6 }}>
                {t.newItemsReviewReminder.replace("{count}", String(newItemsReminder.count))}
              </div>
              <button
                type="button"
                onClick={newItemsReminder.onView}
                disabled={submitting}
                style={{
                  border: "1px solid #ea580c",
                  background: "#ffedd5",
                  color: "#c2410c",
                  borderRadius: 999,
                  padding: "7px 12px",
                  fontSize: 12,
                  fontWeight: 900,
                  cursor: submitting ? "not-allowed" : "pointer",
                }}
              >
                {t.viewNewItems}
              </button>
            </div>
          ) : null}

          <div style={reviewListStyle}>
            {items.map((item, index) => {
              const catalogItem = getCatalogItemBySku(item.sku);
              const cleanSku = item.sku.toUpperCase();
              const isClearance = Boolean(item.nhItems);
              const promoDeal = promoDealBySku?.[cleanSku];
              const hasMetaLine = !!(catalogItem?.limitedQty || catalogItem?.palletSize);
              const lineUnavailable =
                unavailableKey.has(`${cleanSku}::${isClearance ? "nh" : "cat"}`) ||
                (catalogItem ? !isOrderableItem(catalogItem) : true);

              return (
                <article
                  key={`${item.sku}-${item.nhItems ? "nh" : "cat"}-${index}`}
                  style={{
                    ...reviewItemStyle,
                    ...(lineUnavailable ? { border: "1px solid #fca5a5", background: "#fef2f2" } : null),
                  }}
                >
                  <div style={{ flex: "1 1 min(260px, 100%)", minWidth: 0, display: "flex", gap: 10 }}>
                    <ProductImage sku={item.sku} alt={item.sku} size={48} imageUrl={catalogItem?.imageUrl} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 15, fontWeight: 900, color: "#111827" }}>{item.sku}</div>
                      <div
                        title={`${catalogItem?.brand ? `${catalogItem.brand} | ` : ""}${catalogItem?.name ?? ""}`}
                        style={{
                          fontSize: 12,
                          color: "#4b5563",
                          marginTop: 3,
                          lineHeight: 1.35,
                          overflow: "hidden",
                          display: "-webkit-box",
                          WebkitBoxOrient: "vertical",
                          WebkitLineClamp: 2,
                        }}
                      >
                        {catalogItem?.brand ? `${catalogItem.brand} | ` : ""}
                        {catalogItem?.name || "-"}
                      </div>
                      {lineUnavailable ? (
                        <div style={{ fontSize: 11, fontWeight: 800, color: "#b91c1c", marginTop: 4 }}>
                          {catalogItem
                            ? t.statusWarning
                                .replace("{sku}", cleanSku)
                                .replace("{status}", String(catalogItem.status || "").trim().toUpperCase() || t.orderNotAvailable)
                            : t.unavailableMissingSku.replace("{sku}", cleanSku)}
                        </div>
                      ) : null}
                      {hasMetaLine ? (
                        <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
                          {catalogItem?.palletSize ? `${t.pallet}: ${catalogItem.palletSize}` : ""}
                          {catalogItem?.palletSize && catalogItem?.limitedQty ? " · " : ""}
                          {catalogItem?.limitedQty ? `${t.limited}: ${catalogItem.limitedQty}` : ""}
                        </div>
                      ) : null}
                      {promoDeal ? (
                        <div style={{ ...promoDealStyle, marginTop: 6, textAlign: "left", whiteSpace: "pre-line" }}>
                          {promoDeal}
                        </div>
                      ) : null}
                      {isClearance ? (
                        <div style={{ ...clearancePolicyStyle, marginTop: 6 }}>{t.clearanceNoReturn}</div>
                      ) : null}
                    </div>
                  </div>

                  <div style={compactQtyStripWrapStyle}>
                    <div style={{ ...reviewQtyControlStyle, width: "100%", maxWidth: 300 }}>
                      <button type="button" onClick={() => onAdjustQty(item.sku, -1, item.nhItems)} style={reviewQtyButtonStyle}>
                        −
                      </button>
                      <input
                        value={item.qty}
                        onChange={(e) => onQtyInput(item.sku, e.target.value, item.nhItems)}
                        inputMode="numeric"
                        style={reviewQtyInputStyle}
                      />
                      <button type="button" onClick={() => onAdjustQty(item.sku, 1, item.nhItems)} style={reviewQtyButtonStyle}>
                        +
                      </button>
                      <button type="button" onClick={() => onRemove(item.sku, item.nhItems)} style={reviewRemoveButtonStyle}>
                        {t.remove}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <footer style={reviewModalFooterStyle}>
          <button type="button" onClick={() => (submitting ? undefined : onClose())} disabled={submitting} style={secondaryButtonStyle}>
            {t.back}
          </button>
          <button
            type="button"
            onClick={() => {
              void onSubmit();
            }}
            disabled={submitting || hasUnavailable || items.length === 0}
            title={hasUnavailable ? t.confirmSubmitBlocked : undefined}
            style={{
              ...submitButtonStyle,
              background: submitting || hasUnavailable || items.length === 0 ? "#93c5fd" : "#16a34a",
            }}
          >
            {submitting ? t.submitting : hasUnavailable ? t.confirmSubmitBlocked : t.confirmSubmit}
          </button>
        </footer>
      </div>
    </div>
  );
}

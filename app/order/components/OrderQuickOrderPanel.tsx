"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import {
  formatOrderNotAvailableMessage,
  getDisplayStatus,
  isNewItem,
  isOrderableItem,
} from "../catalogUtils";
import { copy } from "../orderCopy";
import { qtyButtonStyle, stepButtonStyle, stepInputStyle } from "../orderStyles";
import type { CartItem, CatalogItem, Lang } from "../types";
import { ProductImage } from "./ProductImage";

const MATCH_PREVIEW = 8;
const MATCH_EXPANDED = 30;

export function OrderQuickOrderPanel({
  lang,
  normalizedQuery,
  matchedItems,
  selectedItem,
  onSelectItem,
  catalogQtyMap,
  recentItems,
  frequentItems,
  showAvailableOnly,
  onShowAvailableOnlyChange,
  showAdminEditLinks,
  invoicePriceLabelForSku,
  productMeta,
  onApplyQuickQty,
  onAdjustQty,
  onUpdateQty,
  onAddSkuToCart,
}: {
  lang: Lang;
  normalizedQuery: string;
  matchedItems: CatalogItem[];
  selectedItem: CatalogItem | null;
  onSelectItem: (item: CatalogItem) => void;
  catalogQtyMap: Record<string, string>;
  recentItems: CartItem[];
  frequentItems: CatalogItem[];
  showAvailableOnly: boolean;
  onShowAvailableOnlyChange: (value: boolean) => void;
  showAdminEditLinks: boolean;
  invoicePriceLabelForSku: (sku: string) => string | undefined;
  productMeta: (item: CatalogItem) => ReactNode;
  onApplyQuickQty: (qty: string) => void;
  onAdjustQty: (sku: string, delta: number) => void;
  onUpdateQty: (sku: string, value: string) => void;
  onAddSkuToCart: (item: CatalogItem, qty?: string) => void;
}) {
  const t = copy[lang];
  const [showAllMatches, setShowAllMatches] = useState(false);
  const activeMatchRef = useRef<HTMLButtonElement | null>(null);

  const focusItem = selectedItem;
  const focusSku = focusItem?.sku?.toUpperCase() || "";
  const focusInCart = focusSku ? Number(catalogQtyMap[focusSku] || 0) : 0;
  const focusCanOrder = focusItem ? isOrderableItem(focusItem) : false;

  const visibleMatches = useMemo(() => {
    const limit = showAllMatches ? MATCH_EXPANDED : MATCH_PREVIEW;
    return matchedItems.slice(0, limit);
  }, [matchedItems, showAllMatches]);

  useEffect(() => {
    setShowAllMatches(false);
  }, [normalizedQuery]);

  useEffect(() => {
    activeMatchRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [focusItem?.sku]);

  const quickQtyButtons = ["1", "2", "3", "4", "5", "10", "15", "20"];

  const renderMatchRow = (item: CatalogItem, index: number) => {
    const sku = item.sku?.toUpperCase() || "";
    const isActive = focusItem?.sku === item.sku || (!focusItem && index === 0);
    const inCart = Number(catalogQtyMap[sku] || 0) > 0;
    const canOrder = isOrderableItem(item);
    const status = getDisplayStatus(item.status);
    const invoicePrice = invoicePriceLabelForSku(sku);
    const isNew = isNewItem(item);

    return (
      <div key={item.sku} className={`order-quick-match-wrap${isActive ? " is-active" : ""}`}>
        <button
          ref={isActive ? activeMatchRef : undefined}
          type="button"
          className={`order-quick-match${isActive ? " is-active" : ""}${inCart ? " is-in-cart" : ""}`}
          onClick={() => onSelectItem(item)}
        >
          <ProductImage sku={item.sku} alt={item.name || item.sku} size={44} imageUrl={item.imageUrl} />
          <div className="order-quick-match-text">
            <div className="order-quick-match-sku">
              {item.sku}
              {item.brand ? ` · ${item.brand}` : ""}
              {isNew ? <span className="order-quick-match-new">{t.newItems}</span> : null}
            </div>
            <div className="order-quick-match-name">{item.name || "—"}</div>
            {invoicePrice ? <div className="order-quick-match-price">{invoicePrice}</div> : null}
            {status && !canOrder ? (
              <div className="order-quick-match-status">{status}</div>
            ) : null}
          </div>
          <div className="order-quick-match-side">
            {inCart ? <span className="order-quick-match-cart">{catalogQtyMap[sku]}</span> : null}
          </div>
        </button>
        <button
          type="button"
          className="order-quick-match-add"
          disabled={!canOrder}
          title={t.addOneCase}
          aria-label={`${t.addOneCase} ${sku}`}
          onClick={() => onAdjustQty(item.sku, 1)}
        >
          +1
        </button>
      </div>
    );
  };

  const renderSkuChip = (
    sku: string,
    qty: string,
    onClick: () => void,
    className: string
  ) => (
    <button key={`${className}-${sku}`} type="button" className={className} onClick={onClick}>
      <span className="order-quick-recent-chip-sku">{sku}</span>
      <span className="order-quick-recent-chip-qty">+{qty}</span>
    </button>
  );

  return (
    <section className="order-quick-panel order-shop-card">
      <div className="order-quick-panel-head">
        <h2 className="order-quick-panel-title">{t.addItems}</h2>
        <p className="order-quick-panel-hint">{t.searchModeHint}</p>
        <p className="order-quick-panel-kbd">{t.quickOrderKeyboardHint}</p>
      </div>

      <label className="order-quick-filter">
        <input
          type="checkbox"
          checked={showAvailableOnly}
          onChange={(e) => onShowAvailableOnlyChange(e.target.checked)}
        />
        {t.availableOnly}
      </label>

      {normalizedQuery && matchedItems.length > 0 ? (
        <div className="order-quick-matches order-quick-matches--first">
          <div className="order-quick-matches-title">
            {t.quickOrderMatches.replace("{count}", String(matchedItems.length))}
          </div>
          <div className="order-quick-match-list">{visibleMatches.map(renderMatchRow)}</div>
          {matchedItems.length > MATCH_PREVIEW ? (
            <button
              type="button"
              className="order-quick-match-more"
              onClick={() => setShowAllMatches((prev) => !prev)}
            >
              {showAllMatches
                ? t.quickOrderShowLess
                : t.quickOrderShowMore.replace("{count}", String(matchedItems.length - MATCH_PREVIEW))}
            </button>
          ) : null}
        </div>
      ) : null}

      {normalizedQuery && matchedItems.length === 0 ? (
        <div className="order-quick-no-match">{t.noMatches}</div>
      ) : null}

      {focusItem ? (
        <article className={`order-quick-focus${focusInCart > 0 ? " is-in-cart" : ""}`}>
          <div className="order-quick-focus-top">
            <ProductImage
              sku={focusItem.sku}
              alt={focusItem.name || focusItem.sku}
              size={64}
              imageUrl={focusItem.imageUrl}
            />
            <div className="order-quick-focus-meta">
              <div className="order-quick-focus-sku">
                {focusItem.sku}
                {focusItem.brand ? <span> · {focusItem.brand}</span> : null}
                {isNewItem(focusItem) ? (
                  <span className="order-quick-match-new order-quick-match-new--focus">{t.newItems}</span>
                ) : null}
              </div>
              <div className="order-quick-focus-name">{focusItem.name || "—"}</div>
              {productMeta(focusItem)}
              {invoicePriceLabelForSku(focusItem.sku) ? (
                <div className="order-quick-focus-price">{invoicePriceLabelForSku(focusItem.sku)}</div>
              ) : null}
              {!focusCanOrder ? (
                <div className="order-quick-focus-blocked">
                  {formatOrderNotAvailableMessage(focusItem.sku || "", focusItem.status, t)}
                </div>
              ) : null}
              {focusInCart > 0 ? (
                <div className="order-quick-focus-in-cart">
                  {t.inCart}: {focusInCart} {t.cases}
                </div>
              ) : null}
            </div>
            {showAdminEditLinks ? (
              <a
                href={`/admin/products?sku=${encodeURIComponent(focusItem.sku)}`}
                className="order-quick-focus-edit"
              >
                {t.editProduct}
              </a>
            ) : null}
          </div>

          <div className="order-quick-focus-actions">
            <div className="order-quick-focus-stepper">
              <button
                type="button"
                onClick={() => onAdjustQty(focusItem.sku, -1)}
                disabled={!focusCanOrder}
                style={stepButtonStyle}
                aria-label="-"
              >
                −
              </button>
              <input
                value={catalogQtyMap[focusSku] || ""}
                onChange={(e) => onUpdateQty(focusItem.sku, e.target.value)}
                placeholder="0"
                inputMode="numeric"
                disabled={!focusCanOrder}
                style={stepInputStyle}
                aria-label={t.qty}
              />
              <button
                type="button"
                onClick={() => onAdjustQty(focusItem.sku, 1)}
                disabled={!focusCanOrder}
                style={stepButtonStyle}
                aria-label="+"
              >
                +
              </button>
            </div>
            <button
              type="button"
              className="order-quick-focus-add-one"
              disabled={!focusCanOrder}
              onClick={() => onAdjustQty(focusItem.sku, 1)}
            >
              {t.addOneCase}
            </button>
          </div>

          <div className="order-quick-qty-grid">
            {quickQtyButtons.map((qty) => (
              <button
                key={qty}
                type="button"
                onClick={() => onApplyQuickQty(qty)}
                style={qtyButtonStyle}
                disabled={!focusCanOrder}
              >
                {qty}
              </button>
            ))}
          </div>
        </article>
      ) : normalizedQuery ? (
        <div className="order-quick-empty-focus">{t.quickOrderPickSku}</div>
      ) : null}

      {!normalizedQuery ? (
        <>
          {recentItems.length > 0 ? (
            <div className="order-quick-recent">
              <div className="order-quick-recent-label">{t.recent}</div>
              <div className="order-quick-recent-track">
                {recentItems.slice(0, 14).map((item) => {
                  const sku = item.sku?.toUpperCase() || "";
                  return renderSkuChip(sku, item.qty || "1", () => onAddSkuToCart({ sku: item.sku } as CatalogItem, item.qty || "1"), "order-quick-recent-chip");
                })}
              </div>
            </div>
          ) : null}

          {frequentItems.length > 0 ? (
            <div className="order-quick-recent order-quick-frequent">
              <div className="order-quick-recent-label">{t.quickOrderFrequent}</div>
              <div className="order-quick-recent-track">
                {frequentItems.map((item) => {
                  const sku = item.sku?.toUpperCase() || "";
                  const inCart = Number(catalogQtyMap[sku] || 0);
                  return renderSkuChip(
                    sku,
                    inCart > 0 ? String(inCart) : "1",
                    () => onAdjustQty(item.sku, 1),
                    "order-quick-frequent-chip"
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="order-quick-empty-focus">{t.quickOrderEmptyHint}</div>
        </>
      ) : null}
    </section>
  );
}

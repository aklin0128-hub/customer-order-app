"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

import {
  formatOrderNotAvailableMessage,
  isOrderableItem,
} from "../catalogUtils";
import { copy } from "../orderCopy";
import { qtyButtonStyle, stepButtonStyle, stepInputStyle } from "../orderStyles";
import type { CartItem, CatalogItem, Lang } from "../types";
import { ProductImage } from "./ProductImage";

const MATCH_PREVIEW = 6;
const MATCH_EXPANDED = 24;

export function OrderQuickOrderPanel({
  lang,
  normalizedQuery,
  matchedItems,
  selectedItem,
  onSelectItem,
  catalogQtyMap,
  recentItems,
  showAvailableOnly,
  onShowAvailableOnlyChange,
  showAdminEditLinks,
  invoicePriceLabelForSku,
  productMeta,
  qtyInput,
  onQtyInputChange,
  onAddItem,
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
  showAvailableOnly: boolean;
  onShowAvailableOnlyChange: (value: boolean) => void;
  showAdminEditLinks: boolean;
  invoicePriceLabelForSku: (sku: string) => string | undefined;
  productMeta: (item: CatalogItem) => ReactNode;
  qtyInput: string;
  onQtyInputChange: (value: string) => void;
  onAddItem: () => void;
  onApplyQuickQty: (qty: string) => void;
  onAdjustQty: (sku: string, delta: number) => void;
  onUpdateQty: (sku: string, value: string) => void;
  onAddSkuToCart: (item: CatalogItem, qty?: string) => void;
}) {
  const t = copy[lang];
  const [showAllMatches, setShowAllMatches] = useState(false);

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

  const quickQtyButtons = ["1", "2", "3", "4", "5", "10", "15", "20"];

  return (
    <section className="order-quick-panel order-shop-card">
      <div className="order-quick-panel-head">
        <h2 className="order-quick-panel-title">{t.addItems}</h2>
        <p className="order-quick-panel-hint">{t.searchModeHint}</p>
      </div>

      <label className="order-quick-filter">
        <input
          type="checkbox"
          checked={showAvailableOnly}
          onChange={(e) => onShowAvailableOnlyChange(e.target.checked)}
        />
        {t.availableOnly}
      </label>

      {recentItems.length > 0 ? (
        <div className="order-quick-recent">
          <div className="order-quick-recent-label">{t.recent}</div>
          <div className="order-quick-recent-track">
            {recentItems.slice(0, 14).map((item) => {
              const sku = item.sku?.toUpperCase() || "";
              return (
                <button
                  key={sku}
                  type="button"
                  className="order-quick-recent-chip"
                  onClick={() => onAddSkuToCart({ sku: item.sku } as CatalogItem, item.qty || "1")}
                >
                  <span className="order-quick-recent-chip-sku">{sku}</span>
                  <span className="order-quick-recent-chip-qty">+{item.qty || "1"}</span>
                </button>
              );
            })}
          </div>
        </div>
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
      ) : (
        <div className="order-quick-empty-focus">{t.quickOrderEmptyHint}</div>
      )}

      <div className="order-quick-composer order-quick-composer--panel">
        <label className="order-quick-composer-label" htmlFor="order-quick-qty-input">
          {t.qty}
        </label>
        <input
          id="order-quick-qty-input"
          className="order-quick-composer-qty"
          value={qtyInput}
          onChange={(e) => onQtyInputChange(e.target.value.replace(/[^0-9]/g, ""))}
          placeholder="1"
          inputMode="numeric"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onAddItem();
            }
          }}
        />
        <button type="button" className="order-quick-composer-add" onClick={onAddItem}>
          {t.addItem}
        </button>
      </div>
      <p className="order-quick-composer-tip">{t.tapAdd}</p>

      {normalizedQuery && matchedItems.length === 0 ? (
        <div className="order-quick-no-match">{t.noMatches}</div>
      ) : null}

      {normalizedQuery && matchedItems.length > 0 ? (
        <div className="order-quick-matches">
          <div className="order-quick-matches-title">
            {t.quickOrderMatches.replace("{count}", String(matchedItems.length))}
          </div>
          <div className="order-quick-match-list">
            {visibleMatches.map((item, index) => {
              const sku = item.sku?.toUpperCase() || "";
              const isActive = focusItem?.sku === item.sku || (!focusItem && index === 0);
              const inCart = Number(catalogQtyMap[sku] || 0) > 0;
              const canOrder = isOrderableItem(item);
              return (
                <button
                  key={item.sku}
                  type="button"
                  className={`order-quick-match${isActive ? " is-active" : ""}${inCart ? " is-in-cart" : ""}`}
                  onClick={() => onSelectItem(item)}
                >
                  <ProductImage sku={item.sku} alt={item.name || item.sku} size={44} imageUrl={item.imageUrl} />
                  <div className="order-quick-match-text">
                    <div className="order-quick-match-sku">
                      {item.sku}
                      {item.brand ? ` · ${item.brand}` : ""}
                    </div>
                    <div className="order-quick-match-name">{item.name || "—"}</div>
                  </div>
                  <div className="order-quick-match-side">
                    {inCart ? <span className="order-quick-match-cart">{catalogQtyMap[sku]}</span> : null}
                    {!canOrder ? <span className="order-quick-match-blocked">!</span> : null}
                  </div>
                </button>
              );
            })}
          </div>
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
    </section>
  );
}

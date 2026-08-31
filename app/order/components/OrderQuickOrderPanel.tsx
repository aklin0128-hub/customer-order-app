"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  getDisplayStatus,
  isNewItem,
  isOrderableItem,
} from "../catalogUtils";
import { formatNewItemComingDate } from "@/lib/catalogNewItems";
import { getComingSoonBadgeLabel, isComingSoonNewItem } from "@/lib/comingSoonBadge";
import { isProductOrderingBlocked } from "@/lib/productAvailability";
import { inventoryCueKind, inventoryCueLabel } from "@/lib/inventoryCue";
import { copy } from "../orderCopy";
import { stepButtonStyle, stepInputStyle } from "../orderStyles";
import type { CartItem, CatalogItem, Lang } from "../types";
import { ProductImage } from "./ProductImage";
import { OrderQuickPicksStrip } from "./OrderQuickPicksStrip";

const MATCH_PREVIEW_COMPACT = 5;
const MATCH_PREVIEW_DESKTOP = 8;
const MATCH_EXPANDED_COMPACT = 18;
const MATCH_EXPANDED_DESKTOP = 30;

export function OrderQuickOrderPanel({
  lang,
  compact = false,
  hideQuickPicks = false,
  normalizedQuery,
  matchedItems,
  selectedItem,
  onSelectItem,
  catalogQtyMap,
  recentItems,
  frequentItems,
  showAvailableOnly,
  onShowAvailableOnlyChange,
  invoicePriceLabelForSku,
  onApplyQuickQty,
  onAdjustQty,
  onUpdateQty,
  onAddSkuToCart,
}: {
  lang: Lang;
  compact?: boolean;
  hideQuickPicks?: boolean;
  normalizedQuery: string;
  matchedItems: CatalogItem[];
  selectedItem: CatalogItem | null;
  onSelectItem: (item: CatalogItem) => void;
  catalogQtyMap: Record<string, string>;
  recentItems: CartItem[];
  frequentItems: CatalogItem[];
  showAvailableOnly: boolean;
  onShowAvailableOnlyChange: (value: boolean) => void;
  invoicePriceLabelForSku: (sku: string) => string | undefined;
  onApplyQuickQty: (qty: string) => void;
  onAdjustQty: (sku: string, delta: number) => void;
  onUpdateQty: (sku: string, value: string) => void;
  onAddSkuToCart: (item: CatalogItem, qty?: string) => void;
}) {
  const t = copy[lang];
  const [showAllMatches, setShowAllMatches] = useState(false);
  const activeMatchRef = useRef<HTMLButtonElement | null>(null);

  const focusItem = selectedItem;

  const matchPreview = compact ? MATCH_PREVIEW_COMPACT : MATCH_PREVIEW_DESKTOP;
  const matchExpanded = compact ? MATCH_EXPANDED_COMPACT : MATCH_EXPANDED_DESKTOP;
  const quickQtyButtons = compact ? ["1", "2", "5", "10"] : ["1", "2", "3", "5", "10", "20"];

  const visibleMatches = useMemo(() => {
    const limit = showAllMatches ? matchExpanded : matchPreview;
    return matchedItems.slice(0, limit);
  }, [matchedItems, showAllMatches, matchExpanded, matchPreview]);

  useEffect(() => {
    setShowAllMatches(false);
  }, [normalizedQuery]);

  useEffect(() => {
    activeMatchRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [focusItem?.sku]);

  const renderExpandedControls = (item: CatalogItem) => {
    const sku = item.sku?.toUpperCase() || "";
    const canAdd = isOrderableItem(item) && !isProductOrderingBlocked(item);

    return (
      <div className="order-quick-match-expanded">
        <div className="order-quick-focus-stepper">
          <button
            type="button"
            onClick={() => onAdjustQty(item.sku, -1)}
            disabled={!canAdd}
            style={stepButtonStyle}
            aria-label="-"
          >
            −
          </button>
          <input
            value={catalogQtyMap[sku] || ""}
            onChange={(e) => onUpdateQty(item.sku, e.target.value)}
            placeholder="0"
            inputMode="numeric"
            disabled={!canAdd}
            style={stepInputStyle}
            aria-label={t.qty}
          />
          <button
            type="button"
            onClick={() => onAdjustQty(item.sku, 1)}
            disabled={!canAdd}
            style={stepButtonStyle}
            aria-label="+"
          >
            +
          </button>
        </div>
        <div className="order-quick-qty-grid order-quick-qty-grid--compact">
          {quickQtyButtons.map((qty) => (
            <button
              key={qty}
              type="button"
              onClick={() => onApplyQuickQty(qty)}
              disabled={!canAdd}
              className="order-quick-qty-chip"
            >
              {qty}
            </button>
          ))}
        </div>
      </div>
    );
  };

  const renderMatchRow = (item: CatalogItem, index: number) => {
    const sku = item.sku?.toUpperCase() || "";
    const isActive = focusItem?.sku === item.sku || (!focusItem && index === 0);
    const inCart = Number(catalogQtyMap[sku] || 0) > 0;
    const canOrder = isOrderableItem(item);
    const status = getDisplayStatus(item.status);
    const invoicePrice = invoicePriceLabelForSku(sku);
    const comingSoon = isComingSoonNewItem(item);
    const comingDateText = item.newItemComingDate
      ? formatNewItemComingDate(item.newItemComingDate, lang)
      : null;
    const canAdd = canOrder && !isProductOrderingBlocked(item);
    const inventoryCue = inventoryCueKind(item.inventory);

    return (
      <div key={item.sku} className={`order-quick-match-wrap${isActive ? " is-active" : ""}`}>
        <div className="order-quick-match-row">
          <button
            ref={isActive ? activeMatchRef : undefined}
            type="button"
            className={`order-quick-match${isActive ? " is-active" : ""}${inCart ? " is-in-cart" : ""}`}
            onClick={() => onSelectItem(item)}
          >
            <ProductImage
              sku={item.sku}
              alt={item.name || item.sku}
              size={compact ? 36 : 44}
              imageUrl={item.imageUrl}
            />
            <div className="order-quick-match-text">
              <div className="order-quick-match-sku">
                {item.sku}
                {item.brand ? ` · ${item.brand}` : ""}
                {isNewItem(item) ? <span className="order-quick-match-new">{t.newItems}</span> : null}
                {comingSoon ? (
                  <span className="order-quick-match-coming-soon">{getComingSoonBadgeLabel(lang)}</span>
                ) : null}
              </div>
              <div className="order-quick-match-name">{item.name || "—"}</div>
              {comingDateText ? (
                <div className="order-quick-match-coming-date">
                  {t.comingDate}: {comingDateText}
                </div>
              ) : null}
              {!compact && invoicePrice ? <div className="order-quick-match-price">{invoicePrice}</div> : null}
              {status && !canOrder ? <div className="order-quick-match-status">{status}</div> : null}
              {inventoryCue ? (
                <div className={`catalog-inventory-cue catalog-inventory-cue--${inventoryCue === "maybe_oos" ? "oos" : "low"}`}>
                  {inventoryCueLabel(inventoryCue, lang)}
                </div>
              ) : null}
            </div>
            <div className="order-quick-match-side">
              {inCart ? <span className="order-quick-match-cart">{catalogQtyMap[sku]}</span> : null}
            </div>
          </button>
          <button
            type="button"
            className="order-quick-match-add"
            disabled={!canAdd}
            title={t.addOneCase}
            aria-label={`${t.addOneCase} ${sku}`}
            onClick={() => onAdjustQty(item.sku, 1)}
          >
            +1
          </button>
        </div>
        {isActive && focusItem?.sku === item.sku ? renderExpandedControls(item) : null}
      </div>
    );
  };

  return (
    <section className={`order-quick-panel order-shop-card${compact ? " order-quick-panel--compact" : ""}`}>
      {!compact ? (
        <>
          <p className="order-quick-panel-kbd">{t.quickOrderKeyboardHint}</p>
          <label className="order-quick-filter">
            <input
              type="checkbox"
              checked={showAvailableOnly}
              onChange={(e) => onShowAvailableOnlyChange(e.target.checked)}
            />
            {t.availableOnly}
          </label>
        </>
      ) : null}

      {!normalizedQuery ? (
        hideQuickPicks ? null : (
          <>
            <OrderQuickPicksStrip
              lang={lang}
              compact={compact}
              recentItems={recentItems}
              frequentItems={frequentItems}
              catalogQtyMap={catalogQtyMap}
              onAddSkuToCart={onAddSkuToCart}
              onAdjustQty={onAdjustQty}
            />
            {!compact && recentItems.length === 0 && frequentItems.length === 0 ? (
              <div className="order-quick-empty-focus">{t.quickOrderEmptyHint}</div>
            ) : null}
          </>
        )
      ) : matchedItems.length === 0 ? (
        <div className="order-quick-no-match">{t.noMatches}</div>
      ) : (
        <div className="order-quick-matches order-quick-matches--first">
          {!compact ? (
            <div className="order-quick-matches-title">
              {t.quickOrderMatches.replace("{count}", String(matchedItems.length))}
            </div>
          ) : null}
          <div className="order-quick-match-list">{visibleMatches.map(renderMatchRow)}</div>
          {matchedItems.length > matchPreview ? (
            <button
              type="button"
              className="order-quick-match-more"
              onClick={() => setShowAllMatches((prev) => !prev)}
            >
              {showAllMatches
                ? t.quickOrderShowLess
                : t.quickOrderShowMore.replace("{count}", String(matchedItems.length - matchPreview))}
            </button>
          ) : null}
        </div>
      )}

    </section>
  );
}

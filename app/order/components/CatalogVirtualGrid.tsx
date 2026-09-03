"use client";

import { measureElement, useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import {
  catalogColumnCountForWidth,
  catalogColGapPx,
  catalogRowEstimatePx,
  catalogRowGapPx,
} from "../catalogGridLayout";
import { catalogVirtualScrollStyle } from "../orderStyles";
import type { CatalogItem, Lang } from "../types";
import { isProductOrderingBlocked } from "@/lib/productAvailability";
import { CatalogQtyCard } from "./CatalogQtyCard";

function readScrollContainerWidth(el: HTMLElement | null) {
  if (!el) return 0;
  const w = el.clientWidth || el.offsetWidth;
  return w > 0 ? w : 0;
}

export function CatalogVirtualGrid({
  gridKey,
  items,
  catalogQtyMap,
  inCartLabel,
  promoBadgeLabel,
  weeklyPickSkus,
  newItemChecker,
  newBadgeLabel,
  editLabel,
  palletLabel,
  justAddedLabel,
  uniformNewPill,
  showAddedDate,
  addedDateLabel,
  showPublishedDate,
  publishedDateLabel,
  showComingDate,
  comingDateLabel,
  lang,
  showAdminEdit,
  showNewItemListPrice,
  showNewProductBadge,
  newProductBadgeChecker,
  listPriceLabel,
  canOrderItem,
  orderBlockedMessage,
  invoicePriceLabelForSku,
  onAdjust,
  onUpdateQty,
  onAdminCategoryChange,
  adminCategoryLabel,
  adminCategoryAutoLabel,
}: {
  /** Remount virtualizer when switching catalog modes (catalog vs new items, etc.). */
  gridKey?: string;
  items: CatalogItem[];
  catalogQtyMap: Record<string, string>;
  inCartLabel: string;
  promoBadgeLabel: string;
  weeklyPickSkus?: Set<string>;
  newItemChecker?: (item: CatalogItem) => boolean;
  newBadgeLabel?: string;
  editLabel?: string;
  palletLabel?: string;
  justAddedLabel?: string;
  uniformNewPill?: boolean;
  showAddedDate?: boolean;
  addedDateLabel?: string;
  showPublishedDate?: boolean;
  publishedDateLabel?: string;
  showComingDate?: boolean;
  comingDateLabel?: string;
  lang?: Lang;
  showAdminEdit?: boolean;
  showNewItemListPrice?: boolean;
  showNewProductBadge?: boolean;
  /** When set with showNewProductBadge, only matching items get the blue New badge. */
  newProductBadgeChecker?: (item: CatalogItem) => boolean;
  listPriceLabel?: string;
  canOrderItem?: (item: CatalogItem) => boolean;
  orderBlockedMessage?: (item: CatalogItem) => string;
  invoicePriceLabelForSku?: (sku: string) => string | undefined;
  onAdjust: (sku: string, delta: number) => void;
  onUpdateQty: (sku: string, value: string) => void;
  onAdminCategoryChange?: (sku: string, category: string) => void | Promise<void>;
  adminCategoryLabel?: string;
  adminCategoryAutoLabel?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(() =>
    typeof window !== "undefined" ? Math.max(0, window.innerWidth - 32) : 0
  );

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const measure = () => {
      const next = readScrollContainerWidth(el);
      if (next > 0) setWidth(next);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [gridKey, items.length]);

  const columnCount = useMemo(() => {
    if (width > 0) return catalogColumnCountForWidth(width);
    if (typeof window !== "undefined") return catalogColumnCountForWidth(window.innerWidth - 32);
    return 4;
  }, [width]);

  const colGap = catalogColGapPx();
  const rowGap = catalogRowGapPx();
  const rowEstimate = useMemo(() => catalogRowEstimatePx(columnCount), [columnCount]);

  const rowCount = Math.max(1, Math.ceil(items.length / columnCount));

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowEstimate,
    // Fixed gap between measured rows — stays even if a row remeasures short.
    gap: rowGap,
    overscan: 3,
    measureElement,
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [gridKey, columnCount]);

  useLayoutEffect(() => {
    rowVirtualizer.measure();
    const t1 = window.requestAnimationFrame(() => {
      rowVirtualizer.measure();
      window.requestAnimationFrame(() => rowVirtualizer.measure());
    });
    const delayed = [120, 400, 900].map((ms) => window.setTimeout(() => rowVirtualizer.measure(), ms));
    return () => {
      window.cancelAnimationFrame(t1);
      delayed.forEach((id) => window.clearTimeout(id));
    };
  }, [items.length, columnCount, gridKey, width, rowEstimate, rowVirtualizer]);

  useLayoutEffect(() => {
    const root = scrollRef.current;
    if (!root) return;

    const remeasure = () => rowVirtualizer.measure();
    const resizeObserver = new ResizeObserver(remeasure);
    const observeRows = () => {
      resizeObserver.disconnect();
      root.querySelectorAll(".order-catalog-virtual-row").forEach((row) => resizeObserver.observe(row));
      root.querySelectorAll(".catalog-qty-card").forEach((card) => resizeObserver.observe(card));
      remeasure();
    };

    observeRows();
    const mutationObserver = new MutationObserver(observeRows);
    mutationObserver.observe(root, { childList: true, subtree: true });
    root.addEventListener("load", remeasure, true);

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      root.removeEventListener("load", remeasure, true);
    };
  }, [items.length, columnCount, gridKey, rowVirtualizer]);

  if (items.length === 0) return null;

  return (
    <div
      key={gridKey}
      ref={scrollRef}
      className="order-catalog-virtual-scroll"
      style={catalogVirtualScrollStyle}
    >
      <div style={{ height: rowVirtualizer.getTotalSize(), position: "relative", width: "100%" }}>
        {rowVirtualizer.getVirtualItems().map((vr) => {
          const rowStart = vr.index * columnCount;
          const rowItems = items.slice(rowStart, rowStart + columnCount);
          return (
            <div
              key={vr.key}
              ref={rowVirtualizer.measureElement}
              data-index={vr.index}
              className="order-catalog-virtual-row"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${vr.start}px)`,
                display: "grid",
                gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
                alignItems: "start",
                columnGap: colGap,
                rowGap: 0,
                boxSizing: "border-box",
              }}
            >
              {rowItems.map((item) => {
                const sku = item.sku?.toUpperCase() || "";
                const qty = catalogQtyMap[sku] || "";
                const isWeekly = weeklyPickSkus?.has(sku);
                const showItemNewBadge = Boolean(
                  showNewProductBadge && (!newProductBadgeChecker || newProductBadgeChecker(item))
                );
                const promoNote = uniformNewPill || showItemNewBadge
                  ? undefined
                  : isWeekly
                    ? promoBadgeLabel
                    : newItemChecker?.(item)
                      ? newBadgeLabel
                      : undefined;
                const canOrder = (canOrderItem?.(item) ?? true) && !isProductOrderingBlocked(item);
                return (
                  <CatalogQtyCard
                    key={item.sku}
                    item={item}
                    qty={qty}
                    promoNote={promoNote}
                    inCartLabel={inCartLabel}
                    promoBadgeLabel={promoBadgeLabel}
                    highlight={Boolean(isWeekly)}
                    editLabel={editLabel}
                    palletLabel={palletLabel}
                    justAddedLabel={justAddedLabel}
                    uniformNewPill={uniformNewPill}
                    showAddedDate={showAddedDate}
                    addedDateLabel={addedDateLabel}
                    showPublishedDate={showPublishedDate}
                    publishedDateLabel={publishedDateLabel}
                    showComingDate={showComingDate}
                    comingDateLabel={comingDateLabel}
                    lang={lang}
                    showAdminEdit={showAdminEdit}
                    showNewItemListPrice={showNewItemListPrice}
                    showNewProductBadge={showItemNewBadge}
                    listPriceLabel={listPriceLabel}
                    disabled={!canOrder}
                    unavailableNote={!canOrder ? orderBlockedMessage?.(item) : undefined}
                    invoicePrice={invoicePriceLabelForSku?.(sku)}
                    onAdjust={onAdjust}
                    onUpdateQty={onUpdateQty}
                    onAdminCategoryChange={onAdminCategoryChange}
                    adminCategoryLabel={adminCategoryLabel}
                    adminCategoryAutoLabel={adminCategoryAutoLabel}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

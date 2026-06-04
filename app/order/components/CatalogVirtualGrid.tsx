"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import {
  catalogColumnCountForWidth,
  CATALOG_GRID_GAP_PX,
  CATALOG_ROW_HEIGHT_PX,
  catalogRowStridePx,
} from "../catalogGridLayout";
import { catalogVirtualScrollStyle } from "../orderStyles";
import type { CatalogItem, Lang } from "../types";
import { CatalogQtyCard } from "./CatalogQtyCard";

const GAP = CATALOG_GRID_GAP_PX;
const ROW_HEIGHT = CATALOG_ROW_HEIGHT_PX;
const ROW_STRIDE = catalogRowStridePx();

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
  clearancePickSkus,
  newItemChecker,
  clearanceBadgeLabel,
  newBadgeLabel,
  editLabel,
  palletLabel,
  justAddedLabel,
  uniformNewPill,
  showAddedDate,
  addedDateLabel,
  lang,
  showAdminEdit,
  canOrderItem,
  orderBlockedMessage,
  invoicePriceLabelForSku,
  onAdjust,
  onUpdateQty,
}: {
  /** Remount virtualizer when switching catalog modes (catalog vs new items, etc.). */
  gridKey?: string;
  items: CatalogItem[];
  catalogQtyMap: Record<string, string>;
  inCartLabel: string;
  promoBadgeLabel: string;
  weeklyPickSkus?: Set<string>;
  clearancePickSkus?: Set<string>;
  newItemChecker?: (item: CatalogItem) => boolean;
  clearanceBadgeLabel?: string;
  newBadgeLabel?: string;
  editLabel?: string;
  palletLabel?: string;
  justAddedLabel?: string;
  uniformNewPill?: boolean;
  showAddedDate?: boolean;
  addedDateLabel?: string;
  lang?: Lang;
  showAdminEdit?: boolean;
  canOrderItem?: (item: CatalogItem) => boolean;
  orderBlockedMessage?: (item: CatalogItem) => string;
  invoicePriceLabelForSku?: (sku: string) => string | undefined;
  onAdjust: (sku: string, delta: number) => void;
  onUpdateQty: (sku: string, value: string) => void;
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

  const rowCount = Math.max(1, Math.ceil(items.length / columnCount));

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_STRIDE,
    overscan: 3,
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [gridKey, columnCount]);

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
              data-index={vr.index}
              className="order-catalog-virtual-row"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: ROW_HEIGHT,
                paddingBottom: GAP,
                boxSizing: "content-box",
                transform: `translateY(${vr.start}px)`,
                display: "grid",
                gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
                alignItems: "stretch",
                columnGap: GAP,
              }}
            >
              {rowItems.map((item) => {
                const sku = item.sku?.toUpperCase() || "";
                const qty = catalogQtyMap[sku] || "";
                const isWeekly = weeklyPickSkus?.has(sku);
                const isClearance = clearancePickSkus?.has(sku);
                const promoNote = uniformNewPill
                  ? undefined
                  : isWeekly
                    ? promoBadgeLabel
                    : isClearance
                      ? clearanceBadgeLabel || promoBadgeLabel
                      : newItemChecker?.(item)
                        ? newBadgeLabel
                        : undefined;
                const canOrder = canOrderItem?.(item) ?? true;
                return (
                  <CatalogQtyCard
                    key={item.sku}
                    item={item}
                    qty={qty}
                    promoNote={promoNote}
                    inCartLabel={inCartLabel}
                    promoBadgeLabel={promoBadgeLabel}
                    highlight={Boolean(isWeekly || isClearance)}
                    editLabel={editLabel}
                    palletLabel={palletLabel}
                    justAddedLabel={justAddedLabel}
                    uniformNewPill={uniformNewPill}
                    showAddedDate={showAddedDate}
                    addedDateLabel={addedDateLabel}
                    lang={lang}
                    showAdminEdit={showAdminEdit}
                    disabled={!canOrder}
                    unavailableNote={!canOrder ? orderBlockedMessage?.(item) : undefined}
                    invoicePrice={invoicePriceLabelForSku?.(sku)}
                    onAdjust={onAdjust}
                    onUpdateQty={onUpdateQty}
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

"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useMemo, useRef, useState } from "react";

import { catalogColumnCountForWidth, CATALOG_GRID_GAP_PX } from "../catalogGridLayout";
import { catalogVirtualScrollStyle } from "../orderStyles";
import { isJustAddedItem } from "../catalogUtils";
import type { CatalogItem, Lang } from "../types";
import { CatalogQtyCard } from "./CatalogQtyCard";

const GAP = CATALOG_GRID_GAP_PX;
/** Initial row height before measure; kept close to real card height to avoid huge gaps */
const ROW_HEIGHT = 330;

export function CatalogVirtualGrid({
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
  onAdjust,
  onUpdateQty,
}: {
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
  onAdjust: (sku: string, delta: number) => void;
  onUpdateQty: (sku: string, value: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const measure = () => {
      const next = el.offsetWidth;
      if (next > 0) setWidth(next);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);

    const raf = requestAnimationFrame(measure);
    const timer = window.setTimeout(measure, 100);
    window.addEventListener("resize", measure);

    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
      window.removeEventListener("resize", measure);
    };
  }, [items.length]);

  const columnCount = useMemo(() => catalogColumnCountForWidth(width), [width]);

  const rowCount = Math.max(1, Math.ceil(items.length / columnCount));

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT + GAP,
    overscan: 2,
  });

  useEffect(() => {
    rowVirtualizer.measure();
    const timer = window.setTimeout(() => rowVirtualizer.measure(), 150);
    return () => window.clearTimeout(timer);
    // rowVirtualizer is stable enough; remeasure when layout inputs change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columnCount, rowCount, items.length]);

  if (items.length === 0) return null;

  return (
    <div ref={scrollRef} className="order-catalog-virtual-scroll" style={catalogVirtualScrollStyle}>
      <div style={{ height: rowVirtualizer.getTotalSize(), position: "relative", width: "100%" }}>
        {rowVirtualizer.getVirtualItems().map((vr) => {
          const rowStart = vr.index * columnCount;
          const rowItems = items.slice(rowStart, rowStart + columnCount);
          return (
            <div
              key={vr.key}
              ref={rowVirtualizer.measureElement}
              data-index={vr.index}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${vr.start}px)`,
                display: "grid",
                gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
                alignItems: "stretch",
                columnGap: GAP,
                paddingBottom: GAP,
                boxSizing: "border-box",
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

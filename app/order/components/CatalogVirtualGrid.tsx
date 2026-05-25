"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useMemo, useRef, useState } from "react";

import { catalogVirtualScrollStyle } from "../orderStyles";
import { isJustAddedItem } from "../catalogUtils";
import type { CatalogItem } from "../types";
import { CatalogQtyCard } from "./CatalogQtyCard";

const GAP = 8;
const MAX_CATALOG_WIDTH = 1280;
const DESKTOP_COLUMNS = 6;
/** Initial row height before measure; kept close to real card height to avoid huge gaps */
const ROW_HEIGHT = 268;

function columnCountForWidth(rawWidth: number) {
  const width =
    rawWidth > 0
      ? rawWidth
      : typeof window !== "undefined"
        ? Math.min(MAX_CATALOG_WIDTH, window.innerWidth - 40)
        : MAX_CATALOG_WIDTH;
  if (width >= 1024) return DESKTOP_COLUMNS;
  if (width >= 768) return 4;
  if (width >= 520) return 3;
  return 2;
}

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

  const columnCount = useMemo(() => columnCountForWidth(width), [width]);

  const rowCount = Math.max(1, Math.ceil(items.length / columnCount));

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT + GAP,
    overscan: 2,
  });

  useEffect(() => {
    rowVirtualizer.measure();
  }, [columnCount, rowCount]);

  if (items.length === 0) return null;

  return (
    <div ref={scrollRef} style={catalogVirtualScrollStyle}>
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
                columnGap: GAP,
                rowGap: GAP,
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

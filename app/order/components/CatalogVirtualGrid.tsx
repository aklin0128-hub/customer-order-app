"use client";

import { measureElement, useVirtualizer, useWindowVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentProps, type RefObject } from "react";

import {
  CATALOG_VIRTUAL_OVERSCAN,
  catalogColumnCountForWidth,
  catalogColGapPx,
  catalogListDocumentTop,
  catalogRowEstimatePx,
  catalogRowGapPx,
  catalogVirtualRowKey,
  measureCatalogVirtualRow,
} from "../catalogGridLayout";
import { catalogVirtualScrollStyle } from "../orderStyles";
import type { CatalogItem, Lang } from "../types";
import { isProductOrderingBlocked } from "@/lib/productAvailability";
import { CatalogQtyCard } from "./CatalogQtyCard";

type CatalogCardExtras = Partial<
  Pick<
    ComponentProps<typeof CatalogQtyCard>,
    | "favorite"
    | "favoriteLabel"
    | "onToggleFavorite"
    | "lastOrderedLabel"
    | "onOpenHistory"
    | "showUpc"
    | "invoicePrice"
    | "reserveInvoicePrice"
    | "lang"
    | "showAdminEdit"
    | "onAdminCategoryChange"
    | "adminCategoryLabel"
    | "adminCategoryAutoLabel"
  >
>;

type CatalogGridBodyProps = {
  gridKey?: string;
  embedScroll?: boolean;
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
  newProductBadgeChecker?: (item: CatalogItem) => boolean;
  listPriceLabel?: string;
  canOrderItem?: (item: CatalogItem) => boolean;
  orderBlockedMessage?: (item: CatalogItem) => string;
  invoicePriceLabelForSku?: (sku: string) => string | undefined;
  extraCardProps?: (sku: string) => CatalogCardExtras;
  onAdjust: (sku: string, delta: number) => void;
  onUpdateQty: (sku: string, value: string) => void;
  onAdminCategoryChange?: (sku: string, category: string) => void | Promise<void>;
  adminCategoryLabel?: string;
  adminCategoryAutoLabel?: string;
};

function readScrollContainerWidth(el: HTMLElement | null) {
  if (!el) return 0;
  const w = el.clientWidth || el.offsetWidth;
  return w > 0 ? w : 0;
}

function measureVirtualRowElement(
  element: Element,
  entry: ResizeObserverEntry | undefined,
  instance: Parameters<typeof measureElement>[2]
) {
  return measureCatalogVirtualRow(element as HTMLElement) || measureElement(element, entry, instance);
}

export function CatalogVirtualGrid(props: CatalogGridBodyProps) {
  const mode = props.embedScroll ? "embed" : "page";
  const Body = props.embedScroll ? CatalogEmbedGridBody : CatalogWindowGridBody;
  return <Body key={`${props.gridKey || "catalog"}:${mode}`} {...props} />;
}

function useCatalogGridMetrics(listRef: RefObject<HTMLDivElement | null>, gridKey?: string, itemCount = 0) {
  const [width, setWidth] = useState(() =>
    typeof window !== "undefined" ? Math.max(0, window.innerWidth - 32) : 0
  );

  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;

    const measure = () => {
      const next = readScrollContainerWidth(el);
      if (next > 0) setWidth((prev) => (prev === next ? prev : next));
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    const parent = el.closest(".order-container");
    if (parent) ro.observe(parent);
    window.addEventListener("resize", measure);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [gridKey, itemCount, listRef]);

  const columnCount = useMemo(() => {
    if (width > 0) return catalogColumnCountForWidth(width);
    if (typeof window !== "undefined") return catalogColumnCountForWidth(window.innerWidth - 32);
    return 4;
  }, [width]);

  return {
    columnCount,
    colGap: catalogColGapPx(),
    rowGap: catalogRowGapPx(),
    rowEstimate: catalogRowEstimatePx(columnCount),
  };
}

function CatalogWindowGridBody(props: CatalogGridBodyProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const { columnCount, colGap, rowGap, rowEstimate } = useCatalogGridMetrics(
    listRef,
    props.gridKey,
    props.items.length
  );
  const [scrollMargin, setScrollMargin] = useState(0);
  const rowCount = Math.max(1, Math.ceil(props.items.length / columnCount));

  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const update = () => setScrollMargin((prev) => {
      const next = catalogListDocumentTop(el);
      return prev === next ? prev : next;
    });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    const parent = el.closest(".order-container");
    if (parent) ro.observe(parent);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [props.gridKey, props.items.length, columnCount]);

  const rowVirtualizer = useWindowVirtualizer({
    count: rowCount,
    estimateSize: () => rowEstimate,
    getItemKey: (index) => catalogVirtualRowKey(props.items, index, columnCount),
    gap: rowGap,
    paddingEnd: rowGap,
    overscan: CATALOG_VIRTUAL_OVERSCAN,
    scrollMargin,
    measureElement: measureVirtualRowElement,
  });

  const scrollMarginRef = useRef(0);
  scrollMarginRef.current = scrollMargin;
  const skipWindowReset = useRef(true);
  useEffect(() => {
    if (skipWindowReset.current) {
      skipWindowReset.current = false;
      return;
    }
    window.scrollTo({ top: Math.max(0, scrollMarginRef.current - 12) });
  }, [props.gridKey, columnCount]);

  useLayoutEffect(() => {
    rowVirtualizer.measure();
  }, [props.items.length, columnCount, props.gridKey, rowEstimate, rowVirtualizer]);

  if (props.items.length === 0) return null;

  return (
    <div ref={listRef} className="order-catalog-virtual-scroll" style={catalogVirtualScrollStyle}>
      <CatalogVirtualRows
        items={props.items}
        columnCount={columnCount}
        colGap={colGap}
        rowCount={rowCount}
        scrollMargin={scrollMargin}
        rowVirtualizer={rowVirtualizer}
        catalogQtyMap={props.catalogQtyMap}
        inCartLabel={props.inCartLabel}
        promoBadgeLabel={props.promoBadgeLabel}
        weeklyPickSkus={props.weeklyPickSkus}
        newItemChecker={props.newItemChecker}
        newBadgeLabel={props.newBadgeLabel}
        editLabel={props.editLabel}
        palletLabel={props.palletLabel}
        justAddedLabel={props.justAddedLabel}
        uniformNewPill={props.uniformNewPill}
        showAddedDate={props.showAddedDate}
        addedDateLabel={props.addedDateLabel}
        showPublishedDate={props.showPublishedDate}
        publishedDateLabel={props.publishedDateLabel}
        showComingDate={props.showComingDate}
        comingDateLabel={props.comingDateLabel}
        lang={props.lang}
        showAdminEdit={props.showAdminEdit}
        showNewItemListPrice={props.showNewItemListPrice}
        showNewProductBadge={props.showNewProductBadge}
        newProductBadgeChecker={props.newProductBadgeChecker}
        listPriceLabel={props.listPriceLabel}
        canOrderItem={props.canOrderItem}
        orderBlockedMessage={props.orderBlockedMessage}
        invoicePriceLabelForSku={props.invoicePriceLabelForSku}
        extraCardProps={props.extraCardProps}
        onAdjust={props.onAdjust}
        onUpdateQty={props.onUpdateQty}
        onAdminCategoryChange={props.onAdminCategoryChange}
        adminCategoryLabel={props.adminCategoryLabel}
        adminCategoryAutoLabel={props.adminCategoryAutoLabel}
      />
    </div>
  );
}

function CatalogEmbedGridBody(props: CatalogGridBodyProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const { columnCount, colGap, rowGap, rowEstimate } = useCatalogGridMetrics(
    listRef,
    props.gridKey,
    props.items.length
  );
  const rowCount = Math.max(1, Math.ceil(props.items.length / columnCount));

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => listRef.current,
    estimateSize: () => rowEstimate,
    getItemKey: (index) => catalogVirtualRowKey(props.items, index, columnCount),
    gap: rowGap,
    paddingEnd: rowGap,
    overscan: CATALOG_VIRTUAL_OVERSCAN,
    measureElement: measureVirtualRowElement,
  });

  useEffect(() => {
    listRef.current?.scrollTo({ top: 0 });
  }, [props.gridKey, columnCount]);

  useLayoutEffect(() => {
    rowVirtualizer.measure();
  }, [props.items.length, columnCount, props.gridKey, rowEstimate, rowVirtualizer]);

  if (props.items.length === 0) return null;

  return (
    <div ref={listRef} className="order-catalog-virtual-scroll is-embed" style={catalogVirtualScrollStyle}>
      <CatalogVirtualRows
        items={props.items}
        columnCount={columnCount}
        colGap={colGap}
        rowCount={rowCount}
        scrollMargin={0}
        rowVirtualizer={rowVirtualizer}
        catalogQtyMap={props.catalogQtyMap}
        inCartLabel={props.inCartLabel}
        promoBadgeLabel={props.promoBadgeLabel}
        weeklyPickSkus={props.weeklyPickSkus}
        newItemChecker={props.newItemChecker}
        newBadgeLabel={props.newBadgeLabel}
        editLabel={props.editLabel}
        palletLabel={props.palletLabel}
        justAddedLabel={props.justAddedLabel}
        uniformNewPill={props.uniformNewPill}
        showAddedDate={props.showAddedDate}
        addedDateLabel={props.addedDateLabel}
        showPublishedDate={props.showPublishedDate}
        publishedDateLabel={props.publishedDateLabel}
        showComingDate={props.showComingDate}
        comingDateLabel={props.comingDateLabel}
        lang={props.lang}
        showAdminEdit={props.showAdminEdit}
        showNewItemListPrice={props.showNewItemListPrice}
        showNewProductBadge={props.showNewProductBadge}
        newProductBadgeChecker={props.newProductBadgeChecker}
        listPriceLabel={props.listPriceLabel}
        canOrderItem={props.canOrderItem}
        orderBlockedMessage={props.orderBlockedMessage}
        invoicePriceLabelForSku={props.invoicePriceLabelForSku}
        extraCardProps={props.extraCardProps}
        onAdjust={props.onAdjust}
        onUpdateQty={props.onUpdateQty}
        onAdminCategoryChange={props.onAdminCategoryChange}
        adminCategoryLabel={props.adminCategoryLabel}
        adminCategoryAutoLabel={props.adminCategoryAutoLabel}
      />
    </div>
  );
}

function CatalogVirtualRows({
  items,
  columnCount,
  colGap,
  rowCount,
  scrollMargin,
  rowVirtualizer,
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
  extraCardProps,
  onAdjust,
  onUpdateQty,
  onAdminCategoryChange,
  adminCategoryLabel,
  adminCategoryAutoLabel,
}: CatalogGridBodyProps & {
  columnCount: number;
  colGap: number;
  rowCount: number;
  scrollMargin: number;
  rowVirtualizer: {
    getTotalSize: () => number;
    getVirtualItems: () => Array<{ key: unknown; index: number; start: number }>;
    measureElement: (node: Element | null) => void;
  };
}) {
  return (
    <div style={{ height: rowVirtualizer.getTotalSize(), position: "relative", width: "100%" }}>
      {rowVirtualizer.getVirtualItems().map((vr) => {
        const rowStart = vr.index * columnCount;
        const rowItems = items.slice(rowStart, rowStart + columnCount);
        return (
          <div
            key={String(vr.key)}
            ref={rowVirtualizer.measureElement}
            data-index={vr.index}
            className="order-catalog-virtual-row"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              transform: `translateY(${vr.start - scrollMargin}px)`,
              display: "grid",
              gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
              alignItems: "stretch",
              columnGap: colGap,
              rowGap: 0,
              boxSizing: "border-box",
              zIndex: rowCount - vr.index,
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
                  {...extraCardProps?.(sku)}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

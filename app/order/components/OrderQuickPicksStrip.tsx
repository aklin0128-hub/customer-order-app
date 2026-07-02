"use client";

import { useMemo } from "react";

import { copy } from "../orderCopy";
import type { CartItem, CatalogItem, Lang } from "../types";

export function OrderQuickPicksStrip({
  lang,
  compact = false,
  recentItems,
  frequentItems,
  catalogQtyMap,
  onAddSkuToCart,
  onAdjustQty,
}: {
  lang: Lang;
  compact?: boolean;
  recentItems: CartItem[];
  frequentItems: CatalogItem[];
  catalogQtyMap: Record<string, string>;
  onAddSkuToCart: (item: CatalogItem, qty?: string) => void;
  onAdjustQty: (sku: string, delta: number) => void;
}) {
  const t = copy[lang];

  const quickPicks = useMemo(() => {
    const seen = new Set<string>();
    const picks: Array<{ sku: string; qty: string; onClick: () => void; className: string }> = [];

    for (const item of recentItems.slice(0, compact ? 8 : 12)) {
      const sku = item.sku?.toUpperCase() || "";
      if (!sku || seen.has(sku)) continue;
      seen.add(sku);
      picks.push({
        sku,
        qty: item.qty || "1",
        onClick: () => onAddSkuToCart({ sku: item.sku } as CatalogItem, item.qty || "1"),
        className: "order-quick-recent-chip",
      });
    }

    for (const item of frequentItems) {
      const sku = item.sku?.toUpperCase() || "";
      if (!sku || seen.has(sku)) continue;
      seen.add(sku);
      const inCart = Number(catalogQtyMap[sku] || 0);
      picks.push({
        sku,
        qty: inCart > 0 ? String(inCart) : "1",
        onClick: () => onAdjustQty(item.sku, 1),
        className: "order-quick-frequent-chip",
      });
      if (picks.length >= (compact ? 14 : 18)) break;
    }

    return picks;
  }, [recentItems, frequentItems, catalogQtyMap, compact, onAddSkuToCart, onAdjustQty]);

  if (quickPicks.length === 0) return null;

  return (
    <div className="order-shop-quick-picks">
      <div className="order-quick-recent-label">{compact ? t.quickOrderPicks : t.quickOrderFrequent}</div>
      <div className="order-quick-recent-track">
        {quickPicks.map((pick) => (
          <button
            key={`${pick.className}-${pick.sku}`}
            type="button"
            className={pick.className}
            onClick={pick.onClick}
          >
            <span className="order-quick-recent-chip-sku">{pick.sku}</span>
            <span className="order-quick-recent-chip-qty">+{pick.qty}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

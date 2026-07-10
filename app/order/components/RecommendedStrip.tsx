"use client";

import { getCatalogItemBySku, isOrderableItem } from "../catalogUtils";
import { copy } from "../orderCopy";
import type { CatalogItem, Lang } from "../types";
import { ProductImage } from "./ProductImage";

export function RecommendedStrip({
  lang,
  items,
  onAddOne,
  hideTitle = false,
}: {
  lang: Lang;
  items: CatalogItem[];
  onAddOne: (sku: string) => void;
  hideTitle?: boolean;
}) {
  const t = copy[lang];
  if (items.length === 0) return null;

  return (
    <div className={`order-recommended-strip${hideTitle ? " order-recommended-strip--embedded" : ""}`}>
      {hideTitle ? null : (
        <div className="order-recommended-strip-title">{t.recommendedStripTitle}</div>
      )}
      <div className="order-recommended-strip-scroll">
        {items.map((item) => {
          const catalogItem = getCatalogItemBySku(item.sku) || item;
          const canOrder = isOrderableItem(catalogItem);
          return (
            <div key={item.sku} className="order-recommended-strip-card" style={{ opacity: canOrder ? 1 : 0.72 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center", textAlign: "center" }}>
                <ProductImage sku={item.sku} alt={item.sku} size={72} imageUrl={catalogItem.imageUrl} />
                <div style={{ minWidth: 0, width: "100%" }}>
                  <div style={{ fontSize: 13, fontWeight: 900 }}>{item.sku}</div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "#4b5563",
                      lineHeight: 1.3,
                      overflow: "hidden",
                      display: "-webkit-box",
                      WebkitBoxOrient: "vertical",
                      WebkitLineClamp: 2,
                    }}
                  >
                    {catalogItem.name || "—"}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onAddOne(item.sku)}
                disabled={!canOrder}
                style={{
                  border: "1px solid #2563eb",
                  background: canOrder ? "#2563eb" : "#9ca3af",
                  color: "#fff",
                  borderRadius: 999,
                  padding: "7px 10px",
                  cursor: canOrder ? "pointer" : "not-allowed",
                  fontSize: 11,
                  fontWeight: 900,
                  width: "100%",
                }}
              >
                {t.addOneCase}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

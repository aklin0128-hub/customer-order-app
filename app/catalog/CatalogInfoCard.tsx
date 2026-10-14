"use client";

import { ProductImage } from "@/app/order/components/ProductImage";
import { formatBrandLabel, getDisplayStatus, getStatusBadgeStyle } from "@/app/order/catalogUtils";
import { catalogCardStyle, catalogNameStyle } from "@/app/order/orderStyles";
import type { Lang } from "@/app/order/types";

import { displayCatalogStatus, type CatalogBrowseItem } from "@/lib/catalogBrowse";
import { inventoryCueKindForItem, inventoryCueLabel } from "@/lib/inventoryCue";
import { isDiscontinuedStatus } from "@/lib/orderableCatalog";

export function CatalogInfoCard({
  item,
  lang,
  sizeLabel,
  palletLabel,
  upcLabel,
  categoryLabel,
}: {
  item: CatalogBrowseItem;
  lang: Lang;
  sizeLabel: string;
  palletLabel: string;
  upcLabel: string;
  categoryLabel: string;
}) {
  const name = lang === "ko" && item.name_k ? item.name_k : item.name || "—";
  const status = displayCatalogStatus(item.status);
  const upc = item.upc || item.barcode;
  const disabled = isDiscontinuedStatus(item.status);
  const inventoryCue = inventoryCueKindForItem(item);

  return (
    <article
      className="catalog-qty-card catalog-info-card"
      style={{
        ...catalogCardStyle,
        background: disabled ? "#f3f4f6" : "#ffffff",
        border: disabled ? "2px solid #d1d5db" : "1px solid #e5e7eb",
        opacity: disabled ? 0.72 : 1,
      }}
    >
      <div className="catalog-card-image-wrap">
        <ProductImage sku={item.sku} alt={name} size={96} imageUrl={item.imageUrl} />
      </div>

      <div style={{ fontSize: 13, fontWeight: 900, color: "#111827", lineHeight: 1.2 }}>{item.sku}</div>
      <div style={{ fontSize: 12, fontWeight: 800, color: "#374151" }}>
        {item.brand ? formatBrandLabel(item.brand) : "—"}
      </div>
      <div style={catalogNameStyle}>{name}</div>

      {item.size ? (
        <div style={{ fontSize: 11, color: "#6b7280" }}>
          {sizeLabel}: {item.size}
        </div>
      ) : null}
      {upc ? (
        <div style={{ fontSize: 11, color: "#6b7280" }}>
          {upcLabel}: {upc}
        </div>
      ) : null}
      {item.category ? (
        <div style={{ fontSize: 11, color: "#6b7280" }}>
          {categoryLabel}: {item.category}
        </div>
      ) : null}
      {item.palletSize ? (
        <div style={{ fontSize: 11, color: "#6b7280" }}>
          {palletLabel}: {item.palletSize}
        </div>
      ) : null}

      {inventoryCue ? (
        <div className={`catalog-inventory-cue catalog-inventory-cue--${inventoryCue === "maybe_oos" ? "oos" : "low"}`}>
          {inventoryCueLabel(inventoryCue, lang)}
        </div>
      ) : null}

      {status ? (
        <span
          style={{
            display: "inline-block",
            marginTop: 4,
            padding: "2px 7px",
            borderRadius: 999,
            fontSize: 10,
            fontWeight: 700,
            ...getStatusBadgeStyle(item.status),
          }}
        >
          {getDisplayStatus(item.status) || status}
        </span>
      ) : null}
    </article>
  );
}

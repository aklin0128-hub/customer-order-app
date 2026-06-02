"use client";

import { formatCatalogAddedDate } from "@/lib/catalogNewItems";
import { getDisplayStatus, getStatusBadgeStyle, isJustAddedItem, isOrderableItem } from "../catalogUtils";
import type { CatalogItem, Lang } from "../types";
import {
  catalogCardStyle,
  catalogNameStyle,
  catalogStepBtnStyle,
  catalogStepInputStyle,
  catalogStepperStyle,
  inCartTagStyle,
  clearancePolicyStyle,
  promoDetailsStyle,
  promoDealStyle,
  promoPriceStyle,
  promoTagStyle,
  justAddedTagStyle,
} from "../orderStyles";
import { ProductImage } from "./ProductImage";

export function CatalogQtyCard({
  item,
  qty,
  promoNote,
  promoPrice,
  promoDetails,
  promoDealLabel,
  promoDealDetail,
  promoRemaining,
  policyNote,
  inCartLabel,
  promoBadgeLabel,
  onAdjust,
  onUpdateQty,
  bogoPackSize,
  roundUpBogoLabel,
  onRoundUpBogo,
  highlight,
  disabled,
  unavailableNote,
  showAdminEdit,
  editLabel = "Edit",
  palletLabel,
  justAddedLabel,
  /** Show catalog import date (New items tab). */
  showAddedDate,
  addedDateLabel,
  lang = "en",
  /** New-items tab: every card uses the red JUST ADDED pill (pin order still uses justAdded flag). */
  uniformNewPill,
}: {
  item: CatalogItem;
  qty: string;
  promoNote?: string;
  promoPrice?: string;
  promoDetails?: string;
  promoDealLabel?: string;
  promoDealDetail?: string;
  promoRemaining?: string;
  policyNote?: string;
  inCartLabel: string;
  promoBadgeLabel: string;
  onAdjust: (sku: string, delta: number) => void;
  onUpdateQty: (sku: string, value: string) => void;
  bogoPackSize?: number | null;
  roundUpBogoLabel?: string;
  onRoundUpBogo?: () => void;
  highlight?: boolean;
  disabled?: boolean;
  unavailableNote?: string;
  showAdminEdit?: boolean;
  editLabel?: string;
  /** e.g. "Pallet size" / "板数" — shown as `{label}: {value}` */
  palletLabel?: string;
  /** e.g. "JUST ADDED" — shown when admin sets justAdded on the SKU */
  justAddedLabel?: string;
  showAddedDate?: boolean;
  addedDateLabel?: string;
  lang?: Lang;
  uniformNewPill?: boolean;
}) {
  const showJustAdded = Boolean(justAddedLabel && (uniformNewPill || isJustAddedItem(item)));
  const addedDateText =
    showAddedDate && addedDateLabel ? formatCatalogAddedDate(item.importedAt, lang) : null;
  const hasQty = Number(qty) > 0;
  const qtyNum = Number(qty) || 0;
  const showBogoRoundUp =
    !disabled &&
    bogoPackSize &&
    bogoPackSize > 1 &&
    qtyNum > 0 &&
    qtyNum % bogoPackSize !== 0 &&
    onRoundUpBogo;

  const tierPrices = promoDealDetail?.includes(" · ")
    ? promoDealDetail.split(" · ").filter(Boolean)
    : null;

  return (
    <div
      className="catalog-qty-card"
      style={{
        ...catalogCardStyle,
        background: disabled ? "#f3f4f6" : hasQty ? "#ecfdf5" : highlight ? "#f0fdfa" : "#ffffff",
        border: disabled ? "2px solid #d1d5db" : hasQty ? "2px solid #86efac" : highlight ? "2px solid #5eead4" : "1px solid #e5e7eb",
        opacity: disabled ? 0.68 : 1,
      }}
    >
      {showAdminEdit ? (
        <a
          href={`/admin/products?sku=${encodeURIComponent(item.sku)}`}
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            zIndex: 3,
            border: "1px solid #bfdbfe",
            borderRadius: 999,
            background: "#eff6ff",
            color: "#2563eb",
            padding: "3px 8px",
            fontSize: 10,
            fontWeight: 900,
            textDecoration: "none",
          }}
        >
          {editLabel}
        </a>
      ) : null}

      {promoNote || showJustAdded || highlight || promoRemaining ? (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: showJustAdded || promoNote ? 4 : 0 }}>
          {showJustAdded ? <div style={justAddedTagStyle}>{justAddedLabel}</div> : null}
          {!showJustAdded && promoNote ? <div style={promoTagStyle}>{promoNote}</div> : null}
          {!showJustAdded && !promoNote && highlight ? <div style={promoTagStyle}>{promoBadgeLabel}</div> : null}
          {promoRemaining ? (
            <div style={{ ...promoTagStyle, background: disabled ? "#e5e7eb" : "#ffffff", color: disabled ? "#6b7280" : "#0f766e" }}>
              {promoRemaining}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="catalog-card-image-wrap" style={{ paddingTop: promoNote || showJustAdded || highlight ? 4 : 0 }}>
        <ProductImage sku={item.sku} alt={item.name || item.sku} size={96} imageUrl={item.imageUrl} />
      </div>

      <div style={{ fontSize: 13, fontWeight: 900, color: "#111827", lineHeight: 1.2 }}>{item.sku}</div>
      <div style={{ fontSize: 12, fontWeight: 800, color: "#374151" }}>{item.brand || "-"}</div>
      <div style={catalogNameStyle}>{item.name || "-"}</div>
      {item.size ? <div style={{ fontSize: 11, color: "#6b7280" }}>{item.size}</div> : null}
      {item.palletSize && palletLabel ? (
        <div style={{ fontSize: 11, color: "#6b7280", marginTop: item.size ? 2 : 0 }}>
          {palletLabel}: {item.palletSize}
        </div>
      ) : null}
      {addedDateText ? (
        <div className="catalog-added-date">
          {addedDateLabel}: {addedDateText}
        </div>
      ) : null}
      {!isOrderableItem(item) && getDisplayStatus(item.status) ? (
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
          {getDisplayStatus(item.status)}
        </span>
      ) : null}
      {unavailableNote ? (
        <div
          style={{
            marginTop: 4,
            fontSize: 11,
            fontWeight: 800,
            color: "#b91c1c",
            lineHeight: 1.35,
          }}
        >
          {unavailableNote}
        </div>
      ) : null}
      {promoDealLabel ? (
        <div style={promoDealStyle}>
          <div>{promoDealLabel}</div>
          {tierPrices ? (
            <div className="catalog-promo-deal-tiers">
              {tierPrices.map((tier) => (
                <div key={tier} className="catalog-promo-deal-tier">
                  {tier}
                </div>
              ))}
            </div>
          ) : promoDealDetail ? (
            <div style={{ fontSize: 12, fontWeight: 800, marginTop: 4, lineHeight: 1.35 }}>{promoDealDetail}</div>
          ) : null}
        </div>
      ) : null}
      {promoPrice ? <div style={promoPriceStyle}>{promoPrice}</div> : null}
      {promoDetails ? <div style={promoDetailsStyle}>{promoDetails}</div> : null}
      {policyNote ? <div style={clearancePolicyStyle}>{policyNote}</div> : null}
      {hasQty ? <div style={inCartTagStyle}>{inCartLabel}: {qty}</div> : null}

      <div className="catalog-qty-card-stepper">
        <div style={catalogStepperStyle}>
          <button type="button" onClick={() => onAdjust(item.sku, -1)} disabled={disabled} style={catalogStepBtnStyle}>
            −
          </button>
          <input
            value={qty}
            onChange={(e) => onUpdateQty(item.sku, e.target.value)}
            placeholder="0"
            inputMode="numeric"
            disabled={disabled}
            style={{ ...catalogStepInputStyle, opacity: disabled ? 0.5 : 1 }}
          />
          <button type="button" onClick={() => onAdjust(item.sku, 1)} disabled={disabled} style={catalogStepBtnStyle}>
            +
          </button>
        </div>
        {showBogoRoundUp ? (
          <button
            type="button"
            onClick={onRoundUpBogo}
            style={{
              marginTop: 6,
              width: "100%",
              border: "1px solid #fbbf24",
              background: "#fffbeb",
              color: "#92400e",
              borderRadius: 999,
              padding: "8px 10px",
              fontSize: 11,
              fontWeight: 800,
              cursor: "pointer",
              minHeight: 36,
            }}
          >
            {roundUpBogoLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}

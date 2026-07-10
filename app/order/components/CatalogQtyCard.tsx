"use client";

import Link from "next/link";
import { formatCatalogAddedDateForItem, formatNewItemComingDate, formatNewItemPublishedDate } from "@/lib/catalogNewItems";
import { formatNewItemListPriceDisplay } from "@/lib/newItemListPrice";
import { ComingSoonStamp } from "@/app/components/ComingSoonStamp";
import { NewProductBadge } from "@/app/components/NewProductBadge";
import { OutOfStockStamp } from "@/app/components/OutOfStockStamp";
import {
  isComingSoonNewItem,
} from "@/lib/comingSoonBadge";
import { isProductOrderingBlocked, isProductOutOfStockStamp } from "@/lib/productAvailability";
import { resolveNewItemStorageLabel } from "@/lib/newItemStorageLabel";
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
  promoDealStyle,
  promoPriceStyle,
  newItemListPriceBlockStyle,
  newItemListPriceLabelStyle,
  newItemListPriceValueStyle,
  promoTagStyle,
  justAddedTagStyle,
} from "../orderStyles";
import { ProductImage } from "./ProductImage";

export function CatalogQtyCard({
  item,
  qty,
  promoNote,
  promoPrice,
  invoicePrice,
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
  showPublishedDate,
  publishedDateLabel,
  showComingDate,
  comingDateLabel,
  lang = "en",
  /** New-items tab: every card uses the red JUST ADDED pill (pin order still uses justAdded flag). */
  uniformNewPill,
  /** New-items tab: show admin list price when set. */
  showNewItemListPrice,
  /** New-items tab: blue Costco-style New badge below image. */
  showNewProductBadge,
  listPriceLabel,
}: {
  item: CatalogItem;
  qty: string;
  promoNote?: string;
  promoPrice?: string;
  /** Per-customer latest invoice unit price (when admin enables invoice pricing). */
  invoicePrice?: string;
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
  showPublishedDate?: boolean;
  publishedDateLabel?: string;
  showComingDate?: boolean;
  comingDateLabel?: string;
  lang?: Lang;
  uniformNewPill?: boolean;
  showNewItemListPrice?: boolean;
  showNewProductBadge?: boolean;
  listPriceLabel?: string;
}) {
  const addedDateText =
    showAddedDate && addedDateLabel ? formatCatalogAddedDateForItem(item, lang) : null;
  const publishedDateText =
    showPublishedDate && publishedDateLabel && item.newPublishedDate
      ? formatNewItemPublishedDate(item.newPublishedDate, lang)
      : null;
  const comingDateText =
    showComingDate && comingDateLabel && item.newItemComingDate
      ? formatNewItemComingDate(item.newItemComingDate, lang)
      : null;
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
  const listPriceText =
    showNewItemListPrice && item.newItemListPrice
      ? formatNewItemListPriceDisplay(item.newItemListPrice)
      : "";
  const alignedPriceLayout = Boolean(showNewItemListPrice);
  const comingSoon = alignedPriceLayout && isComingSoonNewItem(item);
  const outOfStock = isProductOutOfStockStamp(item);
  const stamped = comingSoon || outOfStock;
  const orderingBlocked = isProductOrderingBlocked(item);
  const showNewItemExtras = Boolean(showNewProductBadge || showNewItemListPrice);
  const storageLabel = showNewItemExtras ? resolveNewItemStorageLabel(item) : undefined;
  const showJustAdded = Boolean(justAddedLabel && !showNewProductBadge && (uniformNewPill || isJustAddedItem(item)));
  const showPinnedJustAdded = Boolean(justAddedLabel && showNewProductBadge && isJustAddedItem(item));

  const badgeRow =
    promoNote || showPinnedJustAdded || showJustAdded || storageLabel || highlight || promoRemaining ? (
      <>
        {showPinnedJustAdded || showJustAdded ? (
          <div style={justAddedTagStyle}>{justAddedLabel}</div>
        ) : null}
        {storageLabel ? (
          <div className={`catalog-item-storage catalog-item-storage--${storageLabel.toLowerCase()}`}>
            {storageLabel}
          </div>
        ) : null}
        {!showJustAdded && !showPinnedJustAdded && promoNote ? <div style={promoTagStyle}>{promoNote}</div> : null}
        {!showJustAdded && !showPinnedJustAdded && !promoNote && highlight ? (
          <div style={promoTagStyle}>{promoBadgeLabel}</div>
        ) : null}
        {promoRemaining ? (
          <div style={{ ...promoTagStyle, background: disabled ? "#e5e7eb" : "#ffffff", color: disabled ? "#6b7280" : "#0f766e" }}>
            {promoRemaining}
          </div>
        ) : null}
      </>
    ) : null;

  const listPriceBlock = listPriceText ? (
    alignedPriceLayout ? (
      <div className="catalog-qty-card-price-block new-product-list-price">{listPriceText}</div>
    ) : (
      <div style={newItemListPriceBlockStyle}>
        {listPriceLabel ? <div style={newItemListPriceLabelStyle}>{listPriceLabel}</div> : null}
        <div style={newItemListPriceValueStyle}>{listPriceText}</div>
      </div>
    )
  ) : null;

  const topBadgeCount = alignedPriceLayout
    ? [showPinnedJustAdded || showJustAdded, storageLabel, !showJustAdded && !showPinnedJustAdded && promoNote, promoRemaining].filter(Boolean).length
    : 0;
  const promoLayout = Boolean(highlight && !alignedPriceLayout);

  const productInfo = (
    <div className="catalog-qty-card-meta">
      <div className="catalog-qty-card-sku">{item.sku}</div>
      <div className="catalog-qty-card-brand">{item.brand || "-"}</div>
      <div className="catalog-qty-card-name" style={catalogNameStyle}>
        {item.name || "-"}
      </div>
      {item.size ? <div className="catalog-qty-card-size">{item.size}</div> : null}
      {item.palletSize && palletLabel ? (
        <div className="catalog-qty-card-pallet">
          {palletLabel}: {item.palletSize}
        </div>
      ) : null}
      {comingDateText ? (
        <div className="catalog-coming-date">
          {comingDateLabel}: {comingDateText}
        </div>
      ) : null}
      {publishedDateText ? (
        <div className="catalog-published-date">
          {publishedDateLabel}: {publishedDateText}
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
    </div>
  );

  const promoFooter = (
    <>
      {promoDealLabel ? (
        <div className="catalog-qty-card-promo-deal" style={promoDealStyle}>
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
            <div className="catalog-qty-card-promo-deal-detail">{promoDealDetail}</div>
          ) : null}
        </div>
      ) : null}
      {promoPrice ? <div style={promoPriceStyle}>{promoPrice}</div> : null}
      {!promoPrice && invoicePrice ? <div style={promoPriceStyle}>{invoicePrice}</div> : null}
      {promoPrice && invoicePrice ? (
        <div style={{ ...promoPriceStyle, color: "#1d4ed8", marginTop: promoPrice ? 2 : 0 }}>{invoicePrice}</div>
      ) : null}
      {promoDetails ? <div className="catalog-qty-card-promo-details">{promoDetails}</div> : null}
      {policyNote ? <div style={clearancePolicyStyle}>{policyNote}</div> : null}
      {hasQty ? <div style={inCartTagStyle}>{inCartLabel}: {qty}</div> : null}
    </>
  );

  return (
    <div
      className={`catalog-qty-card${alignedPriceLayout ? " catalog-qty-card--price-aligned" : ""}${alignedPriceLayout ? ` catalog-qty-card--top-badges-${topBadgeCount}` : ""}${promoLayout ? " catalog-qty-card--promo-layout" : ""}${stamped ? " catalog-qty-card--out-of-stock" : ""}${comingSoon && outOfStock ? " catalog-qty-card--dual-stamped" : ""}`}
      style={{
        ...catalogCardStyle,
        background: disabled ? "#f3f4f6" : hasQty ? "#ecfdf5" : highlight ? "#f0fdfa" : "#ffffff",
        border: disabled ? "2px solid #d1d5db" : hasQty ? "2px solid #86efac" : highlight ? "2px solid #5eead4" : "1px solid #e5e7eb",
        opacity: disabled ? 0.68 : 1,
      }}
    >
      {showAdminEdit ? (
        <Link
          href={`/admin/products?sku=${encodeURIComponent(item.sku)}`}
          className="catalog-qty-card-edit"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {editLabel}
        </Link>
      ) : null}

      {alignedPriceLayout && badgeRow ? (
        <div className="catalog-qty-card-badge-slot">{badgeRow}</div>
      ) : badgeRow ? (
        <div className="catalog-qty-card-top-badges">{badgeRow}</div>
      ) : null}

      <div
        className={`catalog-card-image-wrap${alignedPriceLayout ? " catalog-card-image-wrap--fixed" : ""}${stamped ? " catalog-card-image-wrap--stamped" : ""}${comingSoon && outOfStock ? " catalog-card-image-wrap--dual-stamped" : ""}`}
        style={{ paddingTop: alignedPriceLayout ? 0 : badgeRow ? 2 : 0 }}
      >
        <ProductImage sku={item.sku} alt={item.name || item.sku} size={96} imageUrl={item.imageUrl} />
        {comingSoon ? <ComingSoonStamp lang={lang} /> : null}
        {outOfStock ? <OutOfStockStamp /> : null}
      </div>

      {showNewProductBadge ? (
        <div className="new-product-badge-slot">
          <NewProductBadge lang={lang} />
        </div>
      ) : null}

      {alignedPriceLayout && listPriceBlock ? (
        <div className="catalog-qty-card-price-slot">{listPriceBlock}</div>
      ) : (
        listPriceBlock
      )}

      {promoLayout ? (
        <div className="catalog-qty-card-fill">
          {productInfo}
          <div className="catalog-qty-card-promo-footer">{promoFooter}</div>
        </div>
      ) : (
        <>
          {productInfo}
          {promoFooter}
        </>
      )}

      <div className="catalog-qty-card-stepper">
        <div style={catalogStepperStyle}>
          <button type="button" onClick={() => onAdjust(item.sku, -1)} disabled={disabled || orderingBlocked} style={catalogStepBtnStyle}>
            −
          </button>
          <input
            value={qty}
            onChange={(e) => onUpdateQty(item.sku, e.target.value)}
            placeholder="0"
            inputMode="numeric"
            disabled={disabled || orderingBlocked}
            style={{ ...catalogStepInputStyle, opacity: disabled || orderingBlocked ? 0.5 : 1 }}
          />
          <button type="button" onClick={() => onAdjust(item.sku, 1)} disabled={disabled || orderingBlocked} style={catalogStepBtnStyle}>
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

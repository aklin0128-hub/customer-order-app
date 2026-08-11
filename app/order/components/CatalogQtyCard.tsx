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
import { resolveCatalogUpc } from "@/lib/catalogUpc";
import { ProductImage } from "./ProductImage";
import { UpcBarcode } from "./UpcBarcode";

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
  favorite,
  favoriteLabel,
  onToggleFavorite,
  lastOrderedLabel,
  onOpenHistory,
  showUpc,
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
  favorite?: boolean;
  favoriteLabel?: string;
  onToggleFavorite?: (sku: string) => void;
  /** e.g. "Last: Aug 10 · 3 cs" — tappable history entry point. */
  lastOrderedLabel?: string;
  onOpenHistory?: (sku: string) => void;
  /** When true, render UPC/barcode under product info if available. */
  showUpc?: boolean;
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
  const upcDigits = showUpc ? resolveCatalogUpc(item) : "";

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
      <div className="catalog-qty-card-sku-row">
        <div className="catalog-qty-card-sku">{item.sku}</div>
        <div className="catalog-qty-card-sku-actions">
          {onToggleFavorite ? (
            <button
              type="button"
              className={`catalog-qty-card-favorite${favorite ? " is-on" : ""}`}
              aria-label={favoriteLabel || (favorite ? "Remove favorite" : "Add favorite")}
              aria-pressed={Boolean(favorite)}
              title={favoriteLabel || (favorite ? "Remove favorite" : "Add favorite")}
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(item.sku);
              }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <svg
                className="catalog-qty-card-favorite-icon"
                viewBox="0 0 24 24"
                width="16"
                height="16"
                aria-hidden="true"
                focusable="false"
              >
                {favorite ? (
                  <path
                    fill="currentColor"
                    d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"
                  />
                ) : (
                  <path
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinejoin="round"
                    d="m12 3.2 2.35 5.4 5.85.55-4.4 3.85 1.3 5.7L12 15.9l-5.1 3.8 1.3-5.7-4.4-3.85 5.85-.55L12 3.2z"
                  />
                )}
              </svg>
            </button>
          ) : null}
          {showAdminEdit ? (
            <Link
              href={`/admin/products?sku=${encodeURIComponent(item.sku)}`}
              className="catalog-qty-card-edit"
              prefetch={false}
              aria-label={editLabel}
              title={editLabel}
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <svg
                className="catalog-qty-card-edit-icon"
                viewBox="0 0 24 24"
                width="15"
                height="15"
                aria-hidden="true"
                focusable="false"
              >
                <path
                  fill="currentColor"
                  d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zm2.92 2.33H5v-.92l9.06-9.06.92.92L5.92 19.58zM20.71 7.04a1.003 1.003 0 0 0 0-1.42l-2.34-2.34a1.003 1.003 0 0 0-1.42 0l-1.83 1.83 3.75 3.75 1.84-1.82z"
                />
              </svg>
            </Link>
          ) : null}
        </div>
      </div>
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
      {lastOrderedLabel && onOpenHistory ? (
        <button
          type="button"
          className="catalog-qty-card-last-ordered"
          onClick={(e) => {
            e.stopPropagation();
            onOpenHistory(item.sku);
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <span className="catalog-qty-card-last-ordered-text">{lastOrderedLabel}</span>
          <span className="catalog-qty-card-last-ordered-chevron" aria-hidden="true">
            ›
          </span>
        </button>
      ) : null}
      {upcDigits ? <UpcBarcode value={upcDigits} /> : null}
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
      {alignedPriceLayout && badgeRow ? (
        <div className="catalog-qty-card-badge-slot">{badgeRow}</div>
      ) : badgeRow ? (
        <div className="catalog-qty-card-top-badges">{badgeRow}</div>
      ) : null}

      <div
        className={`catalog-card-image-wrap${alignedPriceLayout ? " catalog-card-image-wrap--fixed" : ""}${stamped ? " catalog-card-image-wrap--stamped" : ""}${comingSoon && outOfStock ? " catalog-card-image-wrap--dual-stamped" : ""}`}
        style={{ paddingTop: alignedPriceLayout ? 4 : badgeRow ? 2 : 0 }}
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

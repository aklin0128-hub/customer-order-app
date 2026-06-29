"use client";

import { useMemo, useState } from "react";

import { ShowcaseDescriptionModal } from "@/app/components/ShowcaseDescriptionModal";
import { ComingSoonStamp } from "@/app/components/ComingSoonStamp";
import { NewProductBadge } from "@/app/components/NewProductBadge";
import { ProductImage } from "@/app/order/components/ProductImage";
import { getJustAddedLabel, justAddedBadgeStyle } from "@/lib/justAddedBadge";
import { isComingSoonNewItem } from "@/lib/comingSoonBadge";
import { formatNewItemPublishedDate } from "@/lib/catalogNewItems";
import { formatNewItemListPriceDisplay } from "@/lib/newItemListPrice";
import { formatShowcasePromoDisplay, type Lang } from "@/lib/showcasePromoFormat";
import type { LoginPreviewCard } from "@/lib/loginPreview";

const detailsLabel: Record<Lang, string> = {
  en: "Details",
  zh: "查看说明",
  ko: "상세보기",
  vi: "Chi tiết",
};

const publishedDateLabel: Record<Lang, string> = {
  en: "Published",
  zh: "上架",
  ko: "게시",
  vi: "Đăng",
};

export function ShowcaseCard({
  item,
  lang,
  showPromo,
  className = "showcase-card",
  showNewDetails,
  imageSize,
}: {
  item: LoginPreviewCard;
  lang: Lang;
  showPromo: boolean;
  className?: string;
  /** New-items tab: show Details when description or PDF exists */
  showNewDetails?: boolean;
  imageSize?: number;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);

  const isNewCard = className.includes("new-card");
  const resolvedImageSize = imageSize ?? (isNewCard ? 96 : 80);

  const promoDisplay = useMemo(
    () => (showPromo ? formatShowcasePromoDisplay(item, lang) : null),
    [showPromo, item, lang]
  );

  const justAddedBadge = item.justAdded ? getJustAddedLabel(lang) : null;
  const hasNewDetails =
    showNewDetails &&
    Boolean(String(item.newItemDescription || "").trim() || String(item.newItemDescriptionPdfUrl || "").trim());
  const storageLabel = showNewDetails ? item.newItemStorageLabel : undefined;
  const publishedDateText =
    showNewDetails && item.newPublishedDate
      ? formatNewItemPublishedDate(item.newPublishedDate, lang)
      : null;
  const listPriceText =
    showNewDetails && item.newItemListPrice
      ? formatNewItemListPriceDisplay(item.newItemListPrice)
      : null;
  const comingSoon = showNewDetails && isComingSoonNewItem(item);
  const topBadgeCount = (justAddedBadge ? 1 : 0) + (storageLabel ? 1 : 0);

  return (
    <article className={`${className}${topBadgeCount ? ` new-card--top-badges-${topBadgeCount}` : ""}`}>
      {justAddedBadge || storageLabel ? (
        <div className="showcase-card-badge-row">
          {justAddedBadge ? <div style={justAddedBadgeStyle}>{justAddedBadge}</div> : null}
          {storageLabel ? (
            <div
              className={`showcase-card-storage showcase-card-storage--${storageLabel.toLowerCase()}`}
            >
              {storageLabel}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="showcase-card-body">
        <div className={`showcase-card-img-wrap${comingSoon ? " showcase-card-img-wrap--stamped" : ""}`}>
          <ProductImage
            sku={item.sku}
            alt={item.name || item.sku}
            size={resolvedImageSize}
            imageUrl={item.imageUrl}
          />
          {comingSoon ? <ComingSoonStamp lang={lang} /> : null}
        </div>

        {showNewDetails ? (
          <div className="showcase-card-new-badge-slot">
            <NewProductBadge lang={lang} />
          </div>
        ) : null}

        {listPriceText ? (
          <div className="new-product-list-price" aria-label="Price">
            {listPriceText}
          </div>
        ) : null}

        <div className="showcase-card-meta">
          <div className="showcase-card-sku">{item.sku}</div>
          {item.brand ? <div className="showcase-card-brand">{item.brand}</div> : null}
          <div className="showcase-card-name" title={item.name || undefined}>
            {item.name || "—"}
          </div>
          {item.size ? <div className="showcase-card-size">{item.size}</div> : null}
          {publishedDateText ? (
            <div className="showcase-card-published">
              {publishedDateLabel[lang]}: {publishedDateText}
            </div>
          ) : null}
          {promoDisplay?.tierPricesLine ? (
            <div className="showcase-card-promo-deal">
              {promoDisplay.priceLine ? (
                <div className="showcase-card-promo-deal-label">{promoDisplay.priceLine}</div>
              ) : null}
              <div className="showcase-card-promo-deal-tiers">
                {promoDisplay.tierPricesLine.split(" · ").map((tier) => (
                  <div key={tier} className="showcase-card-promo-deal-tier">
                    {tier}
                  </div>
                ))}
              </div>
            </div>
          ) : promoDisplay?.priceLine ? (
            <div className="showcase-card-price">{promoDisplay.priceLine}</div>
          ) : null}
          {promoDisplay?.details.map((line, index) => (
            <div key={`${index}-${line}`} className="showcase-card-detail">
              {line}
            </div>
          ))}
        </div>

        {hasNewDetails ? (
          <button
            type="button"
            className="showcase-card-details-btn"
            onClick={() => setDetailsOpen(true)}
            aria-haspopup="dialog"
          >
            {detailsLabel[lang]}
          </button>
        ) : null}
      </div>

      {detailsOpen ? (
        <ShowcaseDescriptionModal item={item} lang={lang} onClose={() => setDetailsOpen(false)} />
      ) : null}
    </article>
  );
}

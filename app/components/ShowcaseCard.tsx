"use client";

import { useMemo, useState } from "react";

import { ShowcaseDescriptionModal } from "@/app/components/ShowcaseDescriptionModal";
import { getJustAddedLabel, justAddedBadgeStyle } from "@/lib/justAddedBadge";
import { formatShowcasePromoDisplay, type Lang } from "@/lib/showcasePromoFormat";
import type { LoginPreviewCard } from "@/lib/loginPreview";

const detailsLabel: Record<Lang, string> = {
  en: "Details",
  zh: "查看说明",
  ko: "상세보기",
  vi: "Chi tiết",
};

export function ShowcaseCard({
  item,
  lang,
  showPromo,
  className = "showcase-card",
  showNewDetails,
}: {
  item: LoginPreviewCard;
  lang: Lang;
  showPromo: boolean;
  className?: string;
  /** New-items tab: show Details when description or PDF exists */
  showNewDetails?: boolean;
}) {
  const [imgError, setImgError] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const promoDisplay = useMemo(
    () => (showPromo ? formatShowcasePromoDisplay(item, lang) : null),
    [showPromo, item, lang]
  );

  const justAddedBadge = item.justAdded ? getJustAddedLabel(lang) : null;
  const hasNewDetails =
    showNewDetails &&
    Boolean(String(item.newItemDescription || "").trim() || String(item.newItemDescriptionPdfUrl || "").trim());
  const storageLabel = showNewDetails ? item.newItemStorageLabel : undefined;

  return (
    <article className={className}>
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
        <div className="showcase-card-img-wrap">
          {imgError ? (
            <div className="showcase-card-img-fallback">SKU</div>
          ) : (
            <img
              src={item.imageUrl || `/product/${item.sku}.jpg`}
              alt={item.name || item.sku}
              loading="lazy"
              decoding="async"
              onError={() => setImgError(true)}
            />
          )}
        </div>

        <div className="showcase-card-meta">
          <div className="showcase-card-sku">{item.sku}</div>
          {item.brand ? <div className="showcase-card-brand">{item.brand}</div> : null}
          <div className="showcase-card-name" title={item.name || undefined}>
            {item.name || "—"}
          </div>
          {item.size ? <div className="showcase-card-size">{item.size}</div> : null}
          {promoDisplay?.priceLine ? (
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

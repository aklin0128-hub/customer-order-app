"use client";

import { useMemo, useState } from "react";

import { formatShowcasePromoDisplay, type Lang } from "@/lib/showcasePromoFormat";
import type { LoginPreviewCard } from "@/lib/loginPreview";

export function ShowcaseCard({
  item,
  lang,
  showPromo,
  className = "showcase-card",
  badge,
}: {
  item: LoginPreviewCard;
  lang: Lang;
  showPromo: boolean;
  className?: string;
  badge?: string | null;
}) {
  const [imgError, setImgError] = useState(false);

  const promoDisplay = useMemo(
    () => (showPromo ? formatShowcasePromoDisplay(item, lang) : null),
    [showPromo, item, lang]
  );

  const justAddedBadge =
    badge ||
    (item.justAdded ? (lang === "zh" ? "刚刚上架" : lang === "ko" ? "방금 등록" : lang === "vi" ? "MỚI THÊM" : "JUST ADDED") : null);

  return (
    <article className={className}>
      {justAddedBadge ? (
        <div className="showcase-card-badge showcase-card-badge--just-added">{justAddedBadge}</div>
      ) : null}
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
      <div className="showcase-card-sku">{item.sku}</div>
      {item.brand ? <div className="showcase-card-brand">{item.brand}</div> : null}
      <div className="showcase-card-name">{item.name || "—"}</div>
      {item.size ? <div className="showcase-card-size">{item.size}</div> : null}
      {promoDisplay?.priceLine ? (
        <div className="showcase-card-price">{promoDisplay.priceLine}</div>
      ) : null}
      {promoDisplay?.details.map((line, index) => (
        <div key={`${index}-${line}`} className="showcase-card-detail">
          {line}
        </div>
      ))}
      {badge && !item.justAdded ? <div className="showcase-card-badge">{badge}</div> : null}
    </article>
  );
}

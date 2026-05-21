"use client";

import { useState } from "react";

import { formatMoneyPrice } from "@/lib/promoFormat";
import type { LoginPreviewCard } from "@/lib/loginPreview";

type Lang = "en" | "zh" | "ko" | "vi";

const promoPriceLabel: Record<Lang, string> = {
  en: "Promo",
  zh: "特价",
  ko: "행사가",
  vi: "Khuyến mãi",
};

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

  return (
    <article className={className}>
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
      {showPromo && item.promoPrice ? (
        <div className="showcase-card-price">
          {promoPriceLabel[lang]}: {formatMoneyPrice(item.promoPrice)}
        </div>
      ) : null}
      {showPromo && item.promoNote ? (
        <div className="showcase-card-note">{item.promoNote}</div>
      ) : null}
      {badge ? <div className="showcase-card-badge">{badge}</div> : null}
    </article>
  );
}

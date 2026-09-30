"use client";

import type { Lang } from "@/app/order/types";
import type { CatalogBrowseItem } from "@/lib/catalogBrowse";

import { CatalogInfoCard } from "./CatalogInfoCard";

export function CatalogBrowseGrid({
  items,
  lang,
  sizeLabel,
  palletLabel,
  upcLabel,
  categoryLabel,
}: {
  items: CatalogBrowseItem[];
  lang: Lang;
  sizeLabel: string;
  palletLabel: string;
  upcLabel: string;
  categoryLabel: string;
}) {
  if (items.length === 0) return null;

  return (
    <div className="catalog-grid-scroll">
      <div className="catalog-css-grid">
        {items.map((item) => (
          <CatalogInfoCard
            key={item.sku}
            item={item}
            lang={lang}
            sizeLabel={sizeLabel}
            palletLabel={palletLabel}
            upcLabel={upcLabel}
            categoryLabel={categoryLabel}
          />
        ))}
      </div>
    </div>
  );
}

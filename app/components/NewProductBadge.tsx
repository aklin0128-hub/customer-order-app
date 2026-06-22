import { getNewProductBadgeLabel, type NewProductBadgeLang } from "@/lib/newProductBadge";

export function NewProductBadge({ lang = "en" }: { lang?: NewProductBadgeLang }) {
  const label = getNewProductBadgeLabel(lang);
  return (
    <span className="new-product-badge" aria-label={label}>
      {label}
    </span>
  );
}

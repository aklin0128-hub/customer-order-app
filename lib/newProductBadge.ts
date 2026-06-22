import type { CSSProperties } from "react";

export type NewProductBadgeLang = "en" | "zh" | "ko" | "vi";

const LABELS: Record<NewProductBadgeLang, string> = {
  en: "New",
  zh: "新品",
  ko: "신상품",
  vi: "Mới",
};

export function getNewProductBadgeLabel(lang: NewProductBadgeLang) {
  return LABELS[lang];
}

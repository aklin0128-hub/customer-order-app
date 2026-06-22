import type { CSSProperties } from "react";

export type JustAddedLang = "en" | "zh" | "ko" | "vi";

const LABELS: Record<JustAddedLang, string> = {
  en: "JUST ADDED",
  zh: "刚刚上架",
  ko: "방금 등록",
  vi: "MỚI THÊM",
};

export function getJustAddedLabel(lang: JustAddedLang) {
  return LABELS[lang];
}

/** Same pill as order page CatalogQtyCard (justAddedTagStyle). */
export const justAddedBadgeStyle: CSSProperties = {
  alignSelf: "flex-start",
  padding: "4px 10px",
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 950,
  letterSpacing: "0.06em",
  background: "#dc2626",
  color: "#ffffff",
  border: "1px solid #b91c1c",
};

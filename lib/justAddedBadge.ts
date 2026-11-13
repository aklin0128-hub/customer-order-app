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
  padding: "2px 6px",
  borderRadius: 999,
  fontSize: 9,
  fontWeight: 850,
  letterSpacing: "0.04em",
  lineHeight: 1.15,
  background: "#dc2626",
  color: "#ffffff",
  border: "1px solid #b91c1c",
  flexShrink: 0,
  maxWidth: "100%",
  whiteSpace: "nowrap",
};

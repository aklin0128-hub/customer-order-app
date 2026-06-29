export type ComingSoonBadgeLang = "en" | "zh" | "ko" | "vi";

const LABELS: Record<ComingSoonBadgeLang, string> = {
  en: "Coming Soon",
  zh: "即将上市",
  ko: "출시 예정",
  vi: "Sắp có",
};

export function getComingSoonBadgeLabel(lang: ComingSoonBadgeLang) {
  return LABELS[lang];
}

export function isComingSoonNewItem(item?: { isNew?: boolean; newItemOutOfStock?: boolean } | null) {
  return Boolean(item?.isNew && item?.newItemOutOfStock);
}

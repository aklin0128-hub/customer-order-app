/** /new/ showcase list price — display only, not used in order totals. */

export function normalizeNewItemListPrice(value: unknown): string | undefined {
  const trimmed = String(value || "").trim();
  return trimmed || undefined;
}

export function formatNewItemListPriceDisplay(price?: string) {
  const trimmed = String(price || "").trim();
  if (!trimmed) return "";
  return trimmed.startsWith("$") ? trimmed : `$${trimmed}`;
}

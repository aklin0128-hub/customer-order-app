/** /new/ showcase list price — display only, not used in order totals. */

export function normalizeNewItemListPrice(value: unknown): string | undefined {
  const trimmed = String(value || "").trim();
  return trimmed || undefined;
}

function parseListPriceNumber(price: string) {
  const cleaned = price.replace(/^\$/, "").replace(/,/g, "").trim();
  if (!cleaned) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

export function formatNewItemListPriceDisplay(price?: string) {
  const trimmed = String(price || "").trim();
  if (!trimmed) return "";

  const amount = parseListPriceNumber(trimmed);
  if (amount === null) return trimmed.startsWith("$") ? trimmed : `$${trimmed}`;

  return `$${amount.toFixed(2)}`;
}

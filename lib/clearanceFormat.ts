/** Client-safe clearance display helpers (no Redis / catalog imports). */

export function formatClearancePriceDisplay(price: string) {
  const trimmed = String(price || "").trim();
  if (!trimmed) return "";
  const num = Number(trimmed.replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(num)) return trimmed.startsWith("$") ? trimmed : `$${trimmed}`;
  return `$${(Math.round(num * 100) / 100).toFixed(2)}`;
}

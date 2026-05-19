/** Client-safe clearance display helpers (no Redis / catalog imports). */

export function formatClearancePriceDisplay(price: string) {
  const trimmed = String(price || "").trim();
  if (!trimmed) return "";
  return trimmed.startsWith("$") ? trimmed : `$${trimmed}`;
}

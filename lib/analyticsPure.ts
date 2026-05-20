export function cleanSku(value: unknown) {
  return String(value || "").trim().toUpperCase();
}

export function parseQty(value: unknown) {
  const num = Number(String(value ?? "").replace(/[^0-9]/g, ""));
  return Number.isFinite(num) && num > 0 ? num : 0;
}

export function growthPct(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? null : null;
  return ((current - previous) / previous) * 100;
}

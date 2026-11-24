function parseDateOnly(value?: unknown): string | undefined {
  const text = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return undefined;
  const date = new Date(`${text}T12:00:00`);
  return Number.isNaN(date.getTime()) ? undefined : text;
}

export function parseSeasonalEtaDate(value?: unknown): string | undefined {
  return parseDateOnly(value);
}

/** Local calendar YYYY-MM-DD for ETA comparisons. */
export function formatLocalDateYmd(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * True when Seasonal ETA is set and today is still before that date.
 * On/after the ETA day the SKU becomes orderable again.
 */
export function isSeasonalEtaPending(etaDate?: string | null, now = new Date()): boolean {
  const eta = parseDateOnly(etaDate);
  if (!eta) return false;
  return formatLocalDateYmd(now) < eta;
}

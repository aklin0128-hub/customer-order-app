export const DEFAULT_ORDER_EMAIL = "elin@rheebros.com";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidOrderEmail(email: string) {
  const trimmed = String(email || "").trim().toLowerCase();
  return Boolean(trimmed && EMAIL_RE.test(trimmed));
}

export function normalizeOrderEmailInput(email: string) {
  return String(email || "").trim().toLowerCase();
}

/** Stored email may be empty; UI and sending always use the default when unset. */
export function resolveCustomerOrderEmail(storedEmail?: string) {
  const trimmed = normalizeOrderEmailInput(storedEmail || "");
  if (trimmed && isValidOrderEmail(trimmed)) return trimmed;
  return DEFAULT_ORDER_EMAIL;
}

/** Persist only when different from the company default inbox. */
export function emailForCustomerStorage(email: string) {
  const normalized = normalizeOrderEmailInput(email);
  if (!normalized || normalized === DEFAULT_ORDER_EMAIL) return undefined;
  if (!isValidOrderEmail(normalized)) {
    throw new Error("Invalid email address.");
  }
  return normalized;
}

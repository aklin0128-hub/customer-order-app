export const DEFAULT_ORDER_EMAIL = "elin@rheebros.com";

/** Inboxes staff can assign per store in Admin → Customers. Add addresses here as needed. */
export const ORDER_RECIPIENT_EMAILS: readonly string[] = [
  DEFAULT_ORDER_EMAIL,
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function getOrderRecipientEmails(): string[] {
  const fromEnv = String(process.env.ORDER_RECIPIENT_EMAILS || "")
    .split(",")
    .map((s) => normalizeOrderEmailInput(s))
    .filter(Boolean);
  return [...new Set([...ORDER_RECIPIENT_EMAILS, ...fromEnv])];
}

export function getOrderEmailSelectOptions() {
  return getOrderRecipientEmails().map((value) => ({
    value,
    label: value === DEFAULT_ORDER_EMAIL ? `${value} (default)` : value,
  }));
}

export function isAllowedOrderRecipientEmail(email: string) {
  const normalized = normalizeOrderEmailInput(email);
  if (!normalized) return true;
  return getOrderRecipientEmails().includes(normalized);
}

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
  if (!isAllowedOrderRecipientEmail(normalized)) {
    throw new Error("Email is not an allowed order recipient.");
  }
  return normalized;
}

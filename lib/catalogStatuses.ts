/** Status values used in admin Products editor (includes catalog master + admin-only). */
export const ADMIN_PRODUCT_STATUS_OPTIONS = [
  "NORMAL",
  "NORMAL_NBR",
  "NORMAL_NOBR",
  "READYTOORDER",
  "TBD",
  "NEW",
  "LIMITED",
  "SEASONAL",
  "LOCAL_BLOCKED",
  "DISCONTINUED",
  "INV",
] as const;

/** Ensure the edit dropdown can display the SKU's current status from catalog/Redis. */
export function adminProductStatusOptions(current?: string): string[] {
  const base: string[] = [...ADMIN_PRODUCT_STATUS_OPTIONS];
  const currentUpper = String(current || "").trim().toUpperCase();
  if (currentUpper && !base.includes(currentUpper)) {
    base.push(currentUpper);
  }
  return base;
}

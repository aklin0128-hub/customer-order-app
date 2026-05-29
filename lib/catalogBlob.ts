/** Private blob path prefixes served via GET /api/blob */
export const CATALOG_BLOB_PREFIXES = ["product-images/", "new-item-pdfs/"] as const;

export function isAllowedCatalogBlobPathname(pathname: string) {
  const path = String(pathname || "").trim();
  if (!path || path.includes("..")) return false;
  return CATALOG_BLOB_PREFIXES.some((prefix) => path.startsWith(prefix));
}

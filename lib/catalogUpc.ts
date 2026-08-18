/** Digits-only UPC/barcode suitable for on-card display. */
export function resolveCatalogUpc(item: { upc?: string | null; barcode?: string | null } | null | undefined) {
  if (!item) return "";
  const upc = String(item.upc || "").replace(/\D/g, "");
  if (upc.length >= 8) return upc;
  const barcode = String(item.barcode || "").replace(/\D/g, "");
  if (barcode.length >= 8) return barcode;
  return "";
}

export function barcodeFormatForUpc(digits: string) {
  const value = String(digits || "").replace(/\D/g, "");
  if (value.length === 12) return "UPC";
  if (value.length === 13) return "EAN13";
  if (value.length === 8) return "EAN8";
  return "CODE128";
}

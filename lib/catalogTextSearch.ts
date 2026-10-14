/** Shared catalog text search: brand + name token matching (e.g. "samyang carbo"). */

export function catalogSearchTokens(value: string) {
  return String(value || "")
    .toUpperCase()
    .split(/[^A-Z0-9\u4e00-\u9fff]+/)
    .filter(Boolean);
}

/** Drop spaces and punctuation so `o tube`, `o!tube`, and `otube` match the same text. */
export function catalogSearchCompact(value?: string | null) {
  return catalogSearchTokens(value || "").join("");
}

export function catalogTokensMatchInOrder(haystackTokens: string[], needleTokens: string[]) {
  if (needleTokens.length === 0) return false;
  let index = 0;
  for (const needle of needleTokens) {
    while (index < haystackTokens.length && !haystackTokens[index]!.startsWith(needle)) {
      index += 1;
    }
    if (index >= haystackTokens.length) return false;
    index += 1;
  }
  return true;
}

/** Each query token matches a distinct haystack token as a prefix ("carbo" → "CARBONARA"). */
export function catalogTokensAllMatch(haystackTokens: string[], needleTokens: string[]) {
  if (needleTokens.length === 0) return false;
  const used = new Set<number>();
  for (const needle of needleTokens) {
    let found = false;
    for (let i = 0; i < haystackTokens.length; i++) {
      if (used.has(i)) continue;
      if (haystackTokens[i]!.startsWith(needle)) {
        used.add(i);
        found = true;
        break;
      }
    }
    if (!found) return false;
  }
  return true;
}

export type CatalogTextSearchFields = {
  sku?: string | null;
  name?: string | null;
  brand?: string | null;
  barcode?: string | null;
  upc?: string | null;
  size?: string | null;
};

/**
 * Rank a catalog row for a free-text query.
 * Returns -1 when it does not match.
 * Callers that have UPC/scan helpers can override higher ranks themselves.
 */
export function scoreCatalogTextSearch(item: CatalogTextSearchFields, query: string): number {
  const raw = query.trim();
  if (!raw) return -1;

  const q = raw.toUpperCase();
  const qCompact = catalogSearchCompact(raw);
  const qTokens = catalogSearchTokens(raw);

  const sku = String(item.sku || "").toUpperCase();
  const name = String(item.name || "").toUpperCase();
  const brand = String(item.brand || "").toUpperCase();
  const barcode = String(item.barcode || "").toUpperCase();
  const upc = String(item.upc || "").toUpperCase();
  const size = String(item.size || "").toUpperCase();

  const skuCompact = catalogSearchCompact(sku);
  const nameCompact = catalogSearchCompact(name);
  const brandCompact = catalogSearchCompact(brand);
  const sizeCompact = catalogSearchCompact(size);
  const nameTokens = catalogSearchTokens(name);
  const brandTokens = catalogSearchTokens(brand);
  const titleTokens = [...brandTokens, ...nameTokens];
  const titleCompact = `${brandCompact}${nameCompact}`;

  if (sku === q || (qCompact && skuCompact === qCompact)) return 1000;
  if (sku.startsWith(q) || (qCompact && skuCompact.startsWith(qCompact))) return 900;
  if (barcode === q || upc === q) return 850;
  if (barcode.startsWith(q) || upc.startsWith(q)) return 800;
  if (sku.includes(q) || (qCompact.length >= 2 && skuCompact.includes(qCompact))) return 700;

  const qDigits = q.replace(/\D/g, "");
  const upcDigits = upc.replace(/\D/g, "");
  const barcodeDigits = barcode.replace(/\D/g, "");
  if (qDigits.length >= 6 && (upcDigits.includes(qDigits) || barcodeDigits.includes(qDigits))) return 820;

  if (brand.startsWith(q) || (qCompact.length === 1 && brandCompact.startsWith(qCompact))) return 600;
  if (qCompact.length >= 2 && nameCompact.startsWith(qCompact)) return 580;
  if (qCompact.length >= 2 && brandCompact.startsWith(qCompact)) return 570;
  if (qCompact.length >= 2 && nameCompact.includes(qCompact)) return 560;

  // "samyang carbo" → brand SAMYANG + name CARBONARA…
  if (qTokens.length >= 2 && catalogTokensMatchInOrder(titleTokens, qTokens)) return 550;
  if (qTokens.length >= 2 && catalogTokensAllMatch(titleTokens, qTokens)) return 548;
  if (qTokens.length >= 2 && qCompact.length >= 2 && titleCompact.includes(qCompact)) return 545;

  if (qTokens.length >= 2 && catalogTokensMatchInOrder(nameTokens, qTokens)) return 540;
  if (qCompact.length >= 2 && brandCompact.includes(qCompact)) return 530;

  if (qTokens.length <= 1 && nameTokens.some((token) => token.startsWith(qTokens[0] || q))) return 550;
  if (q.length >= 2 && name.startsWith(q)) return 510;
  if (q.length >= 2 && brand.includes(q)) return 480;
  if (q.length >= 2 && (name.includes(q) || size.includes(q) || sizeCompact.includes(qCompact))) return 450;
  if (qTokens.length >= 2 && catalogTokensMatchInOrder(brandTokens, qTokens)) return 440;

  if (q.length >= 1 && /[^\x00-\x7F]/.test(q)) {
    if (name.includes(q) || brand.includes(q)) return 400;
  }

  if (q.length >= 3 && (barcode.includes(q) || upc.includes(q))) return 200;
  return -1;
}

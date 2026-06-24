import { resolveInvoiceCaseUnitPrice } from "./invoiceCaseUnitPrice";

/** Structured fields pulled from invoice text (PDF or OCR). */

export type ParsedInvoiceLine = {
  sku: string;
  qty: number;
  unitPrice?: number;
  lineTotal?: number;
  rawLine?: string;
};

export type ParsedInvoice = {
  invoiceNo: string | null;
  accountNo: string | null;
  supplierOrderNo: string | null;
  invoiceDate: string | null;
  lines: ParsedInvoiceLine[];
  warnings: string[];
};

function money(s: string): number | undefined {
  const n = Number(String(s).replace(/,/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

const INVOICE_TABLE_HEADER_RE =
  /\bNo\.?\b.*\b(?:Brand|Description|Qty\.?|UM|Unit|Each|Total)\b/i;

function isInvoiceTableEndLine(line: string) {
  return /^subtotal|^amount\s+due|^grand\s+total|^thank\s+you/i.test(line.trim());
}

/** Keep only lines between the product table header and subtotal/footer. */
export function sliceInvoiceProductSectionLines(rawLines: string[]) {
  const productLines: string[] = [];
  let inTable = false;

  for (const raw of rawLines) {
    const line = raw.trim();
    if (!line) continue;
    if (!inTable) {
      if (INVOICE_TABLE_HEADER_RE.test(line.replace(/\s+/g, " "))) inTable = true;
      continue;
    }
    if (isInvoiceTableEndLine(line)) break;
    productLines.push(raw);
  }

  return productLines.length > 0 ? productLines : rawLines;
}

function isLikelyAddressOrHeaderLine(line: string) {
  const normalized = line.trim().replace(/\s+/g, " ");
  if (
    /\b\d+\s+(?:N\.?|S\.?|E\.?|W\.?)?\s*(?:COCA\s*COLA|COCA|UNIVERSITY|PETERS|[A-Z][A-Z0-9&.'-]{2,})\s+(?:ROAD|DRIVE|DR\.?|STREET|ST\.?|AVENUE|AVE\.?|BLVD|BOULEVARD|HWY|HIGHWAY|LANE|LN\.?|WAY|COURT|CT\.?)\b/i.test(
      normalized
    )
  ) {
    return true;
  }
  if (
    /\b\d+\s+(?:COCA\s*COLA|COCA|PETERS|ROAD|DRIVE|DR\.?|STREET|ST\.?|AVENUE|AVE\.?|BLVD|BOULEVARD|HWY|HIGHWAY|LANE|LN\.?|WAY|COURT|CT\.?)\b/i.test(
      normalized
    )
  ) {
    return true;
  }
  if (/\b(?:BILL\s*TO|SHIP\s*TO|INVOICE\s*NO|ORDER\s*NO|CUSTOMER\s*NO|DUE\s*DATE|SALESPERSON|TERMS)\b/i.test(normalized)) {
    return true;
  }
  if (/,?\s*(?:FL|MD|VA|GA|NY|NJ|TX|CA|USA)\s*,?\s*\d{5}\b/i.test(normalized)) return true;
  if (/\b(?:FT\.?\s*LAUDERDALE|DAVIE|HANOVER|MARYLAND|FLORIDA)\b/i.test(normalized)) return true;
  if (/\b(?:RHEEBROS|HANOVER|DAVIE|MARYLAND|FLORIDA)\b/i.test(normalized) && /\b\d{5}\b/.test(normalized)) {
    return true;
  }
  if (/\b\d{3}-\d{3}-\d{4}\b/.test(normalized)) return true;
  return false;
}

/** Drop Bill To / Ship To blocks above the product table (street numbers are not SKUs). */
export function stripInvoiceAddressSections(rawLines: string[]) {
  const result: string[] = [];
  let skippingAddressBlock = false;

  for (const raw of rawLines) {
    const line = raw.trim();
    if (!line) {
      if (!skippingAddressBlock) result.push(raw);
      continue;
    }

    const normalized = line.replace(/\s+/g, " ");
    if (INVOICE_TABLE_HEADER_RE.test(normalized)) {
      skippingAddressBlock = false;
      result.push(raw);
      continue;
    }

    if (/\b(?:BILL\s*TO|SHIP\s*TO)\b/i.test(normalized)) {
      skippingAddressBlock = true;
      continue;
    }

    if (skippingAddressBlock) {
      if (isLikelyAddressOrHeaderLine(line) || /^[A-Z0-9&.'\s,-]{3,}$/i.test(line)) {
        continue;
      }
      skippingAddressBlock = false;
    }

    result.push(raw);
  }

  return result;
}

/** Rheebros item numbers are catalog SKUs like 00012D — not street numbers or zip codes. */
export function isRheebrosInvoiceItemSku(sku: string, line = "") {
  const token = String(sku || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  if (!token) return false;

  if (/^\d{4,7}[A-Z][A-Z0-9]{0,2}$/.test(token)) return true;

  // PDF sometimes drops the suffix letter; allow short numeric only on real product rows.
  if (/^\d{4,5}$/.test(token)) {
    if (isLikelyAddressOrHeaderLine(line)) return false;
    const normalized = line.trim().replace(/\s+/g, " ");
    if (!/\b(?:Case|CS|CA|EA|Each|BX|Box|PK|Pack|BG|Bag)\b/i.test(normalized)) return false;
    if (token.startsWith("0")) return true;
    return /\b(?:Dry|Frozen|Chilled|REF|COOL|WET|GROC)\b/i.test(normalized);
  }

  return false;
}

function extractInvoiceSkuToken(line: string) {
  const normalized = line.trim().replace(/\s+/g, " ");
  const skuMatch = normalized.match(/^(\d{4,7}[A-Z0-9]{0,3})\b/i);
  return skuMatch?.[1]?.toUpperCase() ?? null;
}

function buildParsedLine(
  sku: string,
  qty: number,
  unitCol: string | undefined,
  eachCol: string | undefined,
  totalCol: string | undefined,
  rawLine: string
): ParsedInvoiceLine | null {
  if (!sku || !qty) return null;

  const lineTotal = money(totalCol ?? "");
  const unitPrice = resolveInvoiceCaseUnitPrice({
    qty,
    unitPrice: money(unitCol ?? ""),
    eachPrice: money(eachCol ?? ""),
    lineTotal,
  });

  return { sku, qty, unitPrice, lineTotal, rawLine };
}

function tryParseRheebrosPriceTail(normalized: string): {
  qty: number;
  unitCol: string;
  eachCol?: string;
  totalCol: string;
} | null {
  const unitWord = "(?:Case|CS|CA|EA|Each|BX|Box|PK|Pack|BG|Bag)";
  const priceCol = "([\\d,]+(?:\\.\\d{2})?)";

  const rx3 = new RegExp(
    `(\\d{1,5})\\s+${unitWord}\\s+(\\S+)\\s+${priceCol}\\s+${priceCol}\\s+${priceCol}\\s*$`,
    "gi"
  );
  let last3: RegExpExecArray | null = null;
  let match: RegExpExecArray | null;
  while ((match = rx3.exec(normalized)) !== null) {
    const qtyIndex = match.index ?? 0;
    if (qtyIndex > 0 && normalized[qtyIndex - 1] === ".") continue;
    if (!parseInt(match[1], 10)) continue;
    last3 = match;
  }
  if (last3) {
    return {
      qty: parseInt(last3[1], 10),
      unitCol: last3[3],
      eachCol: last3[4],
      totalCol: last3[5],
    };
  }

  const rx2 = new RegExp(`(\\d{1,5})\\s+${unitWord}\\s+${priceCol}\\s+${priceCol}\\s*$`, "gi");
  let last2: RegExpExecArray | null = null;
  while ((match = rx2.exec(normalized)) !== null) {
    const qtyIndex = match.index ?? 0;
    if (qtyIndex > 0 && normalized[qtyIndex - 1] === ".") continue;
    if (!parseInt(match[1], 10)) continue;
    last2 = match;
  }
  if (last2) {
    return {
      qty: parseInt(last2[1], 10),
      unitCol: last2[2],
      totalCol: last2[3],
    };
  }

  return null;
}

function lineStartsSku(line: string) {
  const sku = extractInvoiceSkuToken(line);
  return Boolean(sku && isRheebrosInvoiceItemSku(sku, line));
}

function lineHasInvoicePriceTail(line: string) {
  return tryParseRheebrosPriceTail(line.trim().replace(/\s+/g, " ")) !== null;
}

/** PDFs often break before "Qty Case Type Unit Each Total" when size contains decimals like 2X12X7.05 OZ. */
function joinSplitInvoiceLines(rawLines: string[]): string[] {
  const result: string[] = [];
  let pending = "";

  for (const raw of rawLines) {
    const line = raw.trim();
    if (!line) continue;
    if (/^page\b/i.test(line)) continue;
    if (/^subtotal|^amount\s+due|^grand\s+total|^thank\s+you/i.test(line)) continue;

    if (pending) {
      const merged = `${pending} ${line}`;
      if (lineHasInvoicePriceTail(merged)) {
        result.push(merged);
        pending = "";
        continue;
      }
      if (lineStartsSku(line)) {
        pending = line;
        continue;
      }
      pending = merged;
      continue;
    }

    if (lineStartsSku(line) && !lineHasInvoicePriceTail(line)) {
      pending = line;
      continue;
    }

    result.push(line);
  }

  return result;
}

/**
 * RHEEBROS-style row: SKU … (description) … Qty Case Type Unit Each Total
 */
function tryParseTableRow(line: string): ParsedInvoiceLine | null {
  if (isLikelyAddressOrHeaderLine(line)) return null;

  const normalized = line.trim().replace(/\s+/g, " ");
  const sku = extractInvoiceSkuToken(line);
  if (!sku || !isRheebrosInvoiceItemSku(sku, line)) return null;

  const tail = tryParseRheebrosPriceTail(normalized);
  if (tail) {
    return buildParsedLine(sku, tail.qty, tail.unitCol, tail.eachCol, tail.totalCol, line);
  }

  return null;
}

export function parseInvoiceText(raw: string): ParsedInvoice {
  const warnings: string[] = [];
  const text = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  let invoiceNo =
    text.match(/invoice\s*no\.?\s*[#:\s]*\s*([A-Z]{2,6}-\d{4,})/i)?.[1]?.trim() ??
    text.match(/\b([A-Z]{2,6}-\d{6,})\b/)?.[1] ??
    null;

  let accountNo =
    text.match(/customer\s*no\.?\s*[#:\s]*\s*([A-Z]{1,5}\d{2,8})/i)?.[1]?.toUpperCase?.() ?? null;

  if (!accountNo) {
    const m = text.match(/\b(FL\d{3,6})\b/i);
    accountNo = m ? m[1].toUpperCase() : null;
  }

  let supplierOrderNo = text.match(/order\s*no\.?\s*[#:\s]*\s*([A-Z]{2,3}-\d{5,})/i)?.[1] ?? null;

  const invoiceDate =
    text.match(/invoice\s*date\s*[#:\s]*\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i)?.[1] ??
    text.match(/invoice\s*date\s*\n\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i)?.[1] ??
    null;

  const merged = new Map<string, ParsedInvoiceLine>();
  const sectionLines = sliceInvoiceProductSectionLines(
    stripInvoiceAddressSections(text.split("\n"))
  );

  for (const rawLine of joinSplitInvoiceLines(sectionLines)) {
    const line = rawLine.trim();
    if (line.length < 12) continue;
    if (/^page\b/i.test(line)) continue;
    if (/^subtotal|^amount\s+due|^grand\s+total|^thank\s+you/i.test(line)) continue;

    const parsed = tryParseTableRow(line);
    if (!parsed) continue;

    const key = parsed.sku.toUpperCase();
    const existing = merged.get(key);
    if (!existing) merged.set(key, { ...parsed });
    else {
      const lineTotal =
        existing.lineTotal != null && parsed.lineTotal != null
          ? existing.lineTotal + parsed.lineTotal
          : (parsed.lineTotal ?? existing.lineTotal);
      merged.set(key, {
        ...existing,
        qty: existing.qty + parsed.qty,
        unitPrice: parsed.unitPrice ?? existing.unitPrice,
        lineTotal,
        rawLine: existing.rawLine ? `${existing.rawLine} | ${parsed.rawLine}` : parsed.rawLine,
      });
    }
  }

  const lines = Array.from(merged.values());

  if (lines.length === 0) {
    warnings.push(
      "No table rows matched (expect: Item# … Qty Case Type unit each total). PDF with copyable text works best; scanned pages use OCR and may need a manual check."
    );
  }
  if (!invoiceNo) warnings.push("Invoice number not detected — enter it if you need to de-duplicate uploads.");
  if (!accountNo) warnings.push("Customer / account number not detected — use Manual account field before applying to history.");

  return { invoiceNo, accountNo, supplierOrderNo, invoiceDate, lines, warnings };
}

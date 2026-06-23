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

function tryParseNoBrandInvoiceRow(line: string): ParsedInvoiceLine | null {
  const normalized = line.trim().replace(/\s+/g, " ");
  const rx = /^(\d{4,7}[A-Z0-9]{0,3})\s+\S+\s+.+?\s+(\d{1,5})\s+(?:Case|CS|CA|EA|Each|BX|Box|PK|Pack|BG|Bag)\s+\S+\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s*$/i;
  const match = normalized.match(rx);
  if (!match) return null;

  const sku = match[1].toUpperCase();
  const qty = Math.max(1, parseInt(match[2], 10) || 0);
  return buildParsedLine(sku, qty, match[3], match[4], match[5], line);
}

function parseFlexibleNoRow(line: string): ParsedInvoiceLine | null {
  const normalized = line.trim().replace(/\s+/g, " ");
  const moneyMatches = Array.from(normalized.matchAll(/\$?(\d[\d,]*\.\d{2})/g));
  if (moneyMatches.length === 0) return null;

  const skuMatch = normalized.match(
    /(?:^|\s)(?:NO\.?\s*)?(\d{4,7}[A-Z0-9]{0,3})(?=\s)/i
  );
  if (!skuMatch?.[1] || skuMatch.index === undefined) return null;

  const sku = skuMatch[1].toUpperCase();
  const skuEnd = skuMatch.index + skuMatch[0].length;
  const firstMoneyIndex = moneyMatches[0].index ?? normalized.length;
  const middle = normalized.slice(skuEnd, firstMoneyIndex);

  const qtyUnitMatches = Array.from(
    middle.matchAll(/\b(\d{1,5})\s*(?:Case|CS|CA|EA|Each|BX|Box|PK|Pack|BG|Bag)\b/gi)
  );
  const qtyText = qtyUnitMatches.at(-1)?.[1] ?? Array.from(middle.matchAll(/\b(\d{1,5})\b/g)).at(-1)?.[1];
  const qty = Math.max(1, parseInt(qtyText || "", 10) || 0);
  if (!sku || !qty) return null;

  const prices = moneyMatches
    .map((match) => money(match[1]))
    .filter((value): value is number => typeof value === "number");
  if (prices.length === 0) return null;

  const unitCol = prices.length >= 3 ? String(prices[prices.length - 3]) : undefined;
  const eachCol =
    prices.length >= 3
      ? String(prices[prices.length - 2])
      : prices.length === 2
        ? String(prices[0])
        : undefined;
  const totalCol = String(prices.at(-1));

  return buildParsedLine(sku, qty, unitCol, eachCol, totalCol, line);
}

/**
 * RHEEBROS-style row: SKU … (description) … Qty Case Type Unit Each Total
 */
function tryParseTableRow(line: string): ParsedInvoiceLine | null {
  const noBrandRow = tryParseNoBrandInvoiceRow(line);
  if (noBrandRow) return noBrandRow;

  const typeWord = "(?:Dry|Frozen|Chilled|REF|COOL|WET)";
  const rxLoose = new RegExp(
    `^(\\d{4,7}[A-Z0-9]{0,3})\\s+.+\\s+(\\d+)\\s+Case\\s+${typeWord}\\s+([\\d,]+\\.\\d{2})\\s+([\\d,]+\\.\\d{2})\\s+([\\d,]+\\.\\d{2})\\s*$`,
    "i"
  );
  let m = line.trim().match(rxLoose);

  if (!m) {
    const rxAnyType = new RegExp(
      `^(\\d{4,7}[A-Z0-9]{0,3})\\s+.+\\s+(\\d+)\\s+Case\\s+(\\S+)\\s+([\\d,]+\\.\\d{2})\\s+([\\d,]+\\.\\d{2})\\s+([\\d,]+\\.\\d{2})\\s*$`,
      "i"
    );
    m = line.trim().match(rxAnyType);
    if (!m) return parseFlexibleNoRow(line);
    const sku = m[1].toUpperCase();
    const qty = Math.max(1, parseInt(m[2], 10) || 0);
    return buildParsedLine(sku, qty, m[4], m[5], m[6], line);
  }

  const sku = m[1].toUpperCase();
  const qty = Math.max(1, parseInt(m[2], 10) || 0);
  return buildParsedLine(sku, qty, m[3], m[4], m[5], line);
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

  for (const rawLine of text.split("\n")) {
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

export type InvoiceCompareColumn = {
  importId: string;
  invoiceNo: string;
  date: string;
};

export type InvoiceCompareCell = {
  price: number | null;
  qty: number;
  changePct: number | null;
};

export type InvoiceCompareRow = {
  sku: string;
  name: string;
  brand: string;
  /** Catalog status (NORMAL, READYTOORDER, …). */
  status?: string;
  /** False when status is not orderable (Not available / Coming soon). */
  available: boolean;
  cells: InvoiceCompareCell[];
};

export type InvoiceCompareReport = {
  accountNo: string;
  asOfDate: string;
  lookbackDays: number;
  invoiceCount: number;
  skuCount: number;
  invoices: InvoiceCompareColumn[];
  rows: InvoiceCompareRow[];
  accountInvoiceCount?: number;
  note?: string;
};

/** FL0156 / FL156 / 156 → comparable key */
export function invoiceCompareAccountKey(value: string) {
  const raw = String(value || "").trim().toUpperCase();
  if (!raw) return "";
  const m = raw.match(/^([A-Z]+)?0*([0-9]+)$/);
  if (m) return `${m[1] || ""}${m[2]}`;
  return raw;
}

export function invoiceCompareAccountsMatch(a: string, b: string) {
  const left = invoiceCompareAccountKey(a);
  const right = invoiceCompareAccountKey(b);
  if (!left || !right) return false;
  if (left === right) return true;
  const leftDigits = left.replace(/^[A-Z]+/, "");
  const rightDigits = right.replace(/^[A-Z]+/, "");
  return Boolean(leftDigits && rightDigits && leftDigits === rightDigits);
}

function invoiceKey(inv: InvoiceCompareColumn, index: number) {
  return inv.importId || `${inv.invoiceNo}|${inv.date}|${index}`;
}

export function invoiceCompareColumnKey(inv: InvoiceCompareColumn, index: number) {
  return invoiceKey(inv, index);
}

/** Drop excluded invoice columns and recompute change % against the new neighbour. */
export function excludeInvoiceCompareColumns(
  report: InvoiceCompareReport,
  excludedKeys: Set<string>
): InvoiceCompareReport {
  if (excludedKeys.size === 0) return report;

  const keepIndexes = report.invoices
    .map((inv, index) => ({ inv, index }))
    .filter(({ inv, index }) => !excludedKeys.has(invoiceKey(inv, index)))
    .map(({ index }) => index);

  const invoices = keepIndexes.map((index) => report.invoices[index]);

  const rows = report.rows.map((row) => {
    const cells = keepIndexes.map((sourceIndex, position) => {
      const cell = row.cells[sourceIndex];
      const price = cell?.price ?? null;
      let changePct: number | null = null;
      if (position > 0 && price != null) {
        const prev = row.cells[keepIndexes[position - 1]]?.price;
        if (prev != null && prev > 0) {
          changePct = Math.round(((price - prev) / prev) * 100 * 100) / 100;
        }
      }
      return { price, qty: cell?.qty ?? 0, changePct };
    });
    return { ...row, cells };
  });

  return {
    ...report,
    invoices,
    invoiceCount: invoices.length,
    rows,
  };
}

function formatPriceCell(price: number | null) {
  if (price == null || !Number.isFinite(price)) return "";
  return Number.isInteger(price) ? String(price) : price.toFixed(2);
}

/**
 * CSV matches the /comp table layout (ASCII-only for Excel):
 * row1 = dates, row2 = invoice #s, row3 = PRICE labels,
 * then one price column per invoice (color highlighting is on the web UI).
 */
export function invoiceCompareToCsv(report: InvoiceCompareReport): {
  headerRows: string[][];
  rows: (string | number)[][];
} {
  const dateRow = ["SKU", "Brand", "Name"];
  const invoiceRow = ["", "", ""];
  const labelRow = ["", "", ""];

  for (let i = 0; i < report.invoices.length; i += 1) {
    const inv = report.invoices[i];
    dateRow.push(inv.date || "");
    invoiceRow.push(inv.invoiceNo || "");
    labelRow.push("PRICE");
  }

  const rows = report.rows.map((row) => {
    const out: (string | number)[] = [row.sku, row.brand, row.name];
    for (const cell of row.cells) {
      out.push(formatPriceCell(cell.price));
    }
    return out;
  });

  return {
    headerRows: [dateRow, invoiceRow, labelRow],
    rows,
  };
}

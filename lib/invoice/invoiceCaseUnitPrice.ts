/** Invoice rows list Unit (case), Each (piece), and Total columns — customers order by the case. */

export type InvoicePriceFields = {
  qty?: number;
  unitPrice?: number;
  eachPrice?: number;
  lineTotal?: number;
};

function roundMoney(n: number) {
  return Math.round(n * 100) / 100;
}

function closeEnough(a: number, b: number) {
  return Math.abs(a - b) <= 0.05;
}

/** Case unit price from parsed invoice columns; prefers line total ÷ qty when columns disagree. */
export function resolveInvoiceCaseUnitPrice(input: InvoicePriceFields): number | undefined {
  const qty = Math.max(1, Number(input.qty) || 1);
  const unit = input.unitPrice;
  const each = input.eachPrice;
  const total = input.lineTotal;

  const fromTotal =
    typeof total === "number" && Number.isFinite(total) && total > 0
      ? roundMoney(total / qty)
      : undefined;

  if (typeof unit === "number" && unit > 0 && typeof each === "number" && each > 0) {
    const casePrice = unit >= each ? unit : each;
    if (fromTotal != null) {
      if (closeEnough(fromTotal, casePrice)) return fromTotal;
      if (!closeEnough(fromTotal, unit) && closeEnough(fromTotal, each)) return fromTotal;
      if (!closeEnough(fromTotal, casePrice)) return fromTotal;
    }
    return casePrice;
  }

  if (fromTotal != null && fromTotal > 0) {
    if (typeof unit === "number" && unit > 0) {
      if (closeEnough(fromTotal, unit)) return fromTotal;
      if (unit < fromTotal * 0.95) return fromTotal;
      return unit;
    }
    return fromTotal;
  }

  if (typeof unit === "number" && unit > 0) return unit;
  return undefined;
}

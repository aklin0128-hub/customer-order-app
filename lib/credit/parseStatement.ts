/** Parse Rhee Bros–style AR statements into deposit-slip rows. */

export type StatementLineKind = "Invoice" | "Credit" | "Payment" | "Refund" | "Other";

export type ParsedStatementLine = {
  document: string;
  code: StatementLineKind;
  date?: string;
  orderNo?: string;
  originalAmount?: number;
  remainingDebit: number;
  remainingCredit: number;
};

export type ParsedStatement = {
  accountNo?: string;
  salesCode?: string;
  salesName?: string;
  statementDate?: string;
  customerName?: string;
  lines: ParsedStatementLine[];
};

const DOC_RE = /\b([A-Z]{2,}[A-Z0-9]*(?:-[A-Z0-9]+)+)\b/g;
const MONEY_RE = /\(?-?\$?\s*[\d,]+\.\d{2}\)?/g;
const CODE_RE = /\b(Invoice|Credit|Payment|Refund)\b/i;
const DATE_RE = /\b(\d{1,2}\/\d{1,2}\/\d{2,4})\b/;

export function parseMoneyToken(raw: string): number | null {
  const text = String(raw || "").trim();
  if (!text) return null;
  const negative = /^\(.*\)$/.test(text) || text.includes("-");
  const digits = text.replace(/[^0-9.]/g, "");
  if (!digits) return null;
  const value = Number(digits);
  if (!Number.isFinite(value)) return null;
  return negative ? -Math.abs(value) : value;
}

export function classifyStatementCode(raw?: string): StatementLineKind {
  const s = String(raw || "").trim().toLowerCase();
  if (s === "invoice") return "Invoice";
  if (s === "credit") return "Credit";
  if (s === "payment") return "Payment";
  if (s === "refund") return "Refund";
  return "Other";
}

function isLikelyDocument(token: string) {
  const t = token.toUpperCase();
  if (t.startsWith("SO-")) return false;
  if (/^FL\d+$/i.test(t)) return false;
  if (t === "NET-30" || t === "NET30") return false;
  // Prefer invoice / credit / deposit style docs.
  return /^(SJCM|PSI|PSCM|PNC|CM|INV|CN)/i.test(t) || t.includes("-");
}

function pickDocument(tokens: string[]) {
  const docs = tokens.filter(isLikelyDocument);
  if (!docs.length) return "";
  // Prefer non-deposit documents first, then deposits.
  const preferred = docs.find((d) => !/^PNC-DEPOSIT/i.test(d));
  return preferred || docs[0] || "";
}

function extractHeaderField(text: string, labels: string[]) {
  for (const label of labels) {
    const re = new RegExp(`${label}\\s*[:#]?\\s*([^\\n\\r]+)`, "i");
    const m = text.match(re);
    if (m?.[1]) {
      return String(m[1])
        .split(/\s{2,}|\t/)[0]
        .trim()
        .replace(/\s+Page.*$/i, "")
        .trim();
    }
  }
  return undefined;
}

/**
 * Parse one statement line of mixed OCR/PDF text.
 * Expected pieces: Document … Code … amounts (remaining debit / credit near end).
 */
export function parseStatementLineText(line: string): ParsedStatementLine | null {
  const raw = String(line || "").replace(/\s+/g, " ").trim();
  if (!raw) return null;
  if (/statement\s+aging|days\s+overdue|aged\s+amounts|remaining\s+debits\s+remaining\s+credits/i.test(raw)) {
    return null;
  }
  if (/^document\b/i.test(raw) && /remaining/i.test(raw)) return null;

  const docs = [...raw.matchAll(DOC_RE)].map((m) => m[1]!.toUpperCase());
  const document = pickDocument(docs);
  if (!document) return null;

  const codeMatch = raw.match(CODE_RE);
  const code = classifyStatementCode(codeMatch?.[1]);

  const dateMatch = raw.match(DATE_RE);
  const date = dateMatch?.[1];

  const moneyTokens = [...raw.matchAll(MONEY_RE)].map((m) => m[0]);
  const moneyValues = moneyTokens
    .map(parseMoneyToken)
    .filter((n): n is number => n != null);

  if (moneyValues.length === 0) return null;

  let remainingDebit = 0;
  let remainingCredit = 0;
  let originalAmount: number | undefined;

  // Heuristic: last two non-running-balance amounts are often Remaining Debit / Credit.
  // OCR/PDF order is usually: Original, Remaining Debit, Remaining Credit, Balance.
  if (moneyValues.length >= 4) {
    originalAmount = moneyValues[0];
    remainingDebit = Math.max(0, moneyValues[moneyValues.length - 3] || 0);
    remainingCredit = Math.max(0, moneyValues[moneyValues.length - 2] || 0);
  } else if (moneyValues.length === 3) {
    originalAmount = moneyValues[0];
    remainingDebit = Math.max(0, moneyValues[1] || 0);
    remainingCredit = Math.max(0, moneyValues[2] || 0);
  } else if (moneyValues.length === 2) {
    originalAmount = moneyValues[0];
    if (code === "Credit" || code === "Payment" || (originalAmount ?? 0) < 0) {
      remainingCredit = Math.abs(moneyValues[1] || 0);
    } else {
      remainingDebit = Math.max(0, moneyValues[1] || 0);
    }
  } else {
    originalAmount = moneyValues[0];
    if (code === "Credit" || code === "Payment" || (originalAmount ?? 0) < 0) {
      remainingCredit = Math.abs(originalAmount || 0);
    } else {
      remainingDebit = Math.max(0, originalAmount || 0);
    }
  }

  // Code-based cleanup when one side should be zero.
  if (code === "Invoice" || code === "Refund") {
    if (remainingDebit <= 0 && remainingCredit > 0) {
      remainingDebit = remainingCredit;
      remainingCredit = 0;
    }
  }
  if (code === "Credit" || code === "Payment") {
    if (remainingCredit <= 0 && remainingDebit > 0) {
      remainingCredit = remainingDebit;
      remainingDebit = 0;
    }
  }

  if (remainingDebit <= 0 && remainingCredit <= 0) return null;

  const orderNo = docs.find((d) => d.startsWith("SO-"));

  return {
    document,
    code,
    date,
    orderNo,
    originalAmount,
    remainingDebit: round2(remainingDebit),
    remainingCredit: round2(remainingCredit),
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function parseStatementText(text: string): ParsedStatement {
  const raw = String(text || "").replace(/\r/g, "\n");
  const accountNo = extractHeaderField(raw, ["Account No\\.?", "Account #", "Account"]);
  const salesCode = extractHeaderField(raw, ["Sales Code"]);
  const salesName = extractHeaderField(raw, ["Sales Name"]);
  const statementDate = extractHeaderField(raw, ["Statement Date"]);

  const lines: ParsedStatementLine[] = [];
  const seen = new Set<string>();

  for (const line of raw.split("\n")) {
    const parsed = parseStatementLineText(line);
    if (!parsed) continue;
    const key = `${parsed.document}|${parsed.remainingDebit}|${parsed.remainingCredit}|${parsed.code}`;
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push(parsed);
  }

  // Fallback: some PDFs dump the table into fewer wrapped lines — scan windows.
  if (lines.length === 0) {
    const collapsed = raw.replace(/\n+/g, " ");
    const chunks = collapsed.split(/(?=\b(?:SJCM|PSI|PSCM|PNC|CM)-)/i);
    for (const chunk of chunks) {
      const parsed = parseStatementLineText(chunk);
      if (!parsed) continue;
      const key = `${parsed.document}|${parsed.remainingDebit}|${parsed.remainingCredit}|${parsed.code}`;
      if (seen.has(key)) continue;
      seen.add(key);
      lines.push(parsed);
    }
  }

  return {
    accountNo: accountNo?.replace(/[^A-Za-z0-9]/g, "").toUpperCase() || undefined,
    salesCode: salesCode?.split(/\s+/)[0],
    salesName: salesName?.split(/\s{2,}/)[0]?.trim(),
    statementDate,
    lines,
  };
}

/** Default deposit-slip amount: debit positive, credit negative. */
export function defaultSlipAmount(line: Pick<ParsedStatementLine, "remainingDebit" | "remainingCredit">) {
  if (line.remainingDebit > 0) return round2(line.remainingDebit);
  if (line.remainingCredit > 0) return round2(-line.remainingCredit);
  return 0;
}

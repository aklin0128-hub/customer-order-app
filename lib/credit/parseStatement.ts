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
/** Known Rhee Bros / AR document families used for splitting concatenated PDF text. */
const DOC_FAMILY = "SJCM|PSI|PSCM|PNC|CM|NSF|INV|CN";
const DOC_ANCHOR_RE = new RegExp(`\\b((?:${DOC_FAMILY})-[A-Z0-9-]+)\\b`, "gi");
const DOC_SPLIT_RE = new RegExp(`(?=\\b(?:${DOC_FAMILY})-)`, "i");

export function parseMoneyToken(raw: string): number | null {
  const text = String(raw || "").trim();
  if (!text) return null;
  const negative = /^\(.*\)$/.test(text) || /-\s*\$?\s*[\d,]+\.\d{2}/.test(text) || text.trim().startsWith("-");
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
  if (/^NET-?\d+$/i.test(t)) return false;
  // Invoice / credit / refund / deposit document families (incl. NSF refunds).
  if (new RegExp(`^(?:${DOC_FAMILY})-`, "i").test(t)) return true;
  // Other hyphenated refs with FY/year style segments (future doc types).
  if (/^[A-Z]{2,}(?:-[A-Z0-9]+)+$/.test(t) && /(?:^|-)FY\d{2}(?:-|$)/i.test(t)) return true;
  return false;
}

function pickDocument(tokens: string[]) {
  const docs = tokens.filter(isLikelyDocument);
  if (!docs.length) return "";
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

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/**
 * Statement columns: Original | Remaining Debits | Remaining Credits | Balance
 * Empty remaining cells are omitted by PDF/OCR, so the trailing amount is usually Balance.
 * Use Code to decide debit vs credit; never treat Balance as a remaining amount.
 */
export function resolveRemainingAmounts(
  code: StatementLineKind,
  moneyValues: number[]
): { originalAmount?: number; remainingDebit: number; remainingCredit: number } {
  if (!moneyValues.length) return { remainingDebit: 0, remainingCredit: 0 };

  // Drop trailing running balance when present.
  let working = moneyValues.slice();
  if (working.length >= 2) {
    working = working.slice(0, -1);
  }

  const originalAmount = working[0];
  const rest = working.slice(1);

  if (code === "Invoice" || code === "Refund") {
    const debit =
      rest.find((n) => n > 0) ??
      (originalAmount != null && originalAmount > 0 ? originalAmount : 0);
    return {
      originalAmount,
      remainingDebit: round2(Math.max(0, debit)),
      remainingCredit: 0,
    };
  }

  if (code === "Credit" || code === "Payment") {
    const creditCandidate =
      rest.find((n) => n !== 0) ??
      (originalAmount != null && originalAmount !== 0 ? originalAmount : 0);
    return {
      originalAmount,
      remainingDebit: 0,
      remainingCredit: round2(Math.abs(creditCandidate)),
    };
  }

  // Unknown code: negative original => credit, else debit.
  if ((originalAmount ?? 0) < 0) {
    const credit = rest.find((n) => n !== 0) ?? originalAmount ?? 0;
    return {
      originalAmount,
      remainingDebit: 0,
      remainingCredit: round2(Math.abs(credit)),
    };
  }

  const debit = rest.find((n) => n > 0) ?? Math.max(0, originalAmount ?? 0);
  return {
    originalAmount,
    remainingDebit: round2(debit),
    remainingCredit: 0,
  };
}

/**
 * Parse one statement line of mixed OCR/PDF text.
 * Expected pieces: Document … Code … amounts (remaining debit / credit), then Balance.
 */
export function parseStatementLineText(line: string): ParsedStatementLine | null {
  const raw = String(line || "").replace(/\s+/g, " ").trim();
  if (!raw) return null;
  if (/statement\s+aging|days\s+overdue|aged\s+amounts/i.test(raw)) return null;
  if (/remaining\s+debits\s+remaining\s+credits/i.test(raw)) return null;
  if (/^document\b/i.test(raw) && /remaining/i.test(raw)) return null;
  if (/statement\s+balance|total\s+debits|total\s+credits/i.test(raw)) return null;

  const docs = [...raw.matchAll(DOC_RE)].map((m) => m[1]!.toUpperCase());
  const document = pickDocument(docs);
  if (!document) return null;

  const codeMatch = raw.match(CODE_RE);
  const code = classifyStatementCode(codeMatch?.[1]);

  const dateMatch = raw.match(DATE_RE);
  const date = dateMatch?.[1];

  const moneyValues = [...raw.matchAll(MONEY_RE)]
    .map((m) => parseMoneyToken(m[0]!))
    .filter((n): n is number => n != null);

  if (moneyValues.length === 0) return null;

  const { originalAmount, remainingDebit, remainingCredit } = resolveRemainingAmounts(
    code,
    moneyValues
  );

  if (remainingDebit <= 0 && remainingCredit <= 0) return null;

  const orderNo = docs.find((d) => d.startsWith("SO-"));

  return {
    document,
    code,
    date,
    orderNo,
    originalAmount,
    remainingDebit,
    remainingCredit,
  };
}

function pushUnique(lines: ParsedStatementLine[], seen: Set<string>, parsed: ParsedStatementLine) {
  const key = `${parsed.document}|${parsed.code}|${parsed.remainingDebit}|${parsed.remainingCredit}`;
  if (seen.has(key)) return;
  // Prefer first non-Other code if same doc appears twice.
  const existingIdx = lines.findIndex((l) => l.document === parsed.document);
  if (existingIdx >= 0) {
    const existing = lines[existingIdx]!;
    if (existing.code === "Other" && parsed.code !== "Other") {
      lines[existingIdx] = parsed;
      seen.add(key);
    }
    return;
  }
  seen.add(key);
  lines.push(parsed);
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
    if (parsed) pushUnique(lines, seen, parsed);
  }

  // PDF text often wraps or concatenates rows — also split on document anchors.
  const collapsed = raw.replace(/\n+/g, " ");
  const chunks = collapsed.split(DOC_SPLIT_RE);
  for (const chunk of chunks) {
    const parsed = parseStatementLineText(chunk);
    if (parsed) pushUnique(lines, seen, parsed);
  }

  // Keep statement order by first appearance of each document in text.
  const order: string[] = [];
  for (const m of collapsed.matchAll(DOC_ANCHOR_RE)) {
    const doc = m[1]!.toUpperCase();
    if (!isLikelyDocument(doc)) continue;
    if (!order.includes(doc)) order.push(doc);
  }
  lines.sort((a, b) => {
    const ai = order.indexOf(a.document);
    const bi = order.indexOf(b.document);
    if (ai === -1 && bi === -1) return 0;
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

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

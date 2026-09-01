import type { StatementLineKind } from "@/lib/credit/parseStatement";

export type CreditDraftRow = {
  id: string;
  document: string;
  code: StatementLineKind;
  date?: string;
  remainingDebit: number;
  remainingCredit: number;
  selected: boolean;
};

export type CreditDraft = {
  v: 1;
  savedAt: string;
  storeId: string;
  name: string;
  code: string;
  slipDate: string;
  checkNo: string;
  checkAmount: string;
  checkDate: string;
  filter: "all" | "debit" | "credit";
  rows: CreditDraftRow[];
};

export const CREDIT_DRAFT_KEY = "credit_slip_draft_v1";

export function loadCreditDraft(): CreditDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CREDIT_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CreditDraft;
    if (!parsed || parsed.v !== 1 || !Array.isArray(parsed.rows)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveCreditDraft(draft: Omit<CreditDraft, "v" | "savedAt">): CreditDraft {
  const next: CreditDraft = {
    v: 1,
    savedAt: new Date().toISOString(),
    ...draft,
  };
  window.localStorage.setItem(CREDIT_DRAFT_KEY, JSON.stringify(next));
  const storeKey = String(draft.storeId || "")
    .trim()
    .toUpperCase();
  if (storeKey) {
    window.localStorage.setItem(`${CREDIT_DRAFT_KEY}:${storeKey}`, JSON.stringify(next));
  }
  return next;
}

export function clearCreditDraft() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(CREDIT_DRAFT_KEY);
}

export function formatDraftSavedAt(iso: string) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

import { loadInvoiceImportSummaries } from "@/lib/invoice/invoiceImportStore";

export type InvoiceDuplicateMatch = {
  id: string;
  uploadedAt: string;
  invoiceNo: string | null;
  invoiceDate: string | null;
};

export type InvoiceDuplicateGroupMember = {
  id: string;
  uploadedAt: string;
  accountNo: string;
  invoiceNo: string | null;
  invoiceDate: string | null;
  lineCount: number;
};

export type InvoiceDuplicateGroup = {
  key: string;
  matchBy: "invoiceNo" | "invoiceDate";
  accountNo: string;
  invoiceNo: string | null;
  invoiceDate: string | null;
  imports: InvoiceDuplicateGroupMember[];
};

type InvoiceDedupRow = {
  id: string;
  uploadedAt: string;
  accountNo?: string | null;
  invoiceNo?: string | null;
  invoiceDate?: string | null;
  lineCount?: number;
};

function normalizeAccount(value: unknown) {
  return String(value || "").trim().toUpperCase();
}

function normalizeInvoiceNo(value: unknown) {
  return String(value || "").trim();
}

function normalizeInvoiceDate(value: unknown) {
  return String(value || "").trim();
}

export function duplicateKeyForInvoice(row: {
  accountNo?: string | null;
  invoiceNo?: string | null;
  invoiceDate?: string | null;
}): { key: string; matchBy: "invoiceNo" | "invoiceDate" } | null {
  const accountNo = normalizeAccount(row.accountNo);
  const invoiceNo = normalizeInvoiceNo(row.invoiceNo);
  const invoiceDate = normalizeInvoiceDate(row.invoiceDate);
  if (!accountNo) return null;
  if (invoiceNo) return { key: `no:${accountNo}:${invoiceNo}`, matchBy: "invoiceNo" };
  if (invoiceDate) return { key: `date:${accountNo}:${invoiceDate}`, matchBy: "invoiceDate" };
  return null;
}

export function groupDuplicateInvoiceImports(imports: InvoiceDedupRow[]): InvoiceDuplicateGroup[] {
  const groups = new Map<string, InvoiceDuplicateGroup>();

  for (const row of imports) {
    const ident = duplicateKeyForInvoice(row);
    if (!ident) continue;

    const member: InvoiceDuplicateGroupMember = {
      id: row.id,
      uploadedAt: row.uploadedAt,
      accountNo: normalizeAccount(row.accountNo),
      invoiceNo: normalizeInvoiceNo(row.invoiceNo) || null,
      invoiceDate: normalizeInvoiceDate(row.invoiceDate) || null,
      lineCount: Number(row.lineCount) || 0,
    };

    const existing = groups.get(ident.key);
    if (existing) {
      existing.imports.push(member);
      continue;
    }

    groups.set(ident.key, {
      key: ident.key,
      matchBy: ident.matchBy,
      accountNo: member.accountNo,
      invoiceNo: member.invoiceNo,
      invoiceDate: member.invoiceDate,
      imports: [member],
    });
  }

  return Array.from(groups.values())
    .filter((group) => group.imports.length > 1)
    .map((group) => ({
      ...group,
      imports: [...group.imports].sort((a, b) => String(a.uploadedAt).localeCompare(String(b.uploadedAt))),
    }))
    .sort((a, b) => b.imports.length - a.imports.length || a.accountNo.localeCompare(b.accountNo) || a.key.localeCompare(b.key));
}

export async function listDuplicateInvoiceImports(): Promise<{
  groupCount: number;
  extraCount: number;
  groups: InvoiceDuplicateGroup[];
}> {
  const groups = groupDuplicateInvoiceImports(await loadInvoiceImportSummaries());
  const extraCount = groups.reduce((sum, group) => sum + Math.max(0, group.imports.length - 1), 0);
  return { groupCount: groups.length, extraCount, groups };
}

export async function findDuplicateInvoiceImport(input: {
  accountNo: string;
  invoiceNo?: string | null;
  invoiceDate?: string | null;
}): Promise<InvoiceDuplicateMatch | null> {
  const acct = normalizeAccount(input.accountNo);
  const invoiceNo = normalizeInvoiceNo(input.invoiceNo);
  const invoiceDate = normalizeInvoiceDate(input.invoiceDate);
  if (!acct || (!invoiceNo && !invoiceDate)) return null;

  const imports = await loadInvoiceImportSummaries();
  for (const row of imports) {
    if (normalizeAccount(row.accountNo) !== acct) continue;
    const sameNo =
      invoiceNo &&
      normalizeInvoiceNo(row.invoiceNo) &&
      normalizeInvoiceNo(row.invoiceNo) === invoiceNo;
    const sameDate =
      invoiceDate &&
      normalizeInvoiceDate(row.invoiceDate) &&
      normalizeInvoiceDate(row.invoiceDate) === invoiceDate;
    if (sameNo || (sameDate && !invoiceNo)) {
      return {
        id: row.id,
        uploadedAt: row.uploadedAt,
        invoiceNo: row.invoiceNo ?? null,
        invoiceDate: row.invoiceDate ?? null,
      };
    }
  }
  return null;
}

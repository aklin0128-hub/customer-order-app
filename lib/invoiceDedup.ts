import { IMPORT_LIST_KEY, type InvoiceImportRecord } from "@/lib/invoice/invoiceImportRecord";
import { redis } from "@/lib/redis";

export type InvoiceDuplicateMatch = {
  id: string;
  uploadedAt: string;
  invoiceNo: string | null;
  invoiceDate: string | null;
};

export async function findDuplicateInvoiceImport(input: {
  accountNo: string;
  invoiceNo?: string | null;
  invoiceDate?: string | null;
}): Promise<InvoiceDuplicateMatch | null> {
  const acct = String(input.accountNo || "").trim().toUpperCase();
  const invoiceNo = String(input.invoiceNo || "").trim();
  const invoiceDate = String(input.invoiceDate || "").trim();
  if (!acct || (!invoiceNo && !invoiceDate)) return null;

  const imports = (await redis.get<InvoiceImportRecord[]>(IMPORT_LIST_KEY)) || [];
  for (const row of imports) {
    if (String(row.accountNo || "").trim().toUpperCase() !== acct) continue;
    const sameNo =
      invoiceNo &&
      String(row.invoiceNo || "").trim() &&
      String(row.invoiceNo || "").trim() === invoiceNo;
    const sameDate =
      invoiceDate &&
      String(row.invoiceDate || "").trim() &&
      String(row.invoiceDate || "").trim() === invoiceDate;
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

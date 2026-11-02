import { redis } from "@/lib/redis";
import { IMPORT_LIST_KEY, type InvoiceImportRecord, type InvoiceLineWithCatalog } from "@/lib/invoice/invoiceImportRecord";
import {
  compactInvoiceLines,
  invoiceLinesRedisKey,
  toInvoiceImportSummary,
  unknownSkusFromLines,
} from "@/lib/invoice/invoiceImportCompact";

export {
  compactInvoiceLine,
  compactInvoiceLines,
  estimatedJsonBytes,
  invoiceLinesRedisKey,
  toInvoiceImportSummary,
  unknownSkusFromLines,
} from "@/lib/invoice/invoiceImportCompact";

/** Stay well under Upstash REST 10MB command size when writing line sidecars. */
export const INVOICE_LINE_WRITE_CHUNK = 20;
export const INVOICE_LINE_MGET_CHUNK = 50;

export async function loadInvoiceImportSummaries(): Promise<InvoiceImportRecord[]> {
  return (await redis.get<InvoiceImportRecord[]>(IMPORT_LIST_KEY)) || [];
}

export async function hydrateInvoiceImportLines(
  list: InvoiceImportRecord[]
): Promise<InvoiceImportRecord[]> {
  const needIds = list
    .filter((row) => !(row.lines && row.lines.length) && row.id)
    .map((row) => row.id);
  const byId = new Map<string, InvoiceLineWithCatalog[]>();

  for (let i = 0; i < needIds.length; i += INVOICE_LINE_MGET_CHUNK) {
    const chunk = needIds.slice(i, i + INVOICE_LINE_MGET_CHUNK);
    const keys = chunk.map(invoiceLinesRedisKey);
    const rows = (await redis.mget<(InvoiceLineWithCatalog[] | null)[]>(...keys)) || [];
    chunk.forEach((id, idx) => {
      const lines = rows[idx];
      if (Array.isArray(lines)) byId.set(id, compactInvoiceLines(lines));
    });
  }

  return list.map((row) => {
    const inline = row.lines?.length ? compactInvoiceLines(row.lines) : null;
    const lines = inline || byId.get(row.id) || [];
    return {
      ...row,
      lines,
      lineCount: row.lineCount || lines.length,
      unknownSkus: row.unknownSkus?.length ? row.unknownSkus : unknownSkusFromLines(lines),
    };
  });
}

export async function loadInvoiceImportsWithLines(): Promise<InvoiceImportRecord[]> {
  return hydrateInvoiceImportLines(await loadInvoiceImportSummaries());
}

async function writeInvoiceLineChunks(writes: Array<{ key: string; lines: InvoiceLineWithCatalog[] }>) {
  for (let i = 0; i < writes.length; i += INVOICE_LINE_WRITE_CHUNK) {
    const slice = writes.slice(i, i + INVOICE_LINE_WRITE_CHUNK);
    if (slice.length === 1) {
      await redis.set(slice[0].key, slice[0].lines);
      continue;
    }
    const pipe = redis.pipeline();
    for (const row of slice) pipe.set(row.key, row.lines);
    await pipe.exec();
  }
}

/** Persist summaries on the list key and full lines on per-invoice keys. Migrates bloated inline lists. */
export async function saveInvoiceImportList(records: InvoiceImportRecord[]) {
  const summaries = records.map(toInvoiceImportSummary);
  const writes: Array<{ key: string; lines: InvoiceLineWithCatalog[] }> = [];

  for (const rec of records) {
    if (!rec.id || !rec.lines?.length) continue;
    writes.push({
      key: invoiceLinesRedisKey(rec.id),
      lines: compactInvoiceLines(rec.lines),
    });
  }

  await writeInvoiceLineChunks(writes);
  await redis.set(IMPORT_LIST_KEY, summaries);
}

export async function prependInvoiceImport(record: InvoiceImportRecord) {
  const list = await loadInvoiceImportSummaries();
  await saveInvoiceImportList([record, ...list]);
}

export async function deleteInvoiceImport(id: string) {
  const trimmed = String(id || "").trim();
  const list = await loadInvoiceImportSummaries();
  const target = list.find((item) => item.id === trimmed);
  if (!target) return { found: false as const, record: null };

  await saveInvoiceImportList(list.filter((item) => item.id !== trimmed));
  await redis.del(invoiceLinesRedisKey(trimmed));
  return { found: true as const, record: target };
}

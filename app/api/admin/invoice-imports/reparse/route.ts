import { NextResponse } from "next/server";

import { bustAnalyticsCache } from "@/lib/analyticsCache";
import { IMPORT_LIST_KEY, type InvoiceImportRecord } from "@/lib/invoice/invoiceImportRecord";
import { reparseInvoiceImportRecord } from "@/lib/invoice/reparseInvoiceImport";
import { redis } from "@/lib/redis";

export const runtime = "nodejs";
export const maxDuration = 120;
export const dynamic = "force-dynamic";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "536678";

function checkAdmin(req: Request) {
  return (req.headers.get("x-admin-password") || "") === ADMIN_PASSWORD;
}

export async function POST(req: Request) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as { id?: string; ids?: string[] };
    const ids = Array.from(
      new Set(
        [...(Array.isArray(body.ids) ? body.ids : []), body.id]
          .map((value) => String(value || "").trim())
          .filter(Boolean)
      )
    );

    if (ids.length === 0) {
      return NextResponse.json({ error: "Missing import id." }, { status: 400 });
    }

    const list = (await redis.get<InvoiceImportRecord[]>(IMPORT_LIST_KEY)) || [];
    const updated: InvoiceImportRecord[] = [];
    const errors: { id: string; error: string }[] = [];

    for (const id of ids) {
      const index = list.findIndex((item) => item.id === id);
      if (index < 0) {
        errors.push({ id, error: "Invoice import not found." });
        continue;
      }

      try {
        const next = await reparseInvoiceImportRecord(list[index]);
        list[index] = next;
        updated.push(next);
      } catch (error: unknown) {
        errors.push({
          id,
          error: error instanceof Error ? error.message : "Re-parse failed.",
        });
      }
    }

    if (updated.length > 0) {
      await redis.set(IMPORT_LIST_KEY, list);
      bustAnalyticsCache();
    }

    return NextResponse.json({
      success: updated.length > 0,
      updated: updated.map((row) => ({
        id: row.id,
        accountNo: row.accountNo,
        invoiceNo: row.invoiceNo,
        lineCount: row.lineCount,
        warnings: row.warnings,
      })),
      errors,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to re-parse invoice import.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

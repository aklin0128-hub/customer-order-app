import { NextResponse } from "next/server";

import { requireCredit } from "@/lib/creditAuth";
import type { DepositSlipLine, DepositSlipMeta } from "@/lib/credit/depositSlipPdf";
import { buildDepositSlipWorkbook } from "@/lib/credit/depositSlipXlsx";

export const dynamic = "force-dynamic";

function asLines(raw: unknown): DepositSlipLine[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const r = row as Record<string, unknown>;
      const document = String(r.document || "").trim();
      if (!document) return null;
      const amount = Number(r.amount);
      return {
        storeId: String(r.storeId || "").trim() || undefined,
        document,
        amount: Number.isFinite(amount) ? amount : 0,
        checkNo: String(r.checkNo || "").trim() || undefined,
        depositAmount:
          r.depositAmount == null || r.depositAmount === ""
            ? null
            : Number(r.depositAmount),
        checkDate: String(r.checkDate || "").trim() || undefined,
      } satisfies DepositSlipLine;
    })
    .filter(Boolean) as DepositSlipLine[];
}

export async function POST(req: Request) {
  const denied = requireCredit(req);
  if (denied) return denied;

  try {
    const body = await req.json();
    const meta = (body?.meta || {}) as DepositSlipMeta;
    const lines = asLines(body?.lines);
    if (!lines.length) {
      return NextResponse.json({ error: "Select at least one document." }, { status: 400 });
    }

    const xlsx = buildDepositSlipWorkbook({ meta, lines });
    const stamp = new Date().toISOString().slice(0, 10);
    const name = `deposit-slip-${meta.storeId || "store"}-${stamp}`.replace(/[^a-zA-Z0-9._-]+/g, "-");

    return new NextResponse(Buffer.from(xlsx), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${name}.xlsx"`,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to build Excel.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

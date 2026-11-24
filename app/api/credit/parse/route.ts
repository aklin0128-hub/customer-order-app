import { Buffer } from "node:buffer";
import { NextResponse } from "next/server";

import { requireCredit } from "@/lib/creditAuth";
import { parseStatementText } from "@/lib/credit/parseStatement";
import { parseStatementWorkbook } from "@/lib/credit/parseStatementWorkbook";
import { extractInvoiceText } from "@/lib/invoice/extractText";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  const denied = requireCredit(req);
  if (denied) return denied;

  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "Upload a statement file." }, { status: 400 });
    }

    const mime = (file.type || "").split(";")[0]!.trim().toLowerCase();
    const buffer = Buffer.from(await file.arrayBuffer());
    const name = file.name || "statement";

    const isExcel =
      mime.includes("sheet") ||
      mime.includes("excel") ||
      /\.xlsx?$/i.test(name) ||
      mime === "application/vnd.ms-excel";

    if (isExcel) {
      const parsed = parseStatementWorkbook(buffer);
      return NextResponse.json({
        success: true,
        method: "xlsx",
        ...parsed,
      });
    }

    const { text, method } = await extractInvoiceText(buffer, mime || "application/pdf");
    const parsed = parseStatementText(text);
    return NextResponse.json({
      success: true,
      method,
      textPreview: text.slice(0, 4000),
      ...parsed,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to parse statement.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

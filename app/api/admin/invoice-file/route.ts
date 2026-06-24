import { get } from "@vercel/blob";
import { NextResponse } from "next/server";
import {
  IMPORT_LIST_KEY,
  resolveInvoiceBlobPathname,
  type InvoiceImportRecord,
} from "@/lib/invoice/invoiceImportRecord";
import { redis } from "@/lib/redis";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = String(searchParams.get("id") || "").trim();
    const download = searchParams.get("download") === "1";
    if (!id) return NextResponse.json({ error: "Not found." }, { status: 404 });

    const imports = (await redis.get<InvoiceImportRecord[]>(IMPORT_LIST_KEY)) || [];
    const record = imports.find((item) => item.id === id);
    const pathname = record ? resolveInvoiceBlobPathname(record) : null;

    if (!record || !pathname) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const result = await get(pathname, { access: "private" });
    if (!result?.stream) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const headers = new Headers();
    headers.set("Content-Type", result.blob.contentType || record.mimeType || "application/octet-stream");
    headers.set("Cache-Control", "private, max-age=60");
    headers.set("ETag", result.blob.etag);
    if (download) {
      const ext = String(record.mimeType || "").includes("pdf") ? "pdf" : "bin";
      const filename = `${record.accountNo || "invoice"}-${record.invoiceNo || record.id}.${ext}`.replace(/[^\w.-]+/g, "_");
      headers.set("Content-Disposition", `attachment; filename="${filename}"`);
    }

    return new Response(result.stream, { status: 200, headers });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to load invoice." },
      { status: 500 }
    );
  }
}

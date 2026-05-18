import "@/lib/invoice/registerPdfNodePolyfills";

import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { skuIsInCatalog } from "@/lib/invoice/catalogSku";
import { extractInvoiceText } from "@/lib/invoice/extractText";
import {
  IMPORT_LIST_KEY,
  type InvoiceImportRecord,
  type InvoiceLineWithCatalog,
} from "@/lib/invoice/invoiceImportRecord";
import { parseInvoiceText } from "@/lib/invoice/parseInvoiceText";
import { prependOrderHistory } from "@/lib/orderHistory";
import { mergeRecentItems } from "@/lib/recentItems";
import { redis } from "@/lib/redis";

export const runtime = "nodejs";
export const maxDuration = 120;
export const dynamic = "force-dynamic";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "536678";

function checkAdmin(req: Request) {
  return (req.headers.get("x-admin-password") || "") === ADMIN_PASSWORD;
}

function extFromMime(mime: string) {
  const m = mime.split(";")[0]!.toLowerCase().trim();
  if (m === "application/pdf") return "pdf";
  if (m === "image/png") return "png";
  if (m === "image/jpeg" || m === "image/jpg") return "jpg";
  if (m === "image/webp") return "webp";
  if (m === "image/tiff") return "tiff";
  if (m === "image/gif") return "gif";
  return "bin";
}

export async function POST(req: Request) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const accountOverride = String(formData.get("accountNo") || "")
      .trim()
      .toUpperCase();
    const storeName = String(formData.get("storeName") || "").trim();
    const applyRaw = String(formData.get("applyHistory") ?? "true").toLowerCase();
    const applyToHistory = applyRaw !== "false" && applyRaw !== "0";

    if (!file?.size) {
      return NextResponse.json({ error: "Missing invoice file." }, { status: 400 });
    }

    const mime = file.type || "application/octet-stream";
    const arrayBuf = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuf);

    const { text, method } = await extractInvoiceText(buffer, mime);
    const parsed = parseInvoiceText(text);

    const accountNo = accountOverride || parsed.accountNo || "";

    const linesWithFlags: InvoiceLineWithCatalog[] = await Promise.all(
      parsed.lines.map(async (line) => ({
        ...line,
        inCatalog: await skuIsInCatalog(line.sku),
      }))
    );

    const unknownSkus = linesWithFlags.filter((l) => !l.inCatalog).map((l) => l.sku);

    const id = randomUUID();
    const ext = extFromMime(mime);
    const acctSlug = accountNo || "UNKNOWN";
    const blob = await put(`invoices/${acctSlug}-${id}.${ext}`, file, {
      access: "private",
      addRandomSuffix: false,
    });

    let appliedToHistory = false;

    if (applyToHistory && linesWithFlags.length > 0 && accountNo) {
      const itemsForHistory = linesWithFlags.map((l) => ({
        sku: l.sku,
        qty: String(l.qty),
      }));

      await mergeRecentItems(accountNo, itemsForHistory);

      const orderRefSafe = parsed.invoiceNo
        ? `INV-${String(parsed.invoiceNo).replace(/[^\w\-]+/g, "_")}`
        : `INV-${id.slice(0, 8)}`;

      await prependOrderHistory({
        accountNo,
        storeName: storeName || "(Invoice import)",
        orderRef: orderRefSafe.slice(0, 80),
        items: itemsForHistory,
        note: [
          parsed.supplierOrderNo ? `Vendor order ${parsed.supplierOrderNo}` : null,
          parsed.invoiceDate ? `Invoice date ${parsed.invoiceDate}` : null,
          `Source: invoice upload (${method})`,
        ]
          .filter(Boolean)
          .join(" · "),
        phone: "",
        createdAt: new Date().toISOString(),
        source: "invoice_upload",
        invoiceBlobUrl: blob.url,
      });

      appliedToHistory = true;
    }

    const record: InvoiceImportRecord = {
      id,
      uploadedAt: new Date().toISOString(),
      accountNo,
      invoiceNo: parsed.invoiceNo,
      supplierOrderNo: parsed.supplierOrderNo,
      invoiceDate: parsed.invoiceDate,
      blobUrl: blob.url,
      blobPathname: blob.pathname,
      mimeType: mime,
      extractMethod: method,
      lineCount: linesWithFlags.length,
      lines: linesWithFlags,
      warnings: [...parsed.warnings],
      appliedToHistory,
    };

    if (!accountNo) {
      record.warnings.unshift("No customer account resolved — skipped updating order history / recent items.");
    } else if (linesWithFlags.length === 0) {
      record.warnings.unshift("Parsed zero lines — history not updated.");
    } else if (!applyToHistory) {
      record.warnings.push("Applied to history skipped (unchecked in form).");
    }

    const list =
      (await redis.get<InvoiceImportRecord[]>(IMPORT_LIST_KEY)) || [];
    const nextList = [record, ...list];
    await redis.set(IMPORT_LIST_KEY, nextList);

    return NextResponse.json({
      success: true,
      record,
      parsedTextChars: text.length,
      unknownSkus,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to process invoice." },
      { status: 500 }
    );
  }
}

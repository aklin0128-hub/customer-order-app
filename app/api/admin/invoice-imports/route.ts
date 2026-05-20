import { NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { IMPORT_LIST_KEY, type InvoiceImportRecord } from "@/lib/invoice/invoiceImportRecord";
import { bustAnalyticsCache } from "@/lib/analyticsCache";
import { redis } from "@/lib/redis";

export const dynamic = "force-dynamic";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "536678";

function checkAdmin(req: Request) {
  return (req.headers.get("x-admin-password") || "") === ADMIN_PASSWORD;
}

export async function GET(req: Request) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const list = (await redis.get<InvoiceImportRecord[]>(IMPORT_LIST_KEY)) || [];
    return NextResponse.json({ success: true, imports: list });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to load imports." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const url = new URL(req.url);
    const id = String(url.searchParams.get("id") || "").trim();

    if (!id) {
      return NextResponse.json({ error: "Missing import id." }, { status: 400 });
    }

    const list = (await redis.get<InvoiceImportRecord[]>(IMPORT_LIST_KEY)) || [];
    const target = list.find((item) => item.id === id);

    if (!target) {
      return NextResponse.json({ error: "Invoice import not found." }, { status: 404 });
    }

    let blobDeleteWarning = "";
    if (target.blobUrl) {
      try {
        await del(target.blobUrl);
      } catch (error: any) {
        blobDeleteWarning = error?.message || "Invoice file delete failed.";
      }
    }

    await redis.set(
      IMPORT_LIST_KEY,
      list.filter((item) => item.id !== id)
    );
    bustAnalyticsCache();

    return NextResponse.json({
      success: true,
      deletedId: id,
      warning: blobDeleteWarning || undefined,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to delete invoice import." },
      { status: 500 }
    );
  }
}

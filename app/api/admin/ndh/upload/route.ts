import { Buffer } from "node:buffer";
import { NextResponse } from "next/server";
import { bulkUpsertNdhRecords, enrichNdhRecords } from "@/lib/ndh";
import { parseNdhUpload } from "@/lib/ndhListParse";
import { bustServerDataCache, SERVER_CACHE } from "@/lib/serverDataCache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "536678";

function checkAdmin(req: Request) {
  return (req.headers.get("x-admin-password") || "") === ADMIN_PASSWORD;
}

export async function POST(req: Request) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const contentType = req.headers.get("content-type") || "";
    let text = "";
    let file: { buffer: Buffer; name?: string; type?: string } | undefined;
    let replaceAll = false;
    let defaults = {
      clearancePrice: "",
      expiryDate: "",
      clearanceQty: "",
      note: "Sell as is",
    };

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      text = String(form.get("text") || "");
      replaceAll = String(form.get("replaceAll") || "").toLowerCase() === "true";
      defaults = {
        clearancePrice: String(form.get("clearancePrice") || "").trim(),
        expiryDate: String(form.get("expiryDate") || "").trim(),
        clearanceQty: String(form.get("clearanceQty") || "").trim(),
        note: String(form.get("note") || "Sell as is").trim() || "Sell as is",
      };
      const uploaded = form.get("file");
      if (uploaded instanceof File && uploaded.size > 0) {
        file = {
          buffer: Buffer.from(await uploaded.arrayBuffer()),
          name: uploaded.name,
          type: uploaded.type,
        };
      }
    } else {
      const body = await req.json().catch(() => ({}));
      text = String(body?.text || "");
      replaceAll = Boolean(body?.replaceAll);
      defaults = {
        clearancePrice: String(body?.clearancePrice || "").trim(),
        expiryDate: String(body?.expiryDate || "").trim(),
        clearanceQty: String(body?.clearanceQty || "").trim(),
        note: String(body?.note || "Sell as is").trim() || "Sell as is",
      };
    }

    const parsed = parseNdhUpload({ text, file, defaults });
    if (parsed.length === 0) {
      return NextResponse.json({ error: "No SKUs found in the list." }, { status: 400 });
    }

    const result = await bulkUpsertNdhRecords(parsed, { replaceAll });
    bustServerDataCache(SERVER_CACHE.ndh);

    return NextResponse.json({
      success: true,
      saved: result.saved,
      errorCount: result.errors.length,
      errors: result.errors.slice(0, 40),
      items: enrichNdhRecords(result.records),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to upload NDH list.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";

import { attachNewItemPdfToProduct } from "@/lib/attachNewItemPdf";

export const dynamic = "force-dynamic";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "536678";
const MAX_PDF_BYTES = 12 * 1024 * 1024;

function checkAdmin(req: Request) {
  return (req.headers.get("x-admin-password") || "") === ADMIN_PASSWORD;
}

function parseClientPayload(raw: string | null | undefined) {
  if (!raw) return { sku: "" };
  try {
    const parsed = JSON.parse(raw) as { sku?: string };
    return { sku: String(parsed?.sku || "").trim().toUpperCase() };
  } catch {
    return { sku: "" };
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!checkAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        if (!checkAdmin(request)) {
          throw new Error("Unauthorized.");
        }

        const { sku } = parseClientPayload(clientPayload);
        if (!sku) {
          throw new Error("Missing SKU.");
        }

        const expectedPrefix = `new-item-pdfs/${sku}`;
        if (!pathname.startsWith(expectedPrefix)) {
          throw new Error("Invalid upload path.");
        }

        return {
          allowedContentTypes: ["application/pdf", "application/x-pdf"],
          maximumSizeInBytes: MAX_PDF_BYTES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ sku }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        const { sku } = parseClientPayload(tokenPayload);
        if (!sku) throw new Error("Missing SKU in upload token.");
        await attachNewItemPdfToProduct(sku, blob.pathname);
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to upload PDF.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

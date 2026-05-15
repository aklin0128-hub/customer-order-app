import { Buffer } from "node:buffer";

import "@/lib/invoice/registerPdfNodePolyfills";

export type ExtractMethod = "pdf" | "ocr";

export async function extractInvoiceText(
  buffer: Buffer,
  mimeType: string
): Promise<{ text: string; method: ExtractMethod }> {
  const mt = (mimeType || "").split(";")[0]!.trim().toLowerCase();

  if (mt === "application/pdf" || mt === "application/x-pdf") {
    const mod = (await import("pdf-parse")) as {
      PDFParse?: new (options: { data: Uint8Array }) => {
        getText: () => Promise<{ text?: string }>;
        destroy?: () => Promise<void>;
      };
    };
    const PDFParse = mod.PDFParse;
    if (!PDFParse) {
      throw new Error(
        `pdf-parse failed to load. Available exports: ${Object.keys(mod).join(", ") || "(none)"}`
      );
    }

    // Copy the Buffer into a standalone Uint8Array; pdf.js may take ownership of TypedArrays.
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try {
      const result = await parser.getText();
      return { text: String(result.text ?? ""), method: "pdf" };
    } finally {
      await parser.destroy?.();
    }
  }

  if (
    mt === "image/png" ||
    mt === "image/jpeg" ||
    mt === "image/jpg" ||
    mt === "image/webp" ||
    mt === "image/tiff" ||
    mt === "image/gif"
  ) {
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker(["eng", "kor", "vie"]);
    try {
      const { data } = await worker.recognize(buffer);
      return { text: String(data.text ?? "").trim(), method: "ocr" };
    } finally {
      await worker.terminate();
    }
  }

  throw new Error(`Unsupported type: ${mimeType}. Upload PDF, PNG, or JPEG.`);
}

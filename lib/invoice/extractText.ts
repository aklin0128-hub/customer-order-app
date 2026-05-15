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
      default?: (b: Buffer) => Promise<{ text?: string }>;
    };
    const pdfParse = mod.default;
    if (!pdfParse) throw new Error("pdf-parse failed to load.");

    const result = await pdfParse(buffer);
    return { text: String(result.text ?? ""), method: "pdf" };
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

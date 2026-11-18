import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import { MAX_DEPOSIT_SLIP_LINES } from "@/lib/credit/limits";

export type DepositSlipLine = {
  storeId?: string;
  document: string;
  amount: number;
  checkNo?: string;
  depositAmount?: number | null;
  checkDate?: string;
};

export type DepositSlipMeta = {
  title?: string;
  name?: string;
  code?: string;
  date?: string;
  storeId?: string;
};

function money(n: number) {
  const abs = Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return n < 0 ? `($${abs})` : `$${abs}`;
}

export async function buildDepositSlipPdf(opts: {
  meta: DepositSlipMeta;
  lines: DepositSlipLine[];
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const pageWidth = 792; // landscape letter
  const pageHeight = 612;
  const margin = 24;
  const headerBlock = 58;
  const colHeaderBlock = 22;
  const footerReserve = 34;

  // No per-row STORE ID — show once, large, in the yellow header.
  const cols = [260, 120, 120, 120, 110];
  const headers = ["INVOICE #", "Invoice Amount", "Check NO", "Deposit Amount", "Check date"];

  const rowsPerPage = Math.min(MAX_DEPOSIT_SLIP_LINES, Math.max(opts.lines.length, 1));
  const contentTop = pageHeight - margin - headerBlock - colHeaderBlock;
  const contentBottom = margin + footerReserve;
  const available = Math.max(contentTop - contentBottom, 80);
  const rowStep = Math.min(16, Math.max(8.2, available / rowsPerPage));
  const bodySize = rowStep >= 14 ? 9 : rowStep >= 11 ? 8 : 7;

  let page = pdf.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;
  let pageLineCount = 0;

  const drawHeader = () => {
    const storeLabel = String(opts.meta.storeId || "").trim().toUpperCase() || "—";
    const headerH = 48;
    page.drawRectangle({
      x: margin,
      y: y - headerH,
      width: pageWidth - margin * 2,
      height: headerH,
      color: rgb(1, 0.95, 0.2),
    });

    // Store ID badge — right side, high contrast
    const badgeW = 168;
    const badgeH = 36;
    const badgeX = pageWidth - margin - 10 - badgeW;
    const badgeY = y - headerH + 6;
    page.drawRectangle({
      x: badgeX,
      y: badgeY,
      width: badgeW,
      height: badgeH,
      color: rgb(0.75, 0.05, 0.05),
    });
    page.drawText("STORE ID", {
      x: badgeX + 10,
      y: badgeY + 24,
      size: 8,
      font: bold,
      color: rgb(1, 0.92, 0.92),
    });
    page.drawText(storeLabel.slice(0, 14), {
      x: badgeX + 10,
      y: badgeY + 8,
      size: 16,
      font: bold,
      color: rgb(1, 1, 1),
    });

    page.drawText(opts.meta.title || "PNC BANK CHECK DEPOSIT (SE)", {
      x: margin + 10,
      y: y - 16,
      size: 13,
      font: bold,
      color: rgb(0.75, 0.05, 0.05),
    });
    page.drawText(`Name: ${opts.meta.name || ""}`, {
      x: margin + 10,
      y: y - 36,
      size: 9,
      font,
      color: rgb(0.1, 0.1, 0.1),
    });
    page.drawText(`Date: ${opts.meta.date || ""}`, {
      x: margin + 220,
      y: y - 36,
      size: 9,
      font,
    });
    page.drawText(`Code: ${opts.meta.code || ""}`, {
      x: margin + 380,
      y: y - 36,
      size: 9,
      font,
    });
    y -= headerBlock;

    let x = margin;
    for (let i = 0; i < headers.length; i++) {
      page.drawText(headers[i]!, { x, y, size: 8, font: bold });
      x += cols[i]!;
    }
    y -= 12;
    page.drawLine({
      start: { x: margin, y },
      end: { x: pageWidth - margin, y },
      thickness: 1,
      color: rgb(0.7, 0.7, 0.7),
    });
    y -= 10;
    pageLineCount = 0;
  };

  drawHeader();

  let invoiceTotal = 0;
  let depositTotal = 0;
  const seenChecks = new Set<string>();

  for (const line of opts.lines) {
    if (pageLineCount >= MAX_DEPOSIT_SLIP_LINES || y < margin + footerReserve) {
      page = pdf.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
      drawHeader();
    }

    invoiceTotal += line.amount;
    const checkKey = `${line.checkNo || ""}|${line.depositAmount ?? ""}|${line.checkDate || ""}`;
    const showCheck = Boolean(line.checkNo) && !seenChecks.has(checkKey);
    if (showCheck) {
      seenChecks.add(checkKey);
      if (typeof line.depositAmount === "number") depositTotal += line.depositAmount;
    }

    const values = [
      line.document,
      money(line.amount),
      showCheck && line.checkNo ? `# ${line.checkNo}` : "",
      showCheck && typeof line.depositAmount === "number" ? money(line.depositAmount) : "",
      showCheck ? line.checkDate || "" : "",
    ];

    let x = margin;
    for (let i = 0; i < values.length; i++) {
      const text = values[i]!;
      const isNeg = text.includes("(");
      page.drawText(text.slice(0, 48), {
        x,
        y,
        size: bodySize,
        font,
        color: isNeg ? rgb(0.75, 0.05, 0.05) : rgb(0.1, 0.1, 0.1),
      });
      x += cols[i]!;
    }
    y -= rowStep;
    pageLineCount += 1;
  }

  y -= 4;
  page.drawRectangle({
    x: margin,
    y: y - 4,
    width: pageWidth - margin * 2,
    height: 18,
    color: rgb(1, 0.95, 0.2),
  });
  page.drawText("TOTAL", { x: margin + 10, y, size: 9, font: bold });
  page.drawText(money(invoiceTotal), { x: margin + cols[0]!, y, size: 9, font: bold });
  page.drawText(money(depositTotal), {
    x: margin + cols[0]! + cols[1]! + cols[2]!,
    y,
    size: 9,
    font: bold,
  });

  return pdf.save();
}

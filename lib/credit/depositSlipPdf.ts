import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

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
  const margin = 28;
  let page = pdf.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  const drawHeader = () => {
    page.drawRectangle({
      x: margin,
      y: y - 42,
      width: pageWidth - margin * 2,
      height: 42,
      color: rgb(1, 0.95, 0.2),
    });
    page.drawText(opts.meta.title || "PNC BANK CHECK DEPOSIT (SE)", {
      x: margin + 10,
      y: y - 18,
      size: 14,
      font: bold,
      color: rgb(0.75, 0.05, 0.05),
    });
    page.drawText(`Name: ${opts.meta.name || ""}`, {
      x: margin + 10,
      y: y - 34,
      size: 10,
      font,
      color: rgb(0.1, 0.1, 0.1),
    });
    page.drawText(`Date: ${opts.meta.date || ""}`, {
      x: margin + 260,
      y: y - 34,
      size: 10,
      font,
    });
    page.drawText(`Code: ${opts.meta.code || ""}`, {
      x: margin + 420,
      y: y - 34,
      size: 10,
      font,
    });
    y -= 58;

    const headers = ["STORE ID", "INVOICE #", "Invoice Amount", "Check NO", "Deposit Amount", "Check date"];
    const cols = [70, 220, 110, 110, 110, 90];
    let x = margin;
    for (let i = 0; i < headers.length; i++) {
      page.drawText(headers[i]!, { x, y, size: 9, font: bold });
      x += cols[i]!;
    }
    y -= 14;
    page.drawLine({
      start: { x: margin, y },
      end: { x: pageWidth - margin, y },
      thickness: 1,
      color: rgb(0.7, 0.7, 0.7),
    });
    y -= 12;
  };

  drawHeader();

  const cols = [70, 220, 110, 110, 110, 90];
  let invoiceTotal = 0;
  let depositTotal = 0;
  const seenChecks = new Set<string>();

  for (const line of opts.lines) {
    if (y < margin + 40) {
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
      line.storeId || opts.meta.storeId || "",
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
      page.drawText(text.slice(0, 42), {
        x,
        y,
        size: 9,
        font,
        color: isNeg ? rgb(0.75, 0.05, 0.05) : rgb(0.1, 0.1, 0.1),
      });
      x += cols[i]!;
    }
    y -= 16;
  }

  y -= 8;
  page.drawRectangle({
    x: margin,
    y: y - 6,
    width: pageWidth - margin * 2,
    height: 22,
    color: rgb(1, 0.95, 0.2),
  });
  page.drawText("TOTAL", { x: margin + 10, y, size: 10, font: bold });
  page.drawText(money(invoiceTotal), { x: margin + 300, y, size: 10, font: bold });
  page.drawText(money(depositTotal), { x: margin + 520, y, size: 10, font: bold });

  return pdf.save();
}

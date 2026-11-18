import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

import {
  formatSalesCreditMoney,
  salesCreditTotal,
  SALES_CREDIT_EMAIL,
  type SalesCreditPhoto,
  type SalesCreditRequestForm,
} from "@/lib/credit/salesCreditRequest";

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 36;
const BLACK = rgb(0, 0, 0);
const LABEL_BG = rgb(0.741, 0.843, 0.933);
const HEADER_BG = rgb(0.89, 0.89, 0.89);
const LINK_BLUE = rgb(0.05, 0.33, 0.8);
const WHITE = rgb(1, 1, 1);

function wrapText(font: PDFFont, text: string, size: number, maxWidth: number, maxLines = 3) {
  const raw = String(text || "").replace(/\s+/g, " ").trim();
  if (!raw) return [] as string[];
  const words = raw.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    current = word;
    if (lines.length >= maxLines) break;
  }
  if (current && lines.length < maxLines) lines.push(current);
  if (lines.length === maxLines && (words.length > 0 || current)) {
    let last = lines[maxLines - 1] || "";
    while (last.length > 1 && font.widthOfTextAtSize(`${last}…`, size) > maxWidth) {
      last = last.slice(0, -1);
    }
    lines[maxLines - 1] = font.widthOfTextAtSize(last, size) <= maxWidth ? `${last}…`.replace("……", "…") : last;
  }
  return lines;
}

function drawCell(
  page: PDFPage,
  x: number,
  y: number,
  w: number,
  h: number,
  fill = WHITE
) {
  page.drawRectangle({
    x,
    y,
    width: w,
    height: h,
    color: fill,
    borderColor: BLACK,
    borderWidth: 0.8,
  });
}

function drawCentered(
  page: PDFPage,
  text: string,
  font: PDFFont,
  size: number,
  x: number,
  y: number,
  w: number,
  h: number,
  color = BLACK
) {
  const t = String(text || "");
  if (!t) return;
  const tw = font.widthOfTextAtSize(t, size);
  page.drawText(t, {
    x: x + Math.max(4, (w - tw) / 2),
    y: y + (h - size) / 2 - 1,
    size,
    font,
    color,
  });
}

function drawRight(
  page: PDFPage,
  text: string,
  font: PDFFont,
  size: number,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const t = String(text || "");
  if (!t) return;
  const tw = font.widthOfTextAtSize(t, size);
  page.drawText(t, {
    x: x + w - tw - 8,
    y: y + (h - size) / 2 - 1,
    size,
    font,
    color: BLACK,
  });
}

function drawLeft(
  page: PDFPage,
  text: string,
  font: PDFFont,
  size: number,
  x: number,
  y: number,
  h: number,
  color = BLACK,
  pad = 8
) {
  const t = String(text || "");
  if (!t) return;
  page.drawText(t, {
    x: x + pad,
    y: y + (h - size) / 2 - 1,
    size,
    font,
    color,
  });
}

export async function buildSalesCreditRequestPdf(opts: {
  form: SalesCreditRequestForm;
  photos?: SalesCreditPhoto[];
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage([PAGE_W, PAGE_H]);

  const tableW = PAGE_W - MARGIN * 2;
  const col1 = 168;
  const col2 = 118;
  const col3 = tableW - col1 - col2;
  let y = PAGE_H - MARGIN;

  const headerH = 22;
  y -= headerH;
  drawCell(page, MARGIN, y, tableW, headerH, HEADER_BG);
  drawLeft(page, "Sales Credit Request", bold, 12, MARGIN, y, headerH, BLACK, 8);

  const fields: [string, string, boolean?][] = [
    ["Sales ID #", opts.form.salesId],
    ["Customer #", opts.form.customerNo],
    ["Customer Name", opts.form.customerName],
    ["Date of Request", opts.form.dateOfRequest],
    ["Customer email address", SALES_CREDIT_EMAIL, true],
    ["Invoice #", opts.form.invoiceNo],
    ["Invoice Date:", opts.form.invoiceDate],
  ];

  const fieldH = 20;
  for (const [label, value, isEmail] of fields) {
    y -= fieldH;
    drawCell(page, MARGIN, y, col1, fieldH, LABEL_BG);
    drawCell(page, MARGIN + col1, y, col2 + col3, fieldH, WHITE);
    drawRight(page, label, bold, 9, MARGIN, y, col1, fieldH);
    if (isEmail && value) {
      drawCentered(page, value, font, 9, MARGIN + col1, y, col2 + col3, fieldH, LINK_BLUE);
    } else {
      drawCentered(page, value, font, 10, MARGIN + col1, y, col2 + col3, fieldH);
    }
  }

  const reasonHeaderH = 26;
  y -= reasonHeaderH;
  drawCell(page, MARGIN, y, col1, reasonHeaderH, LABEL_BG);
  drawCell(page, MARGIN + col1, y, col2, reasonHeaderH, LABEL_BG);
  drawCell(page, MARGIN + col1 + col2, y, col3, reasonHeaderH, LABEL_BG);
  drawCentered(page, "Reason for Credit", bold, 9, MARGIN, y, col1, reasonHeaderH);
  drawCentered(page, "Amount", bold, 9, MARGIN + col1, y, col2, reasonHeaderH);
  drawCentered(page, "Item Detail (Qty) - Per Item Credit", bold, 9, MARGIN + col1 + col2, y, col3, reasonHeaderH);

  const rowH = 28;
  for (const line of opts.form.lines) {
    y -= rowH;
    drawCell(page, MARGIN, y, col1, rowH, WHITE);
    drawCell(page, MARGIN + col1, y, col2, rowH, WHITE);
    drawCell(page, MARGIN + col1 + col2, y, col3, rowH, WHITE);
    drawRight(page, line.reason, font, 9, MARGIN, y, col1, rowH);
    if (line.amount != null && Number.isFinite(line.amount) && String(line.amount) !== "") {
      drawCentered(page, formatSalesCreditMoney(line.amount), font, 10, MARGIN + col1, y, col2, rowH);
    }
    const detailLines = wrapText(font, line.itemDetail, 8, col3 - 12, 3);
    if (detailLines.length === 1) {
      drawLeft(page, detailLines[0] || "", font, 8, MARGIN + col1 + col2, y, rowH);
    } else if (detailLines.length > 1) {
      const lineH = 9;
      let ty = y + rowH - 11;
      for (const dl of detailLines) {
        page.drawText(dl, {
          x: MARGIN + col1 + col2 + 8,
          y: ty,
          size: 8,
          font,
          color: BLACK,
        });
        ty -= lineH;
      }
    }
  }

  const totalH = 22;
  y -= totalH;
  const total = salesCreditTotal(opts.form.lines);
  drawCell(page, MARGIN, y, col1, totalH, LABEL_BG);
  drawCell(page, MARGIN + col1, y, col2, totalH, LABEL_BG);
  drawCell(page, MARGIN + col1 + col2, y, col3, totalH, LABEL_BG);
  drawRight(page, "Total", bold, 10, MARGIN, y, col1, totalH);
  drawCentered(page, formatSalesCreditMoney(total), bold, 10, MARGIN + col1, y, col2, totalH);

  const photoHeaderH = 20;
  y -= photoHeaderH;
  drawCell(page, MARGIN, y, tableW, photoHeaderH, LABEL_BG);
  drawLeft(page, "Photo", bold, 10, MARGIN, y, photoHeaderH, BLACK, 8);

  const photoH = Math.max(y - MARGIN, 120);
  y -= photoH;
  drawCell(page, MARGIN, y, tableW, photoH, WHITE);

  const photos = opts.photos || [];
  if (!photos.length) {
    drawLeft(page, "attach here", font, 10, MARGIN, y + photoH - 28, 20, rgb(0.35, 0.35, 0.35), 10);
  } else {
    const pad = 8;
    const maxEmbed = Math.min(photos.length, 6);
    const gap = 8;
    const cellW = (tableW - pad * 2 - gap * (maxEmbed - 1)) / maxEmbed;
    const cellH = photoH - pad * 2;
    for (let i = 0; i < maxEmbed; i++) {
      const photo = photos[i]!;
      try {
        const img = await embedPhoto(pdf, photo.bytes);
        const dims = img.scaleToFit(cellW, cellH);
        const ix = MARGIN + pad + i * (cellW + gap) + (cellW - dims.width) / 2;
        const iy = y + pad + (cellH - dims.height) / 2;
        page.drawImage(img, { x: ix, y: iy, width: dims.width, height: dims.height });
      } catch {
        /* skip unreadable photos */
      }
    }
  }

  return pdf.save();
}

async function embedPhoto(pdf: PDFDocument, bytes: Uint8Array) {
  try {
    return await pdf.embedJpg(bytes);
  } catch {
    return pdf.embedPng(bytes);
  }
}

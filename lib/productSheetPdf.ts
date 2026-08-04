import { readFile } from "node:fs/promises";
import path from "node:path";

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";

import type { ProductSheet, ProductSheetResolvedItem } from "@/lib/productSheet";

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 36;
const COLS = 3;
const ROWS = 4;
const GAP = 10;

type BuiltCard = ProductSheetResolvedItem & {
  image?: PDFImage;
};

async function tryReadLocalProductImage(sku: string): Promise<Uint8Array | null> {
  // Avoid a static path.join(..., `${sku}.jpg`) pattern so Turbopack does not
  // file-trace every file under public/product into the serverless bundle.
  const segments = ["public", "product", `${String(sku || "").trim()}.jpg`];
  const file = [process.cwd(), ...segments].join(path.sep);
  try {
    return new Uint8Array(await readFile(file));
  } catch {
    return null;
  }
}

async function tryFetchImageBytes(imageUrl: string, origin?: string): Promise<Uint8Array | null> {
  const raw = String(imageUrl || "").trim();
  if (!raw) return null;

  let url = raw;
  if (raw.startsWith("/")) {
    if (!origin) return null;
    url = `${origin.replace(/\/$/, "")}${raw}`;
  }
  if (!/^https?:\/\//i.test(url)) return null;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    return buf.length > 0 ? buf : null;
  } catch {
    return null;
  }
}

async function embedProductImage(
  pdf: PDFDocument,
  item: ProductSheetResolvedItem,
  origin?: string
): Promise<PDFImage | undefined> {
  const local = await tryReadLocalProductImage(item.sku);
  const remote = local ? null : await tryFetchImageBytes(item.imageUrl || "", origin);
  const bytes = local || remote;
  if (!bytes) return undefined;

  try {
    return await pdf.embedJpg(bytes);
  } catch {
    try {
      return await pdf.embedPng(bytes);
    } catch {
      return undefined;
    }
  }
}

function drawText(
  page: PDFPage,
  font: PDFFont,
  text: string,
  x: number,
  y: number,
  size: number,
  color = rgb(0.12, 0.14, 0.18),
  maxWidth?: number
) {
  const value = String(text || "");
  if (!value) return 0;
  let line = value;
  if (maxWidth) {
    while (line.length > 1 && font.widthOfTextAtSize(line, size) > maxWidth) {
      line = `${line.slice(0, -2)}…`;
    }
  }
  page.drawText(line, { x, y, size, font, color });
  return font.heightAtSize(size);
}

function cardWidth() {
  const usable = PAGE_WIDTH - MARGIN * 2 - GAP * (COLS - 1);
  return usable / COLS;
}

function cardHeight(headerBottom: number) {
  const usable = headerBottom - MARGIN - GAP * (ROWS - 1);
  return usable / ROWS;
}

function drawHeader(
  page: PDFPage,
  font: PDFFont,
  bold: PDFFont,
  sheet: ProductSheet,
  pageIndex: number,
  pageCount: number
) {
  const title = sheet.title || "Product sheet";
  drawText(page, bold, title, MARGIN, PAGE_HEIGHT - 40, 18, rgb(0.08, 0.1, 0.14));

  const metaParts = [
    sheet.customerLabel ? `For: ${sheet.customerLabel}` : "",
    sheet.accountNo ? `Acct ${sheet.accountNo}` : "",
    new Date().toISOString().slice(0, 10),
  ].filter(Boolean);
  drawText(page, font, metaParts.join("  ·  "), MARGIN, PAGE_HEIGHT - 58, 10, rgb(0.35, 0.4, 0.48));

  if (sheet.note) {
    drawText(page, font, sheet.note, MARGIN, PAGE_HEIGHT - 74, 9, rgb(0.4, 0.45, 0.52), PAGE_WIDTH - MARGIN * 2 - 80);
  }

  drawText(
    page,
    font,
    `Page ${pageIndex + 1} / ${pageCount}`,
    PAGE_WIDTH - MARGIN - 70,
    PAGE_HEIGHT - 40,
    9,
    rgb(0.45, 0.5, 0.56)
  );

  page.drawLine({
    start: { x: MARGIN, y: PAGE_HEIGHT - 88 },
    end: { x: PAGE_WIDTH - MARGIN, y: PAGE_HEIGHT - 88 },
    thickness: 1,
    color: rgb(0.85, 0.87, 0.9),
  });
}

function drawCard(
  page: PDFPage,
  font: PDFFont,
  bold: PDFFont,
  card: BuiltCard,
  x: number,
  y: number,
  w: number,
  h: number
) {
  page.drawRectangle({
    x,
    y,
    width: w,
    height: h,
    borderColor: rgb(0.86, 0.88, 0.9),
    borderWidth: 1,
    color: rgb(1, 1, 1),
  });

  const pad = 8;
  const imageBox = Math.min(72, h - 58, w - pad * 2);
  if (card.image) {
    const dims = card.image.scale(1);
    const scale = Math.min(imageBox / dims.width, imageBox / dims.height);
    const iw = dims.width * scale;
    const ih = dims.height * scale;
    page.drawImage(card.image, {
      x: x + (w - iw) / 2,
      y: y + h - pad - ih,
      width: iw,
      height: ih,
    });
  } else {
    page.drawRectangle({
      x: x + (w - imageBox) / 2,
      y: y + h - pad - imageBox,
      width: imageBox,
      height: imageBox,
      color: rgb(0.94, 0.95, 0.96),
    });
  }

  let textY = y + h - pad - imageBox - 14;
  drawText(page, bold, card.sku, x + pad, textY, 10, rgb(0.1, 0.12, 0.16), w - pad * 2);
  textY -= 12;
  if (card.brand) {
    drawText(page, font, card.brand, x + pad, textY, 8, rgb(0.4, 0.45, 0.5), w - pad * 2);
    textY -= 11;
  }
  if (card.name) {
    drawText(page, font, card.name, x + pad, textY, 8, rgb(0.2, 0.22, 0.26), w - pad * 2);
    textY -= 11;
  }
  const detail = [card.size, card.priceLabel].filter(Boolean).join("  ·  ");
  if (detail) {
    drawText(page, bold, detail, x + pad, textY, 8, rgb(0.12, 0.35, 0.28), w - pad * 2);
    textY -= 11;
  }
  if (card.note) {
    drawText(page, font, card.note, x + pad, Math.max(y + 8, textY), 7, rgb(0.45, 0.35, 0.2), w - pad * 2);
  }
}

export async function buildProductSheetPdf(options: {
  sheet: ProductSheet;
  items: ProductSheetResolvedItem[];
  origin?: string;
}): Promise<Uint8Array> {
  const { sheet, items, origin } = options;
  if (!items.length) {
    throw new Error("Add at least one product before generating a PDF.");
  }

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const built: BuiltCard[] = [];
  for (const item of items) {
    const image = await embedProductImage(pdf, item, origin);
    built.push({ ...item, image });
  }

  const perPage = COLS * ROWS;
  const pageCount = Math.max(1, Math.ceil(built.length / perPage));
  const headerBottom = PAGE_HEIGHT - 100;
  const w = cardWidth();
  const h = cardHeight(headerBottom);

  for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
    const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    drawHeader(page, font, bold, sheet, pageIndex, pageCount);

    const slice = built.slice(pageIndex * perPage, pageIndex * perPage + perPage);
    slice.forEach((card, idx) => {
      const col = idx % COLS;
      const row = Math.floor(idx / COLS);
      const x = MARGIN + col * (w + GAP);
      const y = headerBottom - (row + 1) * h - row * GAP;
      drawCard(page, font, bold, card, x, y, w, h);
    });
  }

  return pdf.save();
}

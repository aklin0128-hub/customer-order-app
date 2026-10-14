import { readFile } from "node:fs/promises";
import path from "node:path";

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";

import type { ProductSheet, ProductSheetResolvedItem } from "@/lib/productSheet";

/** US Letter — compact image card grid (catalog-style), aim for ≤3 pages. */
const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN_X = 22;
const MARGIN_Y = 20;
const HEADER_H = 48;
const GAP_X = 6;
const GAP_Y = 8;
const CARD_PAD = 5;
const MAX_PAGES_TARGET = 3;

const COLOR = {
  text: rgb(0.07, 0.09, 0.15),
  brand: rgb(0.22, 0.26, 0.32),
  name: rgb(0.29, 0.33, 0.39),
  size: rgb(0.42, 0.45, 0.49),
  price: rgb(0.06, 0.46, 0.43),
  note: rgb(0.45, 0.35, 0.2),
  meta: rgb(0.35, 0.4, 0.48),
  border: rgb(0.9, 0.91, 0.93),
  pageBg: rgb(0.97, 0.98, 0.99),
  imageBg: rgb(0.96, 0.97, 0.98),
  white: rgb(1, 1, 1),
};

type BuiltCard = ProductSheetResolvedItem & {
  image?: PDFImage;
};

export type ProductSheetPdfGrid = { cols: number; rows: number };

/** Pick denser grids as item count grows so sheets usually stay within 3 pages. */
export function pickProductSheetGrid(itemCount: number): ProductSheetPdfGrid {
  const n = Math.max(0, itemCount);
  const options: ProductSheetPdfGrid[] = [
    { cols: 4, rows: 3 }, // 12 / page
    { cols: 4, rows: 4 }, // 16 / page
    { cols: 5, rows: 4 }, // 20 / page
    { cols: 5, rows: 5 }, // 25 / page
  ];
  for (const opt of options) {
    const perPage = opt.cols * opt.rows;
    if (perPage <= 0) continue;
    if (Math.ceil(n / perPage) <= MAX_PAGES_TARGET) return opt;
  }
  return options[options.length - 1]!;
}

async function tryReadLocalProductImage(sku: string): Promise<Uint8Array | null> {
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

function truncateToWidth(font: PDFFont, text: string, size: number, maxWidth: number) {
  let line = String(text || "");
  if (!line) return "";
  if (font.widthOfTextAtSize(line, size) <= maxWidth) return line;
  while (line.length > 1 && font.widthOfTextAtSize(`${line}…`, size) > maxWidth) {
    line = line.slice(0, -1);
  }
  return `${line}…`;
}

function wrapLines(font: PDFFont, text: string, size: number, maxWidth: number, maxLines: number) {
  const words = String(text || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return [];

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
  if (lines.length === maxLines) {
    lines[maxLines - 1] = truncateToWidth(font, lines[maxLines - 1] || "", size, maxWidth);
  }
  return lines.map((line) => truncateToWidth(font, line, size, maxWidth));
}

function drawTextLine(
  page: PDFPage,
  font: PDFFont,
  text: string,
  x: number,
  y: number,
  size: number,
  color: ReturnType<typeof rgb>,
  maxWidth: number
) {
  const line = truncateToWidth(font, text, size, maxWidth);
  if (!line) return 0;
  page.drawText(line, { x, y, size, font, color });
  return size + 1.5;
}

function cardWidth(cols: number) {
  return (PAGE_WIDTH - MARGIN_X * 2 - GAP_X * (cols - 1)) / cols;
}

function cardHeight(rows: number) {
  const contentTop = PAGE_HEIGHT - HEADER_H;
  return (contentTop - MARGIN_Y - GAP_Y * (rows - 1)) / rows;
}

function imageSizeForCard(w: number, h: number) {
  // Keep image dominant but compact enough for denser grids.
  return Math.min(w - CARD_PAD * 2, h * 0.52, colsAwareImageCap(w));
}

function colsAwareImageCap(cardW: number) {
  if (cardW < 110) return 58;
  if (cardW < 130) return 68;
  return 78;
}

function drawHeader(
  page: PDFPage,
  font: PDFFont,
  bold: PDFFont,
  sheet: ProductSheet,
  pageIndex: number,
  pageCount: number,
  itemCount: number
) {
  page.drawRectangle({
    x: 0,
    y: 0,
    width: PAGE_WIDTH,
    height: PAGE_HEIGHT,
    color: COLOR.pageBg,
  });

  drawTextLine(page, bold, sheet.title || "Product sheet", MARGIN_X, PAGE_HEIGHT - 26, 13, COLOR.text, 400);

  const metaParts = [
    sheet.customerLabel ? `For: ${sheet.customerLabel}` : "",
    sheet.accountNo ? `Acct ${sheet.accountNo}` : "",
    sheet.note || "",
    `${itemCount} items`,
    new Date().toISOString().slice(0, 10),
  ].filter(Boolean);
  drawTextLine(
    page,
    font,
    metaParts.join("  ·  "),
    MARGIN_X,
    PAGE_HEIGHT - 40,
    7.5,
    COLOR.meta,
    PAGE_WIDTH - MARGIN_X * 2 - 50
  );

  drawTextLine(
    page,
    font,
    `${pageIndex + 1}/${pageCount}`,
    PAGE_WIDTH - MARGIN_X - 36,
    PAGE_HEIGHT - 26,
    8,
    COLOR.meta,
    40
  );
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
    borderColor: COLOR.border,
    borderWidth: 0.75,
    color: COLOR.white,
  });

  const textWidth = w - CARD_PAD * 2;
  const imageBox = imageSizeForCard(w, h);
  const imageX = x + (w - imageBox) / 2;
  const imageY = y + h - CARD_PAD - imageBox;

  page.drawRectangle({
    x: imageX,
    y: imageY,
    width: imageBox,
    height: imageBox,
    color: COLOR.imageBg,
  });

  if (card.image) {
    const dims = card.image.scale(1);
    const scale = Math.min(imageBox / dims.width, imageBox / dims.height) * 0.92;
    const iw = dims.width * scale;
    const ih = dims.height * scale;
    page.drawImage(card.image, {
      x: imageX + (imageBox - iw) / 2,
      y: imageY + (imageBox - ih) / 2,
      width: iw,
      height: ih,
    });
  }

  let textY = imageY - 9;
  const minY = y + CARD_PAD;
  const skuSize = w < 115 ? 8.5 : 9.5;
  const brandSize = w < 115 ? 7 : 7.5;
  const nameSize = w < 115 ? 7 : 7.5;

  textY -= drawTextLine(page, bold, card.sku, x + CARD_PAD, textY, skuSize, COLOR.text, textWidth);
  if (textY < minY) return;

  if (card.brand) {
    textY -= drawTextLine(page, bold, card.brand, x + CARD_PAD, textY, brandSize, COLOR.brand, textWidth);
    if (textY < minY) return;
  }

  if (card.name) {
    const nameLines = wrapLines(font, card.name, nameSize, textWidth, w < 115 ? 1 : 2);
    for (const line of nameLines) {
      textY -= drawTextLine(page, font, line, x + CARD_PAD, textY, nameSize, COLOR.name, textWidth);
      if (textY < minY) return;
    }
  }

  if (card.size) {
    textY -= drawTextLine(page, font, card.size, x + CARD_PAD, textY, 7, COLOR.size, textWidth);
    if (textY < minY) return;
  }

  if (card.priceLabel) {
    textY -= drawTextLine(page, bold, card.priceLabel, x + CARD_PAD, textY, 8.5, COLOR.price, textWidth);
    if (textY < minY) return;
  }

  if (card.note) {
    drawTextLine(page, font, card.note, x + CARD_PAD, Math.max(minY, textY - 1), 6, COLOR.note, textWidth);
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
  const imageCache = new Map<string, PDFImage | undefined>();
  for (const item of items) {
    let image: PDFImage | undefined;
    if (imageCache.has(item.sku)) {
      image = imageCache.get(item.sku);
    } else {
      image = await embedProductImage(pdf, item, origin);
      imageCache.set(item.sku, image);
    }
    built.push({ ...item, image });
  }

  const grid = pickProductSheetGrid(built.length);
  const perPage = grid.cols * grid.rows;
  const pageCount = Math.max(1, Math.ceil(built.length / perPage));
  const contentTop = PAGE_HEIGHT - HEADER_H;
  const w = cardWidth(grid.cols);
  const h = cardHeight(grid.rows);

  for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
    const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    drawHeader(page, font, bold, sheet, pageIndex, pageCount, built.length);

    const slice = built.slice(pageIndex * perPage, pageIndex * perPage + perPage);
    slice.forEach((card, idx) => {
      const col = idx % grid.cols;
      const row = Math.floor(idx / grid.cols);
      const x = MARGIN_X + col * (w + GAP_X);
      const y = contentTop - (row + 1) * h - row * GAP_Y;
      drawCard(page, font, bold, card, x, y, w, h);
    });
  }

  return pdf.save();
}

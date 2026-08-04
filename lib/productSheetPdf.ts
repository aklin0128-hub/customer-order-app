import { readFile } from "node:fs/promises";
import path from "node:path";

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";

import type { ProductSheet, ProductSheetResolvedItem } from "@/lib/productSheet";

/** US Letter — list layout split across two pages. */
const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN_X = 28;
const MARGIN_Y = 24;
const HEADER_H = 52;
const TARGET_PAGES = 2;
const THUMB = 36;
const ROW_GAP = 4;
const MIN_ROW_H = 40;
const MAX_ROW_H = 56;

const COLOR = {
  text: rgb(0.07, 0.09, 0.15),
  brand: rgb(0.22, 0.26, 0.32),
  name: rgb(0.29, 0.33, 0.39),
  size: rgb(0.42, 0.45, 0.49),
  price: rgb(0.06, 0.46, 0.43),
  note: rgb(0.45, 0.35, 0.2),
  meta: rgb(0.35, 0.4, 0.48),
  border: rgb(0.9, 0.91, 0.93),
  zebra: rgb(0.97, 0.98, 0.99),
  pageBg: rgb(1, 1, 1),
  imageBg: rgb(0.96, 0.97, 0.98),
  headerLine: rgb(0.85, 0.87, 0.9),
  colHeader: rgb(0.42, 0.45, 0.49),
};

type BuiltRow = ProductSheetResolvedItem & {
  image?: PDFImage;
};

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

function drawTextAt(
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
  if (!line) return;
  page.drawText(line, { x, y, size, font, color });
}

/** Split the list evenly across up to two PDF pages. */
export function splitItemsAcrossTwoPages<T>(items: T[]): T[][] {
  if (!items.length) return [];
  if (items.length === 1) return [items];
  const mid = Math.ceil(items.length / 2);
  return [items.slice(0, mid), items.slice(mid)];
}

function rowHeightForCount(countOnPage: number) {
  const usable = PAGE_HEIGHT - HEADER_H - MARGIN_Y - 18;
  if (countOnPage <= 0) return MAX_ROW_H;
  const raw = (usable - ROW_GAP * Math.max(0, countOnPage - 1)) / countOnPage;
  return Math.max(MIN_ROW_H, Math.min(MAX_ROW_H, raw));
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

  drawTextAt(page, bold, sheet.title || "Product sheet", MARGIN_X, PAGE_HEIGHT - 28, 14, COLOR.text, 420);

  const metaParts = [
    sheet.customerLabel ? `For: ${sheet.customerLabel}` : "",
    sheet.accountNo ? `Acct ${sheet.accountNo}` : "",
    sheet.note || "",
    `${itemCount} items`,
    new Date().toISOString().slice(0, 10),
  ].filter(Boolean);
  drawTextAt(page, font, metaParts.join("  ·  "), MARGIN_X, PAGE_HEIGHT - 44, 8, COLOR.meta, PAGE_WIDTH - MARGIN_X * 2 - 60);

  drawTextAt(
    page,
    font,
    `Page ${pageIndex + 1} / ${pageCount}`,
    PAGE_WIDTH - MARGIN_X - 56,
    PAGE_HEIGHT - 28,
    8,
    COLOR.meta,
    56
  );

  page.drawLine({
    start: { x: MARGIN_X, y: PAGE_HEIGHT - HEADER_H + 4 },
    end: { x: PAGE_WIDTH - MARGIN_X, y: PAGE_HEIGHT - HEADER_H + 4 },
    thickness: 1,
    color: COLOR.headerLine,
  });
}

function drawColumnHeaders(page: PDFPage, font: PDFFont, y: number) {
  const cols = columnLayout();
  drawTextAt(page, font, "#", cols.rank.x, y, 7, COLOR.colHeader, cols.rank.w);
  drawTextAt(page, font, "Item #", cols.sku.x, y, 7, COLOR.colHeader, cols.sku.w);
  drawTextAt(page, font, "Brand / Name", cols.name.x, y, 7, COLOR.colHeader, cols.name.w);
  drawTextAt(page, font, "Size", cols.size.x, y, 7, COLOR.colHeader, cols.size.w);
  drawTextAt(page, font, "Price", cols.price.x, y, 7, COLOR.colHeader, cols.price.w);
}

function columnLayout() {
  const contentW = PAGE_WIDTH - MARGIN_X * 2;
  const thumbCol = THUMB + 10;
  const rankW = 22;
  const skuW = 72;
  const sizeW = 70;
  const priceW = 54;
  const nameW = contentW - thumbCol - rankW - skuW - sizeW - priceW - 16;
  let x = MARGIN_X + thumbCol;
  const rank = { x, w: rankW };
  x += rankW + 4;
  const sku = { x, w: skuW };
  x += skuW + 6;
  const name = { x, w: nameW };
  x += nameW + 6;
  const size = { x, w: sizeW };
  x += sizeW + 4;
  const price = { x, w: priceW };
  return { rank, sku, name, size, price, thumbX: MARGIN_X };
}

function drawListRow(
  page: PDFPage,
  font: PDFFont,
  bold: PDFFont,
  row: BuiltRow,
  index: number,
  yBottom: number,
  rowH: number,
  zebra: boolean
) {
  const cols = columnLayout();
  const yTop = yBottom + rowH;

  if (zebra) {
    page.drawRectangle({
      x: MARGIN_X - 2,
      y: yBottom,
      width: PAGE_WIDTH - MARGIN_X * 2 + 4,
      height: rowH,
      color: COLOR.zebra,
    });
  }

  // Thumbnail
  const thumbY = yBottom + (rowH - THUMB) / 2;
  page.drawRectangle({
    x: cols.thumbX,
    y: thumbY,
    width: THUMB,
    height: THUMB,
    color: COLOR.imageBg,
    borderColor: COLOR.border,
    borderWidth: 0.5,
  });
  if (row.image) {
    const dims = row.image.scale(1);
    const scale = Math.min(THUMB / dims.width, THUMB / dims.height) * 0.9;
    const iw = dims.width * scale;
    const ih = dims.height * scale;
    page.drawImage(row.image, {
      x: cols.thumbX + (THUMB - iw) / 2,
      y: thumbY + (THUMB - ih) / 2,
      width: iw,
      height: ih,
    });
  }

  const textMid = yBottom + rowH / 2 - 3;
  const textTop = yBottom + rowH / 2 + 6;
  const textBot = yBottom + rowH / 2 - 10;

  drawTextAt(page, font, String(index + 1), cols.rank.x, textMid, 8, COLOR.meta, cols.rank.w);
  drawTextAt(page, bold, row.sku, cols.sku.x, textMid, 9, COLOR.text, cols.sku.w);

  if (row.brand) {
    drawTextAt(page, bold, row.brand, cols.name.x, textTop, 8, COLOR.brand, cols.name.w);
    drawTextAt(page, font, row.name || "", cols.name.x, textBot, 8, COLOR.name, cols.name.w);
  } else {
    drawTextAt(page, font, row.name || "", cols.name.x, textMid, 8, COLOR.name, cols.name.w);
  }

  drawTextAt(page, font, row.size || "", cols.size.x, textMid, 8, COLOR.size, cols.size.w);
  drawTextAt(page, bold, row.priceLabel || "", cols.price.x, textMid, 9, COLOR.price, cols.price.w);

  if (row.note) {
    drawTextAt(
      page,
      font,
      row.note,
      cols.name.x,
      yBottom + 4,
      6,
      COLOR.note,
      cols.name.w + cols.size.w
    );
  }

  page.drawLine({
    start: { x: MARGIN_X, y: yBottom },
    end: { x: PAGE_WIDTH - MARGIN_X, y: yBottom },
    thickness: 0.5,
    color: COLOR.border,
  });

  return yTop;
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

  const built: BuiltRow[] = [];
  for (const item of items) {
    const image = await embedProductImage(pdf, item, origin);
    built.push({ ...item, image });
  }

  // Prefer exactly two list pages; spill only if rows would be too short to read.
  let pages = splitItemsAcrossTwoPages(built);
  const densest = Math.max(...pages.map((p) => p.length), 1);
  if (rowHeightForCount(densest) < MIN_ROW_H - 0.1) {
    // Too many items for 2 readable pages — fall back to as many pages as needed at MIN_ROW_H.
    const usable = PAGE_HEIGHT - HEADER_H - MARGIN_Y - 18;
    const perPage = Math.max(1, Math.floor((usable + ROW_GAP) / (MIN_ROW_H + ROW_GAP)));
    pages = [];
    for (let i = 0; i < built.length; i += perPage) {
      pages.push(built.slice(i, i + perPage));
    }
  } else if (pages.length > TARGET_PAGES) {
    pages = pages.slice(0, TARGET_PAGES);
  }

  const pageCount = pages.length;

  pages.forEach((slice, pageIndex) => {
    const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    drawHeader(page, font, bold, sheet, pageIndex, pageCount, built.length);

    const rowH = rowHeightForCount(slice.length);
    let y = PAGE_HEIGHT - HEADER_H - 2;
    drawColumnHeaders(page, font, y - 10);
    y -= 16;

    slice.forEach((row, idx) => {
      const globalIndex = pages.slice(0, pageIndex).reduce((n, p) => n + p.length, 0) + idx;
      y -= rowH;
      drawListRow(page, font, bold, row, globalIndex, y, rowH, idx % 2 === 1);
      y -= ROW_GAP;
    });
  });

  return pdf.save();
}

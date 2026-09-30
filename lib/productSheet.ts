import { redis } from "@/lib/redis";
import { getMergedCatalogProducts, type MergedCatalogProduct } from "@/lib/catalogMerge";

export const PRODUCT_SHEETS_KEY = "product-sheets:list";

export type ProductSheetItem = {
  sku: string;
  /** Optional per-SKU line for this sheet (e.g. promo note). */
  note?: string;
};

export type ProductSheet = {
  id: string;
  title: string;
  /** Free-text customer / store label shown on the PDF. */
  customerLabel?: string;
  accountNo?: string;
  note?: string;
  /** Include catalog BP on the PDF when available. */
  showPrice?: boolean;
  items: ProductSheetItem[];
  updatedAt: string;
  createdAt: string;
};

export type ProductSheetResolvedItem = ProductSheetItem & {
  name?: string;
  brand?: string;
  size?: string;
  status?: string;
  imageUrl?: string;
  priceLabel?: string;
};

function cleanSku(value: unknown) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function cleanText(value: unknown) {
  const text = String(value || "").trim();
  return text || undefined;
}

function newId() {
  return `ps_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function normalizeProductSheetItem(entry: unknown): ProductSheetItem | null {
  if (!entry || typeof entry !== "object") return null;
  const row = entry as Record<string, unknown>;
  const sku = cleanSku(row.sku);
  if (!sku || sku.includes(" ")) return null;
  return {
    sku,
    note: cleanText(row.note),
  };
}

export function normalizeProductSheet(entry: unknown): ProductSheet | null {
  if (!entry || typeof entry !== "object") return null;
  const row = entry as Record<string, unknown>;
  const id = String(row.id || "").trim() || newId();
  const title = String(row.title || "").trim() || "Product sheet";
  const rawItems = Array.isArray(row.items) ? row.items : [];
  const items: ProductSheetItem[] = [];
  const seen = new Set<string>();
  for (const raw of rawItems) {
    const item = normalizeProductSheetItem(raw);
    if (!item || seen.has(item.sku)) continue;
    seen.add(item.sku);
    items.push(item);
  }

  const createdAt = String(row.createdAt || "").trim() || new Date().toISOString();
  const updatedAt = String(row.updatedAt || "").trim() || createdAt;

  return {
    id,
    title,
    customerLabel: cleanText(row.customerLabel),
    accountNo: cleanText(row.accountNo)?.toUpperCase(),
    note: cleanText(row.note),
    showPrice: Boolean(row.showPrice),
    items,
    createdAt,
    updatedAt,
  };
}

export async function listProductSheets(): Promise<ProductSheet[]> {
  const raw = await redis.get(PRODUCT_SHEETS_KEY);
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => normalizeProductSheet(entry))
    .filter((sheet): sheet is ProductSheet => Boolean(sheet))
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

export async function getProductSheet(id: string): Promise<ProductSheet | null> {
  const target = String(id || "").trim();
  if (!target) return null;
  const sheets = await listProductSheets();
  return sheets.find((sheet) => sheet.id === target) || null;
}

export async function saveProductSheet(
  input: Partial<ProductSheet> & { title?: string; items?: ProductSheetItem[] }
): Promise<ProductSheet> {
  const sheets = await listProductSheets();
  const now = new Date().toISOString();
  const incoming = normalizeProductSheet({
    ...input,
    id: input.id || newId(),
    createdAt: input.createdAt || now,
    updatedAt: now,
  });
  if (!incoming) throw new Error("Invalid product sheet.");

  const idx = sheets.findIndex((sheet) => sheet.id === incoming.id);
  if (idx >= 0) {
    incoming.createdAt = sheets[idx]!.createdAt || incoming.createdAt;
    sheets[idx] = incoming;
  } else {
    sheets.unshift(incoming);
  }

  await redis.set(PRODUCT_SHEETS_KEY, sheets);
  return incoming;
}

export async function deleteProductSheet(id: string): Promise<boolean> {
  const target = String(id || "").trim();
  if (!target) return false;
  const sheets = await listProductSheets();
  const next = sheets.filter((sheet) => sheet.id !== target);
  if (next.length === sheets.length) return false;
  await redis.set(PRODUCT_SHEETS_KEY, next);
  return true;
}

function formatPrice(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const num = typeof value === "number" ? value : Number(String(value).replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(num) || num <= 0) {
    const text = String(value).trim();
    return text || undefined;
  }
  return `$${num.toFixed(2)}`;
}

export function resolveSheetItems(
  sheet: Pick<ProductSheet, "items" | "showPrice">,
  catalog: MergedCatalogProduct[]
): ProductSheetResolvedItem[] {
  const map = new Map<string, MergedCatalogProduct>();
  for (const product of catalog) {
    const sku = cleanSku(product.sku);
    if (sku) map.set(sku, product);
  }

  return sheet.items.map((item) => {
    const product = map.get(item.sku);
    const priceLabel = sheet.showPrice
      ? formatPrice(product?.bp) || cleanText(product?.newItemListPrice)
      : undefined;
    return {
      sku: item.sku,
      note: item.note,
      name: cleanText(product?.name),
      brand: cleanText(product?.brand),
      size: cleanText(product?.size),
      status: cleanText(product?.status),
      imageUrl: cleanText(product?.imageUrl) || `/product/${item.sku}.jpg`,
      priceLabel,
    };
  });
}

export async function resolveProductSheet(
  sheet: ProductSheet
): Promise<{ sheet: ProductSheet; items: ProductSheetResolvedItem[] }> {
  const catalog = await getMergedCatalogProducts();
  return { sheet, items: resolveSheetItems(sheet, catalog) };
}

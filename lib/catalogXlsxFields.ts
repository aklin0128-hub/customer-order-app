export function safeXlsxString(value: unknown) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

/** Read a cell when Excel headers vary slightly (spacing, case). */
export function getXlsxCell(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (safeXlsxString(value)) return safeXlsxString(value);
  }

  const normalized = new Map(
    Object.keys(row).map((key) => [key.trim().toUpperCase(), key])
  );

  for (const key of keys) {
    const actual = normalized.get(key.trim().toUpperCase());
    if (actual && safeXlsxString(row[actual])) return safeXlsxString(row[actual]);
  }

  return "";
}

const UPC_KEYS = ["UPC", "UPC CODE", "UPC Code", "UPC_CODE"];
/** Excel column **PL** = pallet size (same as PALLETSIZE). */
const PALLET_KEYS = ["PL", "PALLETSIZE"];

/** Normalize UPC to digits only (keeps leading zeros). */
export function normalizeUpc(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(Math.trunc(value)).padStart(12, "0").slice(-12);
  }
  const digits = String(value || "").replace(/\D/g, "");
  return digits || "";
}

export function parseUpcFromXlsxRow(row: Record<string, unknown>) {
  for (const key of UPC_KEYS) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== "") {
      return normalizeUpc(row[key]);
    }
  }
  return normalizeUpc(getXlsxCell(row, UPC_KEYS));
}

/** PL is numeric in Excel; avoid date formatting (e.g. 150 → 5/29/00). */
export function formatPalletSizeFromCell(value: unknown) {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(Math.round(value));
  }
  const text = safeXlsxString(value);
  if (/^\d{1,4}$/.test(text)) return text;
  const num = Number(text);
  if (Number.isFinite(num) && num > 0 && num < 10000) return String(Math.round(num));
  return text;
}

export function parsePalletSizeFromXlsxRow(row: Record<string, unknown>) {
  for (const key of PALLET_KEYS) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== "") {
      return formatPalletSizeFromCell(row[key]);
    }
  }

  const normalized = new Map(
    Object.keys(row).map((k) => [k.trim().toUpperCase(), k])
  );
  for (const key of PALLET_KEYS) {
    const actual = normalized.get(key.trim().toUpperCase());
    if (actual) return formatPalletSizeFromCell(row[actual]);
  }

  return "";
}

function safeXlsxNumber(value: unknown) {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const num = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(num) ? num : undefined;
}

export type XlsxProductFields = {
  sku: string;
  name?: string;
  name_k?: string;
  brand?: string;
  brand_k?: string;
  status?: string;
  size?: string;
  um?: string;
  upc?: string;
  palletSize?: string;
  inventory?: number;
  bp?: number;
  up?: number;
  cbm?: number;
  shelf_life_days?: number;
  storage_type?: string;
  country?: string;
};

const SKU_KEYS = ["PID", "SKU", "Item No.", "Item No", "No.", "No", "Item", "Item Number"];

export function parseSkuFromXlsxRow(row: Record<string, unknown>) {
  return getXlsxCell(row, SKU_KEYS).toUpperCase();
}

/** Full product fields from an Export sheet row (same columns as catalog rebuild). */
export function parseProductFieldsFromXlsxRow(
  row: Record<string, unknown>,
  sku: string
): XlsxProductFields {
  const product: XlsxProductFields = { sku };

  const name = getXlsxCell(row, ["Description", "DESCRIPTION", "Name", "NAME"]);
  if (name) product.name = name;

  const nameK = getXlsxCell(row, ["Description K", "Description_K", "DESCRIPTION K"]);
  if (nameK) product.name_k = nameK;

  const brand = getXlsxCell(row, ["Brand", "BRAND"]);
  if (brand) product.brand = brand;

  const brandK = getXlsxCell(row, ["Brand_K", "Brand K", "BRAND_K"]);
  if (brandK) product.brand_k = brandK;

  const status = getXlsxCell(row, ["Status", "STATUS", "Item Status"]).toUpperCase();
  if (status) product.status = status;

  const size = getXlsxCell(row, ["Size", "SIZE"]);
  if (size) product.size = size;

  const um = getXlsxCell(row, ["UM"]);
  if (um) product.um = um;

  const upc = parseUpcFromXlsxRow(row);
  if (upc) product.upc = upc;

  const palletSize = parsePalletSizeFromXlsxRow(row);
  if (palletSize) product.palletSize = palletSize;

  const inventory = parseInventoryFromXlsxRow(row);
  if (inventory !== undefined) product.inventory = inventory;

  const bp = safeXlsxNumber(getXlsxCell(row, ["BP"]));
  if (bp !== undefined) product.bp = bp;

  const up = safeXlsxNumber(getXlsxCell(row, ["UP"]));
  if (up !== undefined) product.up = up;

  const cbm = safeXlsxNumber(getXlsxCell(row, ["CBM"]));
  if (cbm !== undefined) product.cbm = cbm;

  const shelfLife = safeXlsxNumber(getXlsxCell(row, ["S Life (D)", "S Life(D)", "S LIFE (D)"]));
  if (shelfLife !== undefined) product.shelf_life_days = shelfLife;

  const storageType = getXlsxCell(row, ["S Type", "S TYPE", "Storage Type"]);
  if (storageType) product.storage_type = storageType;

  const country = getXlsxCell(row, ["CO", "Country", "COUNTRY"]);
  if (country) product.country = country;

  return product;
}

export function parseInventoryFromXlsxRow(row: Record<string, unknown>) {
  const keys = ["INV (10)", "INV(10)", "INV", "Inventory", "INVENTORY", "On Hand", "QTY"];
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== "") {
      const n = safeXlsxNumber(row[key]);
      if (n !== undefined) return n;
    }
  }
  const fromHeader = safeXlsxNumber(getXlsxCell(row, keys));
  return fromHeader;
}

export function hasXlsxProductUpdate(row: Record<string, unknown>) {
  const status = getXlsxCell(row, ["Status", "STATUS", "Item Status"]);
  const upc = parseUpcFromXlsxRow(row);
  const palletSize = parsePalletSizeFromXlsxRow(row);
  const inventory = parseInventoryFromXlsxRow(row);
  return Boolean(status || upc || palletSize || inventory !== undefined);
}

/** Enough row data to create a brand-new SKU (looser than update-only rows). */
export function hasXlsxProductIdentity(row: Record<string, unknown>) {
  if (hasXlsxProductUpdate(row)) return true;
  return Boolean(
    getXlsxCell(row, ["Description", "DESCRIPTION", "Name", "NAME"]) ||
      getXlsxCell(row, ["Brand", "BRAND"])
  );
}

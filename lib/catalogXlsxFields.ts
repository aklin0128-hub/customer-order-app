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

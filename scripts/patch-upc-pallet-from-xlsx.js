/**
 * Merge UPC + pallet size from catalog_updates/today_update.xlsx into
 * data/catalog_sku_master_extracted.json (keeps other fields unchanged).
 */
const fs = require("fs");
const path = require("path");
const xlsx = require("xlsx");

const INPUT_XLSX = path.join(process.cwd(), "catalog_updates", "today_update.xlsx");
const CATALOG_JSON = path.join(process.cwd(), "data", "catalog_sku_master_extracted.json");

function safeString(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function getAny(row, keys) {
  for (const key of keys) {
    const value = row[key];
    if (safeString(value)) return safeString(value);
  }

  const normalized = new Map(
    Object.keys(row).map((key) => [key.trim().toUpperCase(), key])
  );

  for (const key of keys) {
    const actual = normalized.get(key.trim().toUpperCase());
    if (actual && safeString(row[actual])) return safeString(row[actual]);
  }

  return "";
}

function normalizeUpc(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(Math.trunc(value)).padStart(12, "0").slice(-12);
  }
  const digits = String(value || "").replace(/\D/g, "");
  return digits || "";
}

function parseUpc(row) {
  return normalizeUpc(getAny(row, ["UPC", "UPC CODE", "UPC Code", "UPC_CODE"]));
}

/** Excel **PL** column → palletSize (numeric; read raw to avoid date conversion). */
function formatPalletSize(value) {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value === "number" && Number.isFinite(value)) return String(Math.round(value));
  const text = safeString(value);
  if (/^\d{1,4}$/.test(text)) return text;
  const num = Number(text);
  if (Number.isFinite(num) && num > 0 && num < 10000) return String(Math.round(num));
  return text;
}

function parsePalletSize(row) {
  for (const key of ["PL", "PALLETSIZE", "pl", "Palletsize"]) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== "") {
      return formatPalletSize(row[key]);
    }
  }
  return formatPalletSize(getAny(row, ["PL", "PALLETSIZE"]));
}

function main() {
  if (!fs.existsSync(INPUT_XLSX)) {
    throw new Error(`Input file not found: ${INPUT_XLSX}`);
  }
  if (!fs.existsSync(CATALOG_JSON)) {
    throw new Error(`Catalog JSON not found: ${CATALOG_JSON}`);
  }

  const workbook = xlsx.readFile(INPUT_XLSX);
  const sheetName = workbook.Sheets.Export ? "Export" : workbook.SheetNames[0];
  const sheet = sheetName ? workbook.Sheets[sheetName] : null;
  if (!sheet) throw new Error("No worksheet found.");

  const rows = xlsx.utils.sheet_to_json(sheet, { defval: "", raw: true });
  const sampleKeys = Object.keys(rows[0] || {});
  const hasUpc = sampleKeys.some((k) => /upc/i.test(k));
  const hasPallet = sampleKeys.some((k) => /^pl$/i.test(k.trim()) || /^palletsize$/i.test(k.trim()));

  if (!hasUpc && !hasPallet) {
    console.warn(
      "Warning: today_update.xlsx has no UPC / PL columns yet. Expected headers: UPC, PL (pallet size)."
    );
    console.warn("Columns found:", sampleKeys.join(", "));
  }

  const importedAt = new Date().toISOString();
  const bySku = new Map();
  for (const row of rows) {
    const sku = safeString(row.PID).toUpperCase();
    if (!sku || sku.includes(" ")) continue;

    const upc = parseUpc(row);
    const palletSize = parsePalletSize(row);
    bySku.set(sku, { upc, palletSize });
  }

  const catalog = JSON.parse(fs.readFileSync(CATALOG_JSON, "utf8"));
  const knownSkus = new Set(catalog.map((item) => safeString(item.sku).toUpperCase()).filter(Boolean));
  let upcCount = 0;
  let palletCount = 0;
  let newSkuCount = 0;

  const next = catalog.map((item) => {
    const sku = safeString(item.sku).toUpperCase();
    const patch = bySku.get(sku);
    if (!patch) return item;

    const merged = { ...item };
    if (!merged.importedAt) {
      merged.importedAt = importedAt;
      newSkuCount += 1;
    }
    if (patch.upc) {
      merged.upc = patch.upc;
      upcCount += 1;
    }
    if (patch.palletSize) {
      merged.palletSize = patch.palletSize;
      palletCount += 1;
    }
    return merged;
  });

  for (const sku of bySku.keys()) {
    if (knownSkus.has(sku)) continue;
    newSkuCount += 1;
  }

  fs.writeFileSync(CATALOG_JSON, `${JSON.stringify(next, null, 2)}\n`, "utf8");

  console.log(`First-time import stamp on ${newSkuCount} SKU(s) (${importedAt}).`);
  console.log(`Updated UPC on ${upcCount}, pallet on ${palletCount}.`);
  console.log(`XLSX SKUs in file: ${bySku.size}`);
  console.log(CATALOG_JSON);
}

main();

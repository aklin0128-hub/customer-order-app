const fs = require("fs");
const path = require("path");
const xlsx = require("xlsx");

const INPUT_XLSX = path.join(process.cwd(), "catalog_updates", "today_update.xlsx");
const OUTPUT_JSON = path.join(
  process.cwd(),
  "data",
  "catalog_sku_master_extracted.json"
);

function safeString(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function safeNumber(value) {
  if (value === undefined || value === null || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function normalizeStatus(status) {
  const s = safeString(status).toUpperCase();
  if (!s) return "UNKNOWN";
  return s;
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
  const digits = String(value || "").replace(/\D/g, "");
  return digits || "";
}

function parseUpc(row) {
  return normalizeUpc(getAny(row, ["UPC", "UPC CODE", "UPC Code", "UPC_CODE"]));
}

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
  for (const key of ["PL", "PALLETSIZE"]) {
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

  const workbook = xlsx.readFile(INPUT_XLSX);
  const sheetName = "Export";

  if (!workbook.Sheets[sheetName]) {
    throw new Error(`Sheet "${sheetName}" not found in ${INPUT_XLSX}`);
  }

  const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], {
    defval: "",
    raw: true,
  });

  const importedAt = new Date().toISOString();

  const catalog = rows
    .map((row) => {
      const sku = safeString(row["PID"]).toUpperCase();

      if (!sku || sku.includes(" ")) return null;

      const upc = parseUpc(row);
      const palletSize = parsePalletSize(row);

      const item = {
        sku,
        importedAt,
        name: safeString(row["Description"]),
        name_k: safeString(row["Description K"]),
        brand: safeString(row["Brand"]),
        brand_k: safeString(row["Brand_K"]),
        status: normalizeStatus(row["Status"]),
        inventory: safeNumber(row["INV (10)"]),
        bp: safeNumber(row["BP"]),
        up: safeNumber(row["UP"]),
        size: safeString(row["Size"]),
        um: safeString(row["UM"]),
        cbm: safeNumber(row["CBM"]),
        shelf_life_days: safeNumber(row["S Life (D)"]),
        storage_type: safeString(row["S Type"]),
        country: safeString(row["CO"]),
      };

      if (upc) item.upc = upc;
      if (palletSize) item.palletSize = palletSize;

      return item;
    })
    .filter(Boolean)
    .sort((a, b) => a.sku.localeCompare(b.sku));

  fs.mkdirSync(path.dirname(OUTPUT_JSON), { recursive: true });
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(catalog, null, 2), "utf8");

  console.log(`Done. Exported ${catalog.length} items to:`);
  console.log(OUTPUT_JSON);
}

main();
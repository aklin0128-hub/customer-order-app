/**
 * Remove mistaken bulk importedAt stamps (UPC/PL patch stamped every SKU at once).
 * After this, "new items" use name _NEW / admin isNew / first-time import only.
 */
const fs = require("fs");
const path = require("path");

const CATALOG_JSON = path.join(process.cwd(), "data", "catalog_sku_master_extracted.json");

function main() {
  const catalog = JSON.parse(fs.readFileSync(CATALOG_JSON, "utf8"));
  let cleared = 0;
  const next = catalog.map((item) => {
    if (!item.importedAt) return item;
    cleared += 1;
    const { importedAt, ...rest } = item;
    return rest;
  });

  fs.writeFileSync(CATALOG_JSON, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  const stillNew = next.filter((item) => item.isNew === true);
  console.log(`Cleared importedAt on ${cleared} SKUs.`);
  console.log(`Still "new" (admin isNew only): ${stillNew.length} (${stillNew.map((i) => i.sku).slice(0, 12).join(", ")}...)`);
}

main();

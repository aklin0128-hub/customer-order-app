import fs from "fs";
import path from "path";
import { inferCategory } from "../lib/inferCategory";

const catalogPath = path.join(process.cwd(), "data/catalog_sku_master_extracted.json");
const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8")) as Record<string, unknown>[];

const counts: Record<string, number> = {};

const next = catalog.map((item) => {
  const category = inferCategory(item as Parameters<typeof inferCategory>[0]);
  counts[category] = (counts[category] || 0) + 1;
  return { ...item, category };
});

fs.writeFileSync(catalogPath, `${JSON.stringify(next, null, 2)}\n`, "utf8");

console.log("Categories assigned:", counts);
console.log(`Updated ${next.length} items in ${catalogPath}`);

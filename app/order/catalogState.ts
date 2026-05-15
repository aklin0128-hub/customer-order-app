import catalogData from "@/data/catalog_sku_master_extracted.json";

import type { CatalogItem } from "./types";

export let catalog: CatalogItem[] = catalogData as CatalogItem[];

export function replaceCatalog(products: CatalogItem[]) {
  catalog = products;
}

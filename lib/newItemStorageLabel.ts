import { mapLegacyCategoryToMain, type MainCategory } from "@/lib/catalogMainCategories";

export const NEW_ITEM_STORAGE_LABELS = ["DRY", "FROZEN", "FRESH"] as const;

export type NewItemStorageLabel = (typeof NEW_ITEM_STORAGE_LABELS)[number];

export function parseNewItemStorageLabel(value: unknown): NewItemStorageLabel | undefined {
  const clean = String(value || "")
    .trim()
    .toUpperCase();
  if (clean === "DRY" || clean === "FROZEN" || clean === "FRESH") return clean;
  return undefined;
}

export function mainCategoryToNewItemStorageLabel(
  main: MainCategory | ""
): NewItemStorageLabel | undefined {
  if (main === "FROZEN") return "FROZEN";
  if (main === "FRESH") return "FRESH";
  if (main === "DRY" || main === "HOUSEWARE") return "DRY";
  return undefined;
}

/** /new/ badge: product Category wins over legacy stored newItemStorageLabel. */
export function resolveNewItemStorageLabel(item: {
  newItemStorageLabel?: unknown;
  category?: string;
  categories?: string[];
}): NewItemStorageLabel | undefined {
  const main = mapLegacyCategoryToMain(
    String(item.categories?.[0] || item.category || "").trim()
  );
  const fromCategory = mainCategoryToNewItemStorageLabel(main);
  if (fromCategory) return fromCategory;
  return parseNewItemStorageLabel(item.newItemStorageLabel);
}

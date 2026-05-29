export const NEW_ITEM_STORAGE_LABELS = ["DRY", "FROZEN", "FRESH"] as const;

export type NewItemStorageLabel = (typeof NEW_ITEM_STORAGE_LABELS)[number];

export function parseNewItemStorageLabel(value: unknown): NewItemStorageLabel | undefined {
  const clean = String(value || "")
    .trim()
    .toUpperCase();
  if (clean === "DRY" || clean === "FROZEN" || clean === "FRESH") return clean;
  return undefined;
}

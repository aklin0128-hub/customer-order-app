/** Customer catalog + admin product categories (4 majors + ALL filter). */
export const CATEGORY_OPTIONS = ["ALL", "DRY", "FROZEN", "FRESH", "HOUSEWARE"] as const;

export type MainCategory = Exclude<(typeof CATEGORY_OPTIONS)[number], "ALL">;

const MAIN_SET = new Set<string>(CATEGORY_OPTIONS.filter((v) => v !== "ALL"));

/** Legacy granular / spreadsheet categories → main bucket. */
const LEGACY_TO_MAIN: Record<string, MainCategory> = {
  RICE: "DRY",
  NOODLE: "DRY",
  NOODLES: "DRY",
  SNACK: "DRY",
  SAUCE: "DRY",
  SEASONING: "DRY",
  "DRY GOODS": "DRY",
  DRINK: "DRY",
  PROCESSED: "DRY",
  OTHER: "DRY",
  FROZEN: "FROZEN",
  "ICE CREAM": "FROZEN",
  REFRIGERATED: "FRESH",
  PRODUCE: "FRESH",
  SEAFOOD: "FRESH",
  "NON-FOOD": "HOUSEWARE",
};

export function isMainCategory(value: string): value is MainCategory {
  return MAIN_SET.has(value.trim().toUpperCase());
}

export function mapLegacyCategoryToMain(value: string): MainCategory | "" {
  const clean = String(value || "").trim().toUpperCase();
  if (!clean || clean === "ALL") return "";
  if (isMainCategory(clean)) return clean;
  return LEGACY_TO_MAIN[clean] || "";
}

export type GranularCategory =
  | "RICE"
  | "NOODLE"
  | "FROZEN"
  | "SEAFOOD"
  | "ICE CREAM"
  | "SAUCE"
  | "SEASONING"
  | "REFRIGERATED"
  | "PRODUCE"
  | "SNACK"
  | "DRINK"
  | "DRY GOODS"
  | "NON-FOOD";

export function mapGranularToMain(category: GranularCategory | "OTHER"): MainCategory {
  switch (category) {
    case "FROZEN":
    case "ICE CREAM":
      return "FROZEN";
    case "REFRIGERATED":
    case "PRODUCE":
    case "SEAFOOD":
      return "FRESH";
    case "NON-FOOD":
      return "HOUSEWARE";
    default:
      return "DRY";
  }
}

export const CATEGORY_OPTIONS = [
  "ALL",
  "RICE",
  "NOODLE",
  "FROZEN",
  "SEAFOOD",
  "ICE CREAM",
  "SAUCE",
  "SEASONING",
  "REFRIGERATED",
  "PRODUCE",
  "SNACK",
  "DRINK",
  "DRY GOODS",
  "NON-FOOD",
  "OTHER",
] as const;

export type ProductCategory = (typeof CATEGORY_OPTIONS)[number] extends infer T
  ? T extends "ALL" | "OTHER"
    ? never
    : T
  : never;

export type CategoryItem = {
  sku?: string;
  name?: string;
  brand?: string;
  category?: string;
  storage_type?: string;
};

/** SKU department prefixes used in this distributor catalog */
const SKU_PREFIX_CATEGORY: Record<string, ProductCategory> = {
  "00": "RICE",
  "01": "RICE",
  "02": "DRY GOODS",
  "03": "SAUCE",
  "04": "SAUCE",
  "05": "SEASONING",
  "06": "DRY GOODS",
  "08": "NOODLE",
  "09": "SNACK",
  "10": "DRINK",
  "13": "NON-FOOD",
  "19": "REFRIGERATED",
  "20": "FROZEN",
  "21": "FROZEN",
  "23": "FROZEN",
  "27": "FROZEN",
  "28": "FROZEN",
  "29": "FROZEN",
  "51": "SNACK",
  "56": "FROZEN",
  "80": "REFRIGERATED",
  "81": "REFRIGERATED",
  "95": "DRY GOODS",
};

const NOODLE_BRANDS = [
  "NONGSHIM",
  "NONGHYUP",
  "PALDO",
  "OTTOGI",
  "SAMYANG",
  "SAPPORO",
  "YISSINE",
  "YISSIN",
  "OUMI",
  "O'FOOD",
  "OFOOD",
  "ASSI",
];

function normalizeText(item: CategoryItem) {
  return `${item.brand || ""} ${item.name || ""}`.trim().toUpperCase();
}

function skuPrefix(sku: string) {
  const clean = sku.trim().toUpperCase();
  if (/^[0-9]{2}/.test(clean)) return clean.slice(0, 2);
  if (/^AM/i.test(clean)) return "AM";
  return clean.slice(0, 2);
}

function matchAny(text: string, words: string[]) {
  return words.some((w) => text.includes(w));
}

function normalizeLegacyCategory(category: string): ProductCategory | "OTHER" | null {
  const explicit = category.trim().toUpperCase();
  if (!explicit || explicit === "ALL") return null;
  if (explicit === "NOODLES") return "NOODLE";
  if (explicit === "PROCESSED") return "DRY GOODS";
  if (CATEGORY_OPTIONS.includes(explicit as (typeof CATEGORY_OPTIONS)[number])) {
    return explicit as ProductCategory | "OTHER";
  }
  return null;
}

function inferFromKeywords(text: string, sku: string): ProductCategory | null {
  if (
    matchAny(text, [
      "CHOPSTICK",
      "GLOVE",
      "APRON",
      "HAIR NET",
      "FOOD GLOVE",
      "RUBBER GLOVE",
      "LATEX",
      "CONTAINER",
      "PLASTIC TRAY",
      "ALUMINUM FOIL",
      "PLASTIC FOIL",
      "WRAP FILM",
      "CATERING FOIL",
      "STRAW",
      "TOOTHPICK",
      "SPOON",
      "FORK",
      "DISPOSABLE",
      "VACUUM KIMCHI CONTAINER",
      "KIMCHI CONTAINER",
      "LID ONLY",
      "CUP HOLDER",
    ]) &&
    !matchAny(text, ["RAMEN", "NOODLE", "CUP NOODLE", "BOWL NOODLE"])
  ) {
    return "NON-FOOD";
  }

  if (
    matchAny(text, [
      "RAMEN",
      "RAHMEN",
      "LAMEN",
      "NOODLE",
      "NOODLES",
      "UDON",
      "SOBA",
      "JAPCHAE",
      "NAENGMYEON",
      "NAENG MYUN",
      "CHAPAGETTI",
      "JJAJANG",
      "JJAMPPONG",
      "JANGMEN",
      "CUP NOODLE",
      "BOWL NOODLE",
      "INSTANT NOODLE",
      "RICE CAKE",
      "TTEOK",
      "DDUK",
      "GLASS NOODLE",
      "VERMICELLI",
      "PHO NOODLE",
      "RICE STICK NOODLE",
      "RICE NOODLE",
      "FRESH RICE NOODLE",
      "DRIED NOODLE",
      "WONTON SKIN",
      "DUMPLING WRAPPER",
      "GYOZA WRAPPER",
      "MANDU WRAPPER",
    ])
  ) {
    return "NOODLE";
  }

  if (
    matchAny(text, ["RICE FLOUR", "MOCHIKO", "RICE PAPER", "RICE STICK", "RICE WINE"]) ||
    (text.includes("FLOUR") && !text.includes("RICE"))
  ) {
    return "DRY GOODS";
  }

  if (
    matchAny(text, [
      " RICE ",
      "RICE (",
      "RICE,",
      "SWEET RICE",
      "BROWN RICE",
      "SUSHI RICE",
      "MEDIUM GRAIN RICE",
      "SHORT GRAIN RICE",
      "LONG GRAIN RICE",
      "JASMINE RICE",
      "BASMATI",
      "MILLET",
      "SORGHUM",
      "QUINOA",
    ]) ||
    (text.includes("RICE") && !text.includes("NOODLE") && !text.includes("CRACKER"))
  ) {
    if (sku.startsWith("00") || sku.startsWith("01")) return "RICE";
    if (text.includes("RICE") && !text.includes("FLOUR") && !text.includes("PAPER")) return "RICE";
  }

  if (
    matchAny(text, [
      "BEAN",
      "MUNG",
      "BARLEY",
      "LENTIL",
      "CHICKPEA",
      "SESAME SEED",
      "JOBS TEAR",
      "RED BEAN",
      "BLACK BEAN",
      "SOYBEAN",
    ]) &&
    !matchAny(text, ["SOY SAUCE", "SOYBEAN PASTE", "SOYBEAN OIL", "FERMENTED SOYBEAN", "EDAMAME"])
  ) {
    return "DRY GOODS";
  }

  if (
    matchAny(text, [
      "SOY SAUCE",
      "SOYSAUCE",
      "OYSTER SAUCE",
      "FISH SAUCE",
      "GOCHUJANG",
      "DOENJANG",
      "SSAMJANG",
      "DWENJANG",
      "MISO",
      "TERIYAKI",
      "HOISIN",
      "SRIRACHA",
      "CHILI SAUCE",
      "HOT SAUCE",
      "BBQ SAUCE",
      "DIPPING SAUCE",
      "STIR FRY SAUCE",
      "PASTE",
      "CURRY PASTE",
      "CURRY SAUCE",
      "COCONUT MILK",
      "COCONUT CREAM",
      "TOM YUM PASTE",
      "SATAY SAUCE",
      "BLACK BEAN SAUCE",
      "XO SAUCE",
      "WASABI",
      "PONZU",
      "TSUYU",
      "DRESSING",
      "MAYO",
      "MAYONNAISE",
      "KETCHUP",
      "SAUCE",
    ]) &&
    !matchAny(text, ["CHILI POWDER", "PEPPER POWDER", "SOUP BASE POWDER"])
  ) {
    return "SAUCE";
  }

  if (
    matchAny(text, [
      "SEASONING",
      "SPICE",
      "POWDER",
      "SALT",
      "SUGAR",
      "SYRUP",
      "HONEY",
      "OIL",
      "VINEGAR",
      "SESAME OIL",
      "COOKING OIL",
      "OLIVE OIL",
      "CANOLA",
      "BROTH",
      "STOCK",
      "SOUP BASE",
      "DASHI",
      "BOUILLON",
      "MSG",
      "GARLIC POWDER",
      "ONION POWDER",
      "PEPPER POWDER",
      "RED PEPPER",
      "CHILI FLAKE",
      "CHILI POWDER",
      "GOCHUGARU",
      "SEAWEED",
      "KELP",
      "ANCHOVY",
      "BONITO",
      "EXTRACT",
      "VINEGAR",
      "CINNAMON",
      "STAR ANISE",
      "BAY LEAF",
    ])
  ) {
    return "SEASONING";
  }

  if (
    matchAny(text, [
      "ICE CREAM",
      "ICECREAM",
      "MOCHI ICE",
      "POPSICLE",
      "ICE BAR",
      "MELONA",
      "SAMANCO",
      "BINGSU",
      "SHAVED ICE",
    ])
  ) {
    return "ICE CREAM";
  }

  if (
    matchAny(text, [
      "CHIP",
      "CHIPS",
      "SNACK",
      "CRACKER",
      "COOKIE",
      "BISCUIT",
      "CANDY",
      "CHOCOLATE",
      "GUMMY",
      "JELLY",
      "POPCORN",
      "PRETZEL",
      "WAFER",
      "PEANUT",
      "ALMOND SNACK",
      "YAN YAN",
    ])
  ) {
    return "SNACK";
  }

  if (
    matchAny(text, [
      "SEAFOOD",
      "SQUID",
      "SHRIMP",
      "FISH CAKE",
      "EMPA",
      "SURIMI",
      "OCTOPUS",
      "TUNA",
      "SALMON",
      "MACKEREL",
      "CRAB",
      "CLAM",
      "MUSSEL",
      "EEL",
      "YELLOW CROAKER",
      "POLLOCK",
      "COD",
      "CUTTLEFISH",
    ]) &&
    !matchAny(text, ["FISH SAUCE", "OYSTER SAUCE"])
  ) {
    return "SEAFOOD";
  }

  if (
    matchAny(text, [
      "KIMCHI",
      "DUMPLING",
      "MANDU",
      "GYOZA",
      "POTSTICKER",
      "TOFU",
      "BEAN CURD",
      "EDAMAME",
      "FROZEN",
      "BUN",
      "SIOPAO",
      "PANCAKE",
      "CRULLER",
    ])
  ) {
    return "FROZEN";
  }

  if (
    matchAny(text, [
      "REFRIGERATED",
      "FRESH",
      "NAPA",
      "BANCHAN",
      "PICKLED",
      "RADISH CAKE",
      "PERILLA",
      "SPROUT",
      "TOFU",
      "YAM",
      "POTATO",
      "ONION",
      "GARLIC",
      "GINGER",
      "CABBAGE",
      "LETTUCE",
      "CILANTRO",
      "SCALLION",
    ]) &&
  matchAny(text, ["FRESH", "NAPA", "BANCHAN", "REF", "USA", "CANADA", "LB", "BULK"])
  ) {
    if (matchAny(text, ["NAPA", "PERILLA", "SPROUT", "YAM", "POTATO", "ONION", "GARLIC", "GINGER", "CABBAGE", "LETTUCE", "CILANTRO", "SCALLION"])) {
      return "PRODUCE";
    }
    return "REFRIGERATED";
  }

  if (
    matchAny(text, [
      "TEA",
      "COFFEE",
      "JUICE",
      "DRINK",
      "BEVERAGE",
      "WATER",
      "SODA",
      "MILK",
      "BARLEY TEA",
      "CORN TEA",
      "POCARI",
      "MAXIM",
      "INSTANT COFFEE",
    ])
  ) {
    return "DRINK";
  }

  if (
    matchAny(text, [
      "DRIED",
      "PICKLED",
      "CANNED",
      "BAMBOO",
      "CHESTNUT",
      "MUSHROOM",
      "WOOD EAR",
      "TREE EAR",
      "LUNCHEON",
      "SPAM",
      "SAUSAGE",
      "BREAD CRUMB",
      "PANKO",
      "EGG",
      "LAVER",
      "NORI",
      "SEAWEED SNACK",
      "JERKY",
      "PRESERVED",
      "JAM",
      "POWDER MIX",
    ])
  ) {
    return "DRY GOODS";
  }

  return null;
}

function inferFromStorage(storage: string, text: string): ProductCategory | null {
  const s = storage.trim().toLowerCase();

  if (s === "frz" || s === "frozen") {
    if (matchAny(text, ["ICE CREAM", "POPSICLE", "MOCHI ICE", "MELONA", "SAMANCO"])) return "ICE CREAM";
    if (matchAny(text, ["SEAFOOD", "SQUID", "SHRIMP", "FISH CAKE", "SURIMI", "OCTOPUS", "TUNA", "SALMON", "MACKEREL", "CRAB", "CLAM", "EEL"])) return "SEAFOOD";
    if (matchAny(text, ["SNACK", "CHIP", "CRACKER"])) return "SNACK";
    return "FROZEN";
  }

  if (s === "ref" || s === "refrigerated") {
    if (matchAny(text, ["NOODLE", "MISO", "SAUCE", "POWDER", "PEPPER"])) {
      if (matchAny(text, ["NOODLE"])) return "NOODLE";
      if (matchAny(text, ["MISO", "SAUCE"])) return "SAUCE";
      if (matchAny(text, ["POWDER", "PEPPER"])) return "SEASONING";
    }
    if (matchAny(text, ["NAPA", "PERILLA", "SPROUT", "YAM", "POTATO", "ONION", "GARLIC", "GINGER", "CABBAGE", "LETTUCE", "CILANTRO", "SCALLION"])) {
      return "PRODUCE";
    }
    return "REFRIGERATED";
  }

  return null;
}

function inferFromSkuPrefix(prefix: string, text: string): ProductCategory | null {
  const base = SKU_PREFIX_CATEGORY[prefix];
  if (!base) return null;

  if (prefix === "07") {
    if (matchAny(text, ["SOUP BASE", "DASHI", "BROTH", "SEASONING"])) return "SEASONING";
    if (matchAny(text, ["SQUID", "FISH", "SEAFOOD", "OCTOPUS"])) return "SEAFOOD";
    return "DRY GOODS";
  }

  if (prefix === "04") {
    if (matchAny(text, ["POWDER", "BOUILLON", "STOCK"])) return "SEASONING";
    return "SAUCE";
  }

  if (prefix === "02") {
    if (text.includes("RICE")) return "DRY GOODS";
    return "DRY GOODS";
  }

  if (prefix === "10") {
    if (matchAny(text, ["TEA", "COFFEE", "JUICE", "DRINK", "WATER", "MILK", "POCARI"])) return "DRINK";
    return "DRY GOODS";
  }

  if (prefix === "AM") {
    if (matchAny(text, ["SAUCE", "PASTE", "CHILI"])) return "SAUCE";
    if (matchAny(text, ["NOODLE"])) return "NOODLE";
    return "DRY GOODS";
  }

  if (prefix === "08" || NOODLE_BRANDS.some((b) => text.includes(b))) {
    if (matchAny(text, ["NOODLE", "RAMEN", "UDON", "SOBA", "NAENGMYEON", "CHAPAGETTI", "CUP", "BOWL"])) {
      return "NOODLE";
    }
  }

  return base;
}

/**
 * Computes the customer-visible category for filtering.
 *
 * **Override:** When `item.category` is set (usually from merging Redis `product:*` overrides from Admin → Products),
 * that value wins and skips all heuristics. Use Admin to fix individual SKUs without changing `catalog_sku_master_extracted.json`.
 *
 * Batch JSON defaults: run `npm run assign-categories` after re-exporting the catalog spreadsheet.
 */
export function inferCategory(item: CategoryItem): ProductCategory | "OTHER" {
  const sku = String(item.sku || "").trim().toUpperCase();
  const text = normalizeText(item);
  const storage = String(item.storage_type || "").trim();
  const prefix = skuPrefix(sku);
  const explicit = normalizeLegacyCategory(String(item.category || ""));

  // Keep precise Admin overrides, but allow legacy/generic categories in the spreadsheet
  // to be refined into SEAFOOD, ICE CREAM, PRODUCE, DRINK, etc.
  if (
    explicit &&
    !["FROZEN", "REFRIGERATED", "SNACK", "DRY GOODS", "OTHER"].includes(explicit)
  ) {
    return explicit;
  }

  const fromKeywords = inferFromKeywords(text, sku);
  if (fromKeywords) return fromKeywords;

  const fromStorage = inferFromStorage(storage, text);
  if (fromStorage) return fromStorage;

  const fromPrefix = inferFromSkuPrefix(prefix, text);
  if (fromPrefix) return fromPrefix;

  if (explicit) return explicit;

  if (storage.toLowerCase() === "dry") return "DRY GOODS";

  return "OTHER";
}

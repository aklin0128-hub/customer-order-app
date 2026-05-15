export const CATEGORY_OPTIONS = [
  "ALL",
  "RICE",
  "SAUCE",
  "SEASONING",
  "NOODLES",
  "PROCESSED",
  "FROZEN",
  "REFRIGERATED",
  "SNACK",
  "NON-FOOD",
] as const;

export type ProductCategory = (typeof CATEGORY_OPTIONS)[number] extends infer T
  ? T extends "ALL"
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
  "02": "PROCESSED",
  "03": "SAUCE",
  "04": "SAUCE",
  "05": "SEASONING",
  "06": "PROCESSED",
  "08": "NOODLES",
  "09": "SNACK",
  "10": "PROCESSED",
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
  "95": "PROCESSED",
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
    return "NOODLES";
  }

  if (
    matchAny(text, ["RICE FLOUR", "MOCHIKO", "RICE PAPER", "RICE STICK", "RICE WINE"]) ||
    (text.includes("FLOUR") && !text.includes("RICE"))
  ) {
    return "PROCESSED";
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
    return "PROCESSED";
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
      "POPSICLE",
      "ICE CREAM",
      "MOCHI ICE",
    ])
  ) {
    return "SNACK";
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
      "ICE CREAM",
      "POPSICLE",
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
    return "REFRIGERATED";
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
      "FISH CAKE",
      "BREAD CRUMB",
      "PANKO",
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
    return "PROCESSED";
  }

  return null;
}

function inferFromStorage(storage: string, text: string): ProductCategory | null {
  const s = storage.trim().toLowerCase();

  if (s === "frz" || s === "frozen") {
    if (matchAny(text, ["ICE CREAM", "POPSICLE", "SNACK", "CHIP", "CRACKER"])) return "SNACK";
    return "FROZEN";
  }

  if (s === "ref" || s === "refrigerated") {
    if (matchAny(text, ["NOODLE", "MISO", "SAUCE", "POWDER", "PEPPER"])) {
      if (matchAny(text, ["NOODLE"])) return "NOODLES";
      if (matchAny(text, ["MISO", "SAUCE"])) return "SAUCE";
      if (matchAny(text, ["POWDER", "PEPPER"])) return "SEASONING";
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
    if (matchAny(text, ["SQUID", "FISH", "SEAFOOD", "OCTOPUS"])) return "FROZEN";
    return "PROCESSED";
  }

  if (prefix === "04") {
    if (matchAny(text, ["POWDER", "BOUILLON", "STOCK"])) return "SEASONING";
    return "SAUCE";
  }

  if (prefix === "02") {
    if (text.includes("RICE")) return "PROCESSED";
    return "PROCESSED";
  }

  if (prefix === "10") {
    if (matchAny(text, ["TEA", "COFFEE", "JUICE", "DRINK", "WATER", "MILK", "POCARI"])) return "PROCESSED";
    return "PROCESSED";
  }

  if (prefix === "AM") {
    if (matchAny(text, ["SAUCE", "PASTE", "CHILI"])) return "SAUCE";
    if (matchAny(text, ["NOODLE"])) return "NOODLES";
    return "PROCESSED";
  }

  if (prefix === "08" || NOODLE_BRANDS.some((b) => text.includes(b))) {
    if (matchAny(text, ["NOODLE", "RAMEN", "UDON", "SOBA", "NAENGMYEON", "CHAPAGETTI", "CUP", "BOWL"])) {
      return "NOODLES";
    }
  }

  return base;
}

export function inferCategory(item: CategoryItem): ProductCategory | "OTHER" {
  const explicit = String(item.category || "").trim().toUpperCase();
  if (explicit && explicit !== "OTHER" && explicit !== "ALL") {
    return explicit as ProductCategory;
  }

  const sku = String(item.sku || "").trim().toUpperCase();
  const text = normalizeText(item);
  const storage = String(item.storage_type || "").trim();
  const prefix = skuPrefix(sku);

  const fromKeywords = inferFromKeywords(text, sku);
  if (fromKeywords) return fromKeywords;

  const fromStorage = inferFromStorage(storage, text);
  if (fromStorage) return fromStorage;

  const fromPrefix = inferFromSkuPrefix(prefix, text);
  if (fromPrefix) return fromPrefix;

  if (storage.toLowerCase() === "dry") return "PROCESSED";

  return "OTHER";
}

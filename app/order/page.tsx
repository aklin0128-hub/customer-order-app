"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { brandMatchesFilter, isKnownBrandFilter, splitBrandFilters } from "@/lib/catalogBrands";
import { CATEGORY_OPTIONS, inferCategory } from "@/lib/inferCategory";

import { CatalogVirtualGrid } from "./components/CatalogVirtualGrid";
import { CatalogQtyCard } from "./components/CatalogQtyCard";
import { OrderCartSection } from "./components/OrderCartSection";
import { OrderInput } from "./components/OrderInput";
import { OrderReviewModal } from "./components/OrderReviewModal";
import { OrderSubmittedModal } from "./components/OrderSubmittedModal";
import {
  buildClearanceUpsellLines,
  buildWeeklyUpsellLines,
} from "./salesFlow";
import { ProductImage } from "./components/ProductImage";
import { replaceCatalog, catalog } from "./catalogState";
import {
  formatBrandLabel,
  formatClearanceDetails,
  formatPromoBuyXGetY,
  formatPromoBuyXGetYPackHint,
  formatPromoDetails,
  generateOrderRef,
  getCatalogItemBySku,
  getDisplayStatus,
  getStatusBadgeStyle,
  isNewItem,
  isNormalItem,
} from "./catalogUtils";
import { copy } from "./orderCopy";
import {
  brandSelectStyle,
  cardStyle,
  cartSummaryTextStyle,
  categoryBarStyle,
  categoryButtonStyle,
  compactCatalogToolsRowStyle,
  containerStyle,
  dangerButtonStyle,
  emptyStyle,
  filterBlockStyle,
  filterLabelStyle,
  fixedSubmitBarStyle,
  langButtonStyle,
  limitedBadgeStyle,
  mainStyle,
  modeButtonStyle,
  modeTabsStyle,
  newItemsButtonStyle,
  primarySmallButtonStyle,
  productSmallButtonStyle,
  promoGridStyle,
  clearanceModeButtonStyle,
  promoModeButtonStyle,
  qtyButtonStyle,
  secondaryButtonStyle,
  sectionTitleStyle,
  sectionToggleStyle,
  smallButtonStyle,
  stepButtonStyle,
  stepInputStyle,
  stickyCatalogToolsStyle,
  submitButtonStyle,
  toggleTextStyle,
  wideInputStyle,
} from "./orderStyles";
import type { CartItem, CatalogItem, ClearanceItem, Lang, OrderHistoryItem, OrderMode, PromotionItem } from "./types";

const ORDER_LANG_LABELS: Record<Lang, string> = {
  en: "EN",
  zh: "中文",
  ko: "한국어",
  vi: "Tiếng Việt",
};

const quickQtyButtons = ["1", "2", "3", "4", "5", "10", "15", "20"];

const categoryOptions = CATEGORY_OPTIONS;

export default function OrderPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const skuInputRef = useRef<HTMLInputElement | null>(null);
  const submitLockRef = useRef(false);

  const [lang, setLang] = useState<Lang>("en");
  const [mode, setMode] = useState<OrderMode>("promotion");
  const [ready, setReady] = useState(false);
  const [accountNo, setAccountNo] = useState("");
  const [storeName, setStoreName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [skuInput, setSkuInput] = useState("");
  const [qtyInput, setQtyInput] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [catalogQtyMap, setCatalogQtyMap] = useState<Record<string, string>>({});
  const [catalogSearch, setCatalogSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [brandFilter, setBrandFilter] = useState("ALL");
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState("");
  const [showReview, setShowReview] = useState(false);
  const [lastSubmittedRef, setLastSubmittedRef] = useState("");
  const [lastSubmittedItems, setLastSubmittedItems] = useState<CartItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<CatalogItem | null>(null);
  const [autoLoaded, setAutoLoaded] = useState(false);
  const [showAvailableOnly, setShowAvailableOnly] = useState(false);
  const [showCustomerInfo, setShowCustomerInfo] = useState(false);
  const [showRecent, setShowRecent] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [expandedHistoryKey, setExpandedHistoryKey] = useState("");
  const [showCart, setShowCart] = useState(true);
  const [catalogShowSelectedOnly, setCatalogShowSelectedOnly] = useState(false);
  const [catalogShowNewOnly, setCatalogShowNewOnly] = useState(false);
  const [catalogShowRecommendedOnly, setCatalogShowRecommendedOnly] = useState(false);
  const [catalogFiltersOpen, setCatalogFiltersOpen] = useState(false);
  const [recentItems, setRecentItems] = useState<CartItem[]>([]);
  const [orderHistory, setOrderHistory] = useState<OrderHistoryItem[]>([]);
  const [catalogVersion, setCatalogVersion] = useState(0);
  const [promotionItems, setPromotionItems] = useState<PromotionItem[]>([]);
  const [promotionsLoading, setPromotionsLoading] = useState(false);
  const [clearanceItems, setClearanceItems] = useState<ClearanceItem[]>([]);
  const [clearanceLoading, setClearanceLoading] = useState(false);
  const [showAdminEditLinks, setShowAdminEditLinks] = useState(false);

  const t = copy[lang];

  useEffect(() => {
    setShowAdminEditLinks(Boolean(sessionStorage.getItem("admin_password")));

    const loadCatalog = async () => {
      try {
        const res = await fetch("/api/catalog", { cache: "no-store" });
        const data = await res.json();
        if (res.ok && Array.isArray(data.products)) {
          replaceCatalog(data.products);
          setCatalogVersion((v) => v + 1);
        }
      } catch {}
    };
    loadCatalog();
  }, []);

  useEffect(() => {
    if (!ready) return;

    const loadPromotions = async () => {
      setPromotionsLoading(true);
      try {
        const res = await fetch("/api/promotions", { cache: "no-store" });
        const data = await res.json();
        if (res.ok && Array.isArray(data.products)) {
          setPromotionItems(
            data.products.filter((item: PromotionItem) => isNormalItem(item))
          );
        }
      } catch {
      } finally {
        setPromotionsLoading(false);
      }
    };

    const loadClearance = async () => {
      setClearanceLoading(true);
      try {
        const res = await fetch("/api/clearance", { cache: "no-store" });
        const data = await res.json();
        if (res.ok && Array.isArray(data.products)) {
          setClearanceItems(
            data.products.filter((item: ClearanceItem) => isNormalItem(item))
          );
        }
      } catch {
      } finally {
        setClearanceLoading(false);
      }
    };

    loadPromotions();
    loadClearance();
  }, [ready]);

  useEffect(() => {
    const saved = localStorage.getItem("lang") as Lang | null;
    if (saved === "en" || saved === "zh" || saved === "ko" || saved === "vi") setLang(saved);

    const savedMode = localStorage.getItem("order_mode") as OrderMode | null;
    if (savedMode === "catalog" || savedMode === "promotion" || savedMode === "clearance") {
      setMode(savedMode);
    } else if (savedMode === "search" || !savedMode) {
      setMode("promotion");
    }
  }, []);

  const changeLang = (next: Lang) => {
    setLang(next);
    localStorage.setItem("lang", next);
  };

  const changeMode = (next: OrderMode) => {
    setMode(next);
    localStorage.setItem("order_mode", next);
    setSubmitMsg("");
  };

  useEffect(() => {
    const loggedIn = sessionStorage.getItem("customer_logged_in");
    const savedAccount = sessionStorage.getItem("customer_account_no");
    const savedStore = sessionStorage.getItem("customer_store_name");

    if (loggedIn !== "true" || !savedAccount) {
      router.replace("/");
      return;
    }

    setAccountNo(savedAccount);
    setStoreName(savedStore || "");
    setReady(true);
  }, [router]);

  const loadRecentAndHistory = async (acct: string) => {
    try {
      const recentRes = await fetch(`/api/recent-items?accountNo=${encodeURIComponent(acct)}`, { cache: "no-store" });
      const recentData = await recentRes.json();
      if (recentRes.ok && Array.isArray(recentData.recentItems)) setRecentItems(recentData.recentItems);
    } catch {}

    try {
      const historyRes = await fetch(`/api/order-history?accountNo=${encodeURIComponent(acct)}`, { cache: "no-store" });
      const historyData = await historyRes.json();
      if (historyRes.ok && Array.isArray(historyData.history)) setOrderHistory(historyData.history);
    } catch {}
  };

  useEffect(() => {
    if (!ready || !accountNo || autoLoaded) return;

    const loadDrafts = async () => {
      const localDraft = localStorage.getItem(`draft_${accountNo}`);
      if (localDraft) {
        try {
          const parsed = JSON.parse(localDraft);
          setPhone(parsed.phone || "");
          setNote(parsed.note || "");
          setCart(Array.isArray(parsed.cart) ? parsed.cart : []);
          setCatalogQtyMap(parsed.catalogQtyMap && typeof parsed.catalogQtyMap === "object" ? parsed.catalogQtyMap : {});
        } catch {}
      }

      try {
        const res = await fetch(`/api/load-draft?accountNo=${encodeURIComponent(accountNo)}`, { method: "GET", cache: "no-store" });
        const data = await res.json();
        if (res.ok && data?.draft) {
          setPhone(data.draft.phone || "");
          setNote(data.draft.note || "");
          setCart(Array.isArray(data.draft.cart) ? data.draft.cart : []);
          setCatalogQtyMap(data.draft.catalogQtyMap && typeof data.draft.catalogQtyMap === "object" ? data.draft.catalogQtyMap : {});
          setSubmitMsg(t.loadedDraft);
        }
      } catch {}

      await loadRecentAndHistory(accountNo);
      setAutoLoaded(true);
      // Do not auto-focus SKU input on mobile; prevents page from jumping.
    };

    loadDrafts();
  }, [ready, accountNo, autoLoaded, t.loadedDraft]);

  useEffect(() => {
    if (!ready || !accountNo || !autoLoaded) return;

    const draft = { phone, note, cart, catalogQtyMap };
    localStorage.setItem(`draft_${accountNo}`, JSON.stringify(draft));

    const timer = setTimeout(async () => {
      try {
        await fetch("/api/save-draft", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accountNo, storeName, phone: phone.trim(), note: note.trim(), cart, catalogQtyMap }),
        });
      } catch {}
    }, 700);

    return () => clearTimeout(timer);
  }, [ready, accountNo, phone, note, cart, catalogQtyMap, autoLoaded]);

  const normalizedSkuInput = useMemo(() => skuInput.trim().toUpperCase(), [skuInput]);

  const matchedItems = useMemo(() => {
    if (!normalizedSkuInput) return [];
    const q = normalizedSkuInput;

    const scoreItem = (item: CatalogItem) => {
      const sku = item.sku?.toUpperCase() || "";
      const name = item.name?.toUpperCase() || "";
      const brand = item.brand?.toUpperCase() || "";
      const barcode = item.barcode?.toUpperCase() || "";
      const upc = item.upc?.toUpperCase() || "";

      if (sku === q) return 1000;
      if (sku.startsWith(q)) return 900;
      if (barcode === q || upc === q) return 850;
      if (barcode.startsWith(q) || upc.startsWith(q)) return 800;
      if (sku.includes(q)) return 700;
      if (q.length >= 3 && brand.startsWith(q)) return 500;
      if (q.length >= 3 && name.startsWith(q)) return 450;
      if (q.length >= 3 && (name.includes(q) || brand.includes(q) || barcode.includes(q) || upc.includes(q))) return 200;
      return -1;
    };

    return catalog
      .map((item) => ({ item, score: scoreItem(item) }))
      .filter((x) => x.score >= 0)
      .filter((x) => (showAvailableOnly ? isNormalItem(x.item) : true))
      .sort((a, b) => {
        const aNormal = isNormalItem(a.item);
        const bNormal = isNormalItem(b.item);
        if (aNormal !== bNormal) return aNormal ? -1 : 1;
        if (b.score !== a.score) return b.score - a.score;
        return (a.item.sku || "").localeCompare(b.item.sku || "");
      })
      .map((x) => x.item)
      .slice(0, 60);
  }, [normalizedSkuInput, showAvailableOnly, catalogVersion]);

  const orderableBaseItems = useMemo(() => {
    return catalog.filter((item) => isNormalItem(item));
  }, [catalogVersion]);

  const brandSplit = useMemo(
    () => splitBrandFilters(orderableBaseItems),
    [orderableBaseItems]
  );

  const newItemCount = useMemo(
    () => orderableBaseItems.filter((item) => isNewItem(item)).length,
    [orderableBaseItems]
  );

  const recommendedSkuSet = useMemo(() => {
    const skuSet = new Set<string>();

    for (const item of recentItems) {
      const sku = item.sku?.toUpperCase();
      if (sku) skuSet.add(sku);
    }

    for (const order of orderHistory) {
      for (const item of order.items || []) {
        const sku = item.sku?.toUpperCase();
        if (sku) skuSet.add(sku);
      }
    }

    return skuSet;
  }, [orderHistory, recentItems]);

  const recommendedItemCount = useMemo(
    () => orderableBaseItems.filter((item) => recommendedSkuSet.has(item.sku?.toUpperCase() || "")).length,
    [orderableBaseItems, recommendedSkuSet]
  );

  const activeCatalogFilterCount = useMemo(() => {
    let count = 0;
    if (categoryFilter !== "ALL") count += 1;
    if (brandFilter !== "ALL") count += 1;
    if (catalogShowNewOnly) count += 1;
    if (catalogShowRecommendedOnly) count += 1;
    if (catalogShowSelectedOnly) count += 1;
    return count;
  }, [brandFilter, catalogShowNewOnly, catalogShowRecommendedOnly, catalogShowSelectedOnly, categoryFilter]);

  const orderableCatalogItems = useMemo(() => {
    const q = catalogSearch.trim().toUpperCase();

    return orderableBaseItems
      .filter((item) => {
        if (catalogShowSelectedOnly) {
          const sku = (item.sku || "").toUpperCase();
          if (Number(catalogQtyMap[sku] || 0) <= 0) return false;
        }
        if (categoryFilter !== "ALL" && inferCategory(item) !== categoryFilter) return false;
        if (brandFilter !== "ALL" && !brandMatchesFilter(item.brand, brandFilter)) return false;
        if (catalogShowNewOnly && !isNewItem(item)) return false;
        if (catalogShowRecommendedOnly && !recommendedSkuSet.has(item.sku?.toUpperCase() || "")) return false;
        return true;
      })
      .filter((item) => {
        if (!q) return true;
        return (
          item.sku?.toUpperCase().includes(q) ||
          item.name?.toUpperCase().includes(q) ||
          item.brand?.toUpperCase().includes(q) ||
          item.barcode?.toUpperCase().includes(q) ||
          item.upc?.toUpperCase().includes(q)
        );
      })
      .sort((a, b) => (a.sku || "").localeCompare(b.sku || ""));
  }, [catalogSearch, categoryFilter, brandFilter, catalogQtyMap, orderableBaseItems, catalogShowSelectedOnly, catalogShowNewOnly, catalogShowRecommendedOnly, recommendedSkuSet]);

  useEffect(() => {
    if (brandFilter !== "ALL" && !isKnownBrandFilter(brandSplit, brandFilter)) {
      setBrandFilter("ALL");
    }
  }, [brandFilter, brandSplit]);

  const catalogItemsForSubmit = useMemo(() => {
    return Object.entries(catalogQtyMap)
      .map(([sku, qty]) => ({ sku: sku.toUpperCase(), qty: String(qty || "").trim() }))
      .filter((item) => item.qty && Number(item.qty) > 0)
      .filter((item) => {
        const catalogItem = getCatalogItemBySku(item.sku);
        return !catalogItem || isNormalItem(catalogItem);
      });
  }, [catalogQtyMap, catalogVersion]);

  const cartItemCount = catalogItemsForSubmit.length;

  const totalCases = useMemo(() => {
    return catalogItemsForSubmit.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
  }, [catalogItemsForSubmit]);

  const setQtyForSku = (sku: string, value: string) => {
    const cleanSku = sku.trim().toUpperCase();
    const cleanQty = String(value || "").replace(/[^0-9]/g, "");

    setCatalogQtyMap((prev) => {
      const next = { ...prev };
      if (!cleanQty || Number(cleanQty) <= 0) delete next[cleanSku];
      else next[cleanSku] = String(Number(cleanQty));
      return next;
    });

    setCart((prev) => {
      const withoutSku = prev.filter((item) => item.sku.toUpperCase() !== cleanSku);
      if (!cleanQty || Number(cleanQty) <= 0) return withoutSku;
      return [...withoutSku, { sku: cleanSku, qty: String(Number(cleanQty)) }];
    });
  };

  const getPromoRemainingForSku = (cleanSku: string) => {
    const promo = promotionItems.find((p) => p.sku?.toUpperCase() === cleanSku);
    if (!promo) return null;
    if (promo.remainingQty === null || promo.remainingQty === undefined) {
      if (promo.promoQty && promo.promoQty > 0) {
        return Math.max(0, promo.promoQty - (promo.soldQty || 0));
      }
      return null;
    }
    return promo.remainingQty;
  };

  const getClearanceRemainingForSku = (cleanSku: string) => {
    const item = clearanceItems.find((p) => p.sku?.toUpperCase() === cleanSku);
    if (!item) return null;
    if (item.remainingQty === null || item.remainingQty === undefined) {
      if (item.clearanceQty && item.clearanceQty > 0) {
        return Math.max(0, item.clearanceQty - (item.soldQty || 0));
      }
      return null;
    }
    return item.remainingQty;
  };

  const orderReviewWarnings = useMemo(() => {
    const warnings: string[] = [];

    for (const item of catalogItemsForSubmit) {
      const cleanSku = item.sku.toUpperCase();
      const qty = Number(item.qty || 0);
      const catalogItem = getCatalogItemBySku(cleanSku);
      const status = String(catalogItem?.status || "").trim().toUpperCase();
      const limitedQty = Number(String(catalogItem?.limitedQty || "").replace(/[^0-9]/g, ""));
      const promoRemaining = getPromoRemainingForSku(cleanSku);
      const clearanceRemaining = getClearanceRemainingForSku(cleanSku);

      if (qty >= 100) warnings.push(t.highQtyWarning.replace("{sku}", cleanSku).replace("{qty}", String(qty)));
      if (catalogItem && !isNormalItem(catalogItem)) warnings.push(t.statusWarning.replace("{sku}", cleanSku).replace("{status}", status || "-"));
      if (limitedQty > 0 && qty > limitedQty) warnings.push(t.limitedQtyWarning.replace("{sku}", cleanSku).replace("{qty}", String(limitedQty)));
      if (promoRemaining !== null && qty > promoRemaining) warnings.push(t.promoQtyWarning.replace("{sku}", cleanSku).replace("{qty}", String(promoRemaining)));
      if (clearanceRemaining !== null && qty > clearanceRemaining) {
        warnings.push(t.clearanceQtyWarning.replace("{sku}", cleanSku).replace("{qty}", String(clearanceRemaining)));
      }

      const promo = promotionItems.find((p) => p.sku?.toUpperCase() === cleanSku);
      if (promo?.buyQty && promo?.getQtyFree && qty > 0) {
        const pack = promo.buyQty + promo.getQtyFree;
        if (qty % pack !== 0) {
          warnings.push(
            t.promoBogoQtyWarning
              .replace("{sku}", cleanSku)
              .replace("{buy}", String(promo.buyQty))
              .replace("{free}", String(promo.getQtyFree))
              .replace("{pack}", String(pack))
              .replace("{qty}", String(qty))
          );
        }
      }
    }

    return warnings;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogItemsForSubmit, promotionItems, clearanceItems, t]);

  const promoSkuSet = useMemo(
    () => new Set(promotionItems.map((item) => item.sku?.toUpperCase()).filter(Boolean) as Iterable<string>),
    [promotionItems]
  );

  const clearanceSkuSet = useMemo(
    () => new Set(clearanceItems.map((item) => item.sku?.toUpperCase()).filter(Boolean)),
    [clearanceItems]
  );

  const promoDealBySku = useMemo(() => {
    const map: Record<string, string> = {};
    for (const item of promotionItems) {
      const sku = item.sku?.toUpperCase();
      if (!sku) continue;
      const label = formatPromoBuyXGetY(item, t);
      if (label) map[sku] = label;
    }
    return map;
  }, [promotionItems, t]);

  const cartSkuSet = useMemo(
    () => new Set(catalogItemsForSubmit.map((item) => item.sku.toUpperCase())),
    [catalogItemsForSubmit]
  );

  const weeklyUpsellLines = useMemo(
    () => buildWeeklyUpsellLines(lang, promotionItems, cartSkuSet, t),
    [lang, promotionItems, cartSkuSet, t]
  );

  const clearanceUpsellLines = useMemo(
    () => buildClearanceUpsellLines(lang, clearanceItems, cartSkuSet, t),
    [lang, clearanceItems, cartSkuSet, t]
  );

  const weeklyInCartCount = useMemo(
    () => catalogItemsForSubmit.filter((item) => promoSkuSet.has(item.sku.toUpperCase())).length,
    [catalogItemsForSubmit, promoSkuSet]
  );

  const clearanceInCartCount = useMemo(
    () => catalogItemsForSubmit.filter((item) => clearanceSkuSet.has(item.sku.toUpperCase())).length,
    [catalogItemsForSubmit, clearanceSkuSet]
  );

  const postSubmitSuggestLines = useMemo(() => {
    if (!lastSubmittedRef || lastSubmittedItems.length === 0) return [];
    const submittedSkus = new Set(lastSubmittedItems.map((item) => item.sku.toUpperCase()));
    return buildWeeklyUpsellLines(lang, promotionItems, submittedSkus, t);
  }, [lastSubmittedRef, lastSubmittedItems, promotionItems, lang, t]);

  const showNewItemsReviewReminder = useMemo(() => {
    if (newItemCount === 0 || catalogItemsForSubmit.length === 0) return false;
    return catalogItemsForSubmit.every((item) => {
      const catalogItem = getCatalogItemBySku(item.sku);
      return !isNewItem(catalogItem);
    });
  }, [catalogItemsForSubmit, newItemCount]);

  const adjustQtyForSku = (sku: string, delta: number) => {
    const cleanSku = sku.trim().toUpperCase();
    const current = Number(catalogQtyMap[cleanSku] || 0);
    let next = Math.max(0, current + delta);

    const promoRemaining = getPromoRemainingForSku(cleanSku);
    if (delta > 0 && promoRemaining !== null && next > promoRemaining) {
      alert(t.promoLimitAlert.replace("{sku}", cleanSku).replace("{qty}", String(promoRemaining)));
      next = promoRemaining;
    }

    const clearanceRemaining = getClearanceRemainingForSku(cleanSku);
    if (delta > 0 && clearanceRemaining !== null && next > clearanceRemaining) {
      alert(t.clearanceLimitAlert.replace("{sku}", cleanSku).replace("{qty}", String(clearanceRemaining)));
      next = clearanceRemaining;
    }

    const catalogItem = getCatalogItemBySku(cleanSku);
    const limitedQty = Number(String(catalogItem?.limitedQty || "").replace(/[^0-9]/g, ""));
    if (delta > 0 && limitedQty > 0 && next > limitedQty) {
      alert(`${cleanSku} limited qty is ${limitedQty}.`);
      next = limitedQty;
    }

    setQtyForSku(cleanSku, next ? String(next) : "");
  };

  const removeSkuFromOrder = (sku: string) => {
    setQtyForSku(sku, "");
  };

  const addAllWeeklyPicksOneCase = () => {
    for (const item of promotionItems) {
      if (item.remainingQty === 0) continue;
      const sku = item.sku?.toUpperCase();
      if (sku) adjustQtyForSku(sku, 1);
    }
  };

  const addAllClearanceOneCase = () => {
    for (const item of clearanceItems) {
      if (item.remainingQty === 0) continue;
      const sku = item.sku?.toUpperCase();
      if (sku) adjustQtyForSku(sku, 1);
    }
  };

  const addAllMissingWeeklyUpsell = () => {
    for (const line of weeklyUpsellLines) adjustQtyForSku(line.sku, 1);
  };

  const addAllMissingClearanceUpsell = () => {
    for (const line of clearanceUpsellLines) adjustQtyForSku(line.sku, 1);
  };

  useEffect(() => {
    if (!normalizedSkuInput) {
      setSelectedItem(null);
      return;
    }

    const exactMatch = catalog.find((item) => item.sku?.toUpperCase() === normalizedSkuInput) || null;
    if (exactMatch && (!showAvailableOnly || isNormalItem(exactMatch))) {
      setSelectedItem(exactMatch);
      return;
    }

    setSelectedItem(matchedItems.length > 0 ? matchedItems[0] : null);
  }, [normalizedSkuInput, matchedItems, showAvailableOnly]);

  const syncCatalogQty = (sku: string, qty: string) => {
    const cleanSku = sku.trim().toUpperCase();
    const qtyNumber = Number(String(qty || "").replace(/[^0-9]/g, ""));
    if (!cleanSku || !qtyNumber || qtyNumber <= 0) return;

    setCatalogQtyMap((prev) => {
      const current = Number(prev[cleanSku] || 0);
      return { ...prev, [cleanSku]: String(current + qtyNumber) };
    });
  };

  const addSkuToCart = (sku: string, qty = "1") => {
    const finalSku = sku.trim().toUpperCase();
    if (!finalSku) return;

    const item = getCatalogItemBySku(finalSku);
    if (item && !isNormalItem(item)) {
      alert(t.unavailable);
      return;
    }

    const finalQty = String(qty || "").trim() || "1";
    const duplicated = cart.some((x) => x.sku.toUpperCase() === finalSku);
    if (duplicated && !confirm(`${finalSku} ${t.duplicate}`)) return;

    const currentQty = Number(catalogQtyMap[finalSku] || 0);
    const nextQty = currentQty + (Number(String(finalQty).replace(/[^0-9]/g, "")) || 1);
    setQtyForSku(finalSku, String(nextQty));

    setSkuInput("");
    setQtyInput("");
    setSelectedItem(null);
    // Do not auto-focus SKU input; prevents page from jumping.
  };

  const addItem = () => {
    const typedSku = skuInput.trim().toUpperCase();
    const exactMatch = catalog.find((item) => item.sku?.toUpperCase() === typedSku) || null;
    const finalItem = exactMatch || selectedItem || matchedItems[0] || null;
    const finalSku = finalItem?.sku || typedSku;
    const qty = qtyInput.trim().toUpperCase() || "1";

    if (!finalSku) {
      alert(t.enterSku);
      return;
    }

    addSkuToCart(finalSku, qty);
  };

  const addSkuFromSearch = (item: CatalogItem, qty = "1") => {
    if (!isNormalItem(item)) {
      alert(t.unavailable);
      return;
    }
    addSkuToCart(item.sku, qty);
  };

  const updateCatalogQty = (sku: string, value: string) => {
    const cleanSku = sku.toUpperCase();
    const clean = value.replace(/[^0-9]/g, "");

    const catalogItem = getCatalogItemBySku(cleanSku);
    const limitedQty = Number(String(catalogItem?.limitedQty || "").replace(/[^0-9]/g, ""));
    if (clean && limitedQty > 0 && Number(clean) > limitedQty) {
      alert(`${cleanSku} limited qty is ${limitedQty}.`);
      return;
    }

    const promoRemaining = getPromoRemainingForSku(cleanSku);
    if (clean && promoRemaining !== null && Number(clean) > promoRemaining) {
      alert(t.promoLimitAlert.replace("{sku}", cleanSku).replace("{qty}", String(promoRemaining)));
      setQtyForSku(cleanSku, promoRemaining ? String(promoRemaining) : "");
      return;
    }

    setQtyForSku(cleanSku, clean);
  };

  const adjustCatalogQty = (sku: string, delta: number) => {
    adjustQtyForSku(sku, delta);
  };

  const reorderItems = (items: CartItem[]) => {
    const valid = items.filter((item) => {
      const catalogItem = getCatalogItemBySku(item.sku);
      return !catalogItem || isNormalItem(catalogItem);
    });

    if (valid.length === 0) {
      alert(t.unavailable);
      return;
    }

    setCart((prev) => [...prev, ...valid]);
    setCatalogQtyMap((prev) => {
      const next = { ...prev };
      for (const item of valid) {
        const qtyNumber = Number(String(item.qty || "").replace(/[^0-9]/g, ""));
        if (qtyNumber > 0) next[item.sku.toUpperCase()] = String(Number(next[item.sku.toUpperCase()] || 0) + qtyNumber);
      }
      return next;
    });
    setSubmitMsg(`${valid.length} ${t.items} added.`);
    // Do not auto-focus SKU input; prevents page from jumping.
  };

  const removeItem = (index: number) => {
    const target = cart[index];
    if (target?.sku) removeSkuFromOrder(target.sku);
  };

  const updateCartQty = (index: number, qty: string) => {
    const target = cart[index];
    if (!target?.sku) return;
    setQtyForSku(target.sku, qty);
  };

  const clearOrder = async () => {
    if (!confirm(t.clearConfirm)) return;

    setCart([]);
    setCatalogQtyMap({});
    setSkuInput("");
    setQtyInput("");
    setSelectedItem(null);
    setSubmitMsg(t.cleared);
    localStorage.removeItem(`draft_${accountNo}`);

    try {
      await fetch("/api/delete-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountNo }),
      });
    } catch {}

    // Do not auto-focus SKU input; prevents page from jumping.
  };

  const getCurrentSubmitItems = () => {
    return catalogItemsForSubmit;
  };

  const downloadCsv = () => {
    const items = getCurrentSubmitItems();
    if (items.length === 0) {
      alert(t.noItems);
      return;
    }

    const rows = ["SKU,Qty", ...items.map((item) => `${item.sku},${item.qty}`)];
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const filename = `${accountNo || "orders"}_orders_${mm}${dd}.csv`;

    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleUploadCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      if (lines.length === 0) {
        alert(t.csvEmpty);
        return;
      }

      let startIndex = 0;
      const firstLine = lines[0].replace(/\s/g, "").toUpperCase();
      if (firstLine === "SKU,QTY" || firstLine === "SKU,QUANTITY") startIndex = 1;

      const parsed: CartItem[] = [];
      const parsedMap: Record<string, string> = {};

      for (let i = startIndex; i < lines.length; i++) {
        const parts = lines[i].split(",");
        if (parts.length < 2) continue;

        const sku = (parts[0] || "").trim().toUpperCase();
        const qty = parts.slice(1).join(",").trim().toUpperCase();
        if (!sku || !qty) continue;

        const catalogItem = getCatalogItemBySku(sku);
        if (catalogItem && !isNormalItem(catalogItem)) continue;

        parsed.push({ sku, qty });
        if (Number(qty) > 0) parsedMap[sku] = String(Number(qty));
      }

      if (parsed.length === 0) {
        alert(t.noValidRows);
        return;
      }

      setCatalogQtyMap(parsedMap);
      setCart(parsed);
      setSubmitMsg(`${parsed.length} ${t.items} loaded.`);
    } catch (error: any) {
      alert(error?.message || "Failed to read CSV.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const logout = () => {
    sessionStorage.removeItem("customer_logged_in");
    sessionStorage.removeItem("customer_account_no");
    sessionStorage.removeItem("customer_store_name");
    router.replace("/");
  };

  const openReview = () => {
    const items = getCurrentSubmitItems();

    if (items.length === 0) {
      alert(t.addAtLeast);
      return;
    }

    const unavailableItems = items.filter((item) => {
      const catalogItem = getCatalogItemBySku(item.sku);
      return catalogItem && !isNormalItem(catalogItem);
    });

    if (unavailableItems.length > 0) {
      alert(`${t.unavailable}

${unavailableItems.map((item) => item.sku).join(", ")}`);
      return;
    }

    setShowReview(true);
  };

  const submitOrder = async () => {
    if (submitLockRef.current || submitting) return;

    const items = getCurrentSubmitItems();

    if (items.length === 0) {
      alert(t.addAtLeast);
      return;
    }

    const ref = generateOrderRef(accountNo);

    submitLockRef.current = true;
    setSubmitting(true);
    setSubmitMsg("");

    try {
      const res = await fetch("/api/send-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountNo, storeName, phone: phone.trim(), note: note.trim(), orderRef: ref, items }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || t.failedSubmit);

      setSubmitMsg(`${t.orderSuccess} ${t.ref}: ${ref}`);
      setLastSubmittedRef(ref);
      setLastSubmittedItems(items);
      setShowReview(false);
      setCart([]);
      setCatalogQtyMap({});
      setSkuInput("");
      setQtyInput("");
      setSelectedItem(null);
      setNote("");
      localStorage.removeItem(`draft_${accountNo}`);

      await fetch("/api/delete-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountNo }),
      });

      await loadRecentAndHistory(accountNo);
      setCatalogVersion((v) => v + 1);

      setTimeout(() => {
        submitLockRef.current = false;
      }, 5000);
    } catch (error: any) {
      submitLockRef.current = false;
      setSubmitMsg(error?.message || t.failedSubmit);
    } finally {
      setSubmitting(false);
    }
  };

  const renderProductMeta = (item: CatalogItem) => (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginTop: 5, overflow: "visible" }}>
      {item.size ? <span style={{ fontSize: 10, color: "#6b7280" }}>{t.size}: {item.size}</span> : null}
      {item.palletSize ? <span style={{ fontSize: 10, color: "#6b7280" }}>{t.pallet}: {item.palletSize}</span> : null}
      {item.limitedQty ? <span style={limitedBadgeStyle}>{t.limited}: {item.limitedQty}</span> : null}
      {getDisplayStatus(item.status) ? <span style={{ padding: "2px 7px", borderRadius: 999, fontSize: 10, fontWeight: 700, ...getStatusBadgeStyle(item.status) }}>{getDisplayStatus(item.status)}</span> : null}
    </div>
  );

  if (!ready) return null;

  return (
    <main style={mainStyle}>
      <div style={containerStyle}>
        <section style={cardStyle}>
          <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 12 }}>
            {(["en", "zh", "ko", "vi"] as Lang[]).map((item) => (
              <button key={item} type="button" onClick={() => changeLang(item)} style={langButtonStyle(lang === item)}>
                {ORDER_LANG_LABELS[item]}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 21, fontWeight: 800, color: "#111827", lineHeight: 1.15 }}>{t.title}</div>
              <div style={{ marginTop: 4, fontSize: 12, color: "#6b7280", lineHeight: 1.4 }}>{t.pageSubtitle}</div>
              <div style={{ marginTop: 2, fontSize: 12, color: "#9ca3af" }}>{accountNo} | {storeName}</div>
            </div>
            <button type="button" onClick={logout} style={smallButtonStyle}>{t.logout}</button>
          </div>
        </section>

        <section style={cardStyle}>
          <div style={modeTabsStyle}>
            <button
              type="button"
              onClick={() => changeMode("promotion")}
              style={promoModeButtonStyle(mode === "promotion")}
            >
              {t.promotionMode}
              {promotionItems.length > 0 ? ` (${promotionItems.length})` : ""}
            </button>
            <button
              type="button"
              onClick={() => changeMode("clearance")}
              style={clearanceModeButtonStyle(mode === "clearance")}
            >
              {t.clearanceMode}
              {clearanceItems.length > 0 ? ` (${clearanceItems.length})` : ""}
            </button>
            <button type="button" onClick={() => changeMode("catalog")} style={modeButtonStyle(mode === "catalog")}>
              {t.catalogMode}
            </button>
            <button type="button" onClick={() => changeMode("search")} style={modeButtonStyle(mode === "search")}>
              {t.searchMode}
            </button>
          </div>
        </section>

        <section style={cardStyle}>
          <button type="button" onClick={() => setShowCustomerInfo((prev) => !prev)} style={sectionToggleStyle}>
            <div style={sectionTitleStyle}>{t.customerInfo}</div>
            <div style={toggleTextStyle}>{showCustomerInfo ? t.hide : t.show}</div>
          </button>

          {showCustomerInfo ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
              <OrderInput label={t.phone} value={phone} onChange={setPhone} placeholder="" />
              <OrderInput label={t.note} value={note} onChange={setNote} placeholder="" />
            </div>
          ) : null}
        </section>

        {(mode === "search" || mode === "catalog") && recentItems.length > 0 ? (
          <section style={cardStyle}>
            <button type="button" onClick={() => setShowRecent((prev) => !prev)} style={sectionToggleStyle}>
              <div style={sectionTitleStyle}>{t.recent}</div>
              <div style={toggleTextStyle}>{showRecent ? t.hide : t.show}</div>
            </button>

            {showRecent ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10, overflow: "visible" }}>
                {recentItems.slice(0, 12).map((item) => {
                  const catalogItem = getCatalogItemBySku(item.sku);
                  return (
                    <button key={item.sku} type="button" onClick={() => addSkuToCart(item.sku, item.qty || "1")} style={productSmallButtonStyle}>
                      <ProductImage sku={item.sku} alt={item.sku} size={42} imageUrl={catalogItem?.imageUrl} />
                      <div style={{ flex: 1, minWidth: 0, overflow: "visible" }}>
                        <div style={{ fontSize: 13, fontWeight: 900 }}>{item.sku}</div>
                        {catalogItem ? <div style={{ fontSize: 11, color: "#4b5563" }}>{catalogItem.brand ? `${catalogItem.brand} | ` : ""}{catalogItem.name || ""}</div> : null}
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: "#2563eb" }}>+ {item.qty || "1"}</div>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </section>
        ) : null}

        {mode === "search" ? (
          <section style={cardStyle}>
            <div style={{ ...sectionTitleStyle, marginBottom: 8 }}>{t.addItems}</div>
            <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 10px", lineHeight: 1.45 }}>{t.searchModeHint}</p>

            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 800, color: "#374151", marginBottom: 10 }}>
              <input type="checkbox" checked={showAvailableOnly} onChange={(e) => setShowAvailableOnly(e.target.checked)} />
              {t.availableOnly}
            </label>

            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6 }}>{t.skuItem}</label>
            <input
              ref={skuInputRef}
              value={skuInput}
              onChange={(e) => setSkuInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addItem(); } }}
              placeholder={t.searchPlaceholder}
              autoCapitalize="characters"
              style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: "1px solid #d1d5db", fontSize: 16, fontWeight: 700, boxSizing: "border-box" }}
            />

            {normalizedSkuInput && matchedItems.length === 0 ? (
              <div style={{ marginTop: 10, padding: 12, borderRadius: 10, background: "#f9fafb", color: "#6b7280", fontSize: 13, textAlign: "center" }}>
                {t.noMatches}
              </div>
            ) : null}

            {matchedItems.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
                {matchedItems.slice(0, 40).map((item, index) => {
                  const isActive = selectedItem?.sku === item.sku || (!selectedItem && index === 0);
                  const inCart = Number(catalogQtyMap[(item.sku || "").toUpperCase()] || 0) > 0;
                  return (
                    <div
                      key={item.sku}
                      style={{
                        position: "relative",
                        border: isActive ? "2px solid #2563eb" : "1px solid #e5e7eb",
                        background: inCart ? "#ecfdf5" : isActive ? "#eff6ff" : "#ffffff",
                        borderRadius: 12,
                        padding: 10,
                      }}
                    >
                      {showAdminEditLinks ? (
                        <a
                          href={`/admin/products?sku=${encodeURIComponent(item.sku)}`}
                          style={{
                            position: "absolute",
                            top: 8,
                            right: 8,
                            zIndex: 2,
                            border: "1px solid #bfdbfe",
                            borderRadius: 999,
                            background: "#eff6ff",
                            color: "#2563eb",
                            padding: "3px 8px",
                            fontSize: 10,
                            fontWeight: 900,
                            textDecoration: "none",
                          }}
                        >
                          {t.editProduct}
                        </a>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => { setSelectedItem(item); setSkuInput(item.sku); }}
                        style={{ width: "100%", border: "none", background: "transparent", padding: 0, textAlign: "left", cursor: "pointer" }}
                      >
                        <div style={{ display: "grid", gridTemplateColumns: "52px 1fr", gap: 10, alignItems: "start" }}>
                          <ProductImage sku={item.sku} alt={item.name || item.sku} size={52} imageUrl={item.imageUrl} />
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 800, color: "#111827" }}>
                              {item.sku}{item.brand ? ` | ${item.brand}` : ""}
                              {inCart ? <span style={{ marginLeft: 6, fontSize: 10, color: "#059669" }}>· {t.inCart}</span> : null}
                            </div>
                            <div style={{ fontSize: 12, color: "#374151", marginTop: 3, lineHeight: 1.4 }}>{item.name || "-"}</div>
                            {renderProductMeta(item)}
                          </div>
                        </div>
                      </button>
                      <div style={{ display: "flex", gap: 6, marginTop: 8, alignItems: "center" }}>
                        <button type="button" onClick={() => adjustCatalogQty(item.sku, -1)} style={{ ...stepButtonStyle, width: 36 }}>−</button>
                        <input
                          value={catalogQtyMap[(item.sku || "").toUpperCase()] || ""}
                          onChange={(e) => updateCatalogQty(item.sku, e.target.value)}
                          placeholder="0"
                          inputMode="numeric"
                          style={{ ...stepInputStyle, flex: 1 }}
                        />
                        <button type="button" onClick={() => adjustCatalogQty(item.sku, 1)} style={{ ...stepButtonStyle, width: 36 }}>+</button>
                        <button
                          type="button"
                          onClick={() => addSkuFromSearch(item, qtyInput || "1")}
                          style={{ flex: 1, border: "none", borderRadius: 10, background: "#2563eb", color: "#fff", fontWeight: 800, padding: "8px 10px", cursor: "pointer" }}
                        >
                          {t.add}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}

            <div style={{ marginTop: 12 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6 }}>{t.qty} ({t.quickAdd})</label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8 }}>
                {quickQtyButtons.map((qty) => (
                  <button key={qty} type="button" onClick={() => setQtyInput(qty)} style={qtyButtonStyle}>
                    {qty}
                  </button>
                ))}
              </div>
              <button type="button" onClick={addItem} style={{ ...primarySmallButtonStyle, width: "100%", marginTop: 10, maxWidth: "none" }}>
                {t.addItem}
              </button>
            </div>
          </section>
        ) : mode === "promotion" ? (
          <section style={{ ...cardStyle, border: "1px solid #5eead4", background: "linear-gradient(180deg, #f0fdfa 0%, #ffffff 40%)" }}>
            <div style={sectionTitleStyle}>{t.promotionMode}</div>
            <p style={{ fontSize: 13, color: "#115e59", margin: "4px 0 10px", lineHeight: 1.45 }}>{t.weeklyPicksHero}</p>
            {promotionItems.length > 0 ? (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
                <button
                  type="button"
                  onClick={addAllWeeklyPicksOneCase}
                  style={{
                    border: "1px solid #0f766e",
                    background: "#0f766e",
                    color: "#fff",
                    borderRadius: 999,
                    padding: "8px 14px",
                    fontSize: 12,
                    fontWeight: 900,
                    cursor: "pointer",
                  }}
                >
                  {t.addAllWeeklyPicksOneCase}
                </button>
              </div>
            ) : null}

            {promotionsLoading ? (
              <div style={{ ...emptyStyle, border: "1px solid #5eead4", background: "#f0fdfa", color: "#0f766e" }}>{t.loadingPromotions}</div>
            ) : promotionItems.length === 0 ? (
              <div style={emptyStyle}>{t.noPromotions}</div>
            ) : (
              <div style={promoGridStyle}>
                {promotionItems.map((item) => {
                  const sku = item.sku?.toUpperCase() || "";
                  const qty = catalogQtyMap[sku] || "";
                  const soldOut = item.remainingQty === 0;
                  const promoPriceLabel = item.promoPrice
                    ? `${t.promoPrice}: ${item.promoPrice}`
                    : undefined;
                  const promoDealLabel = soldOut ? undefined : formatPromoBuyXGetY(item, t);
                  const promoDetailsLabel = soldOut
                    ? t.promoSoldOut
                    : [formatPromoBuyXGetYPackHint(item, t), formatPromoDetails(item, t)].filter(Boolean).join(" · ");
                  const promoRemainingLabel = soldOut
                    ? t.promoSoldOut
                    : item.remainingQty !== null && item.remainingQty !== undefined
                      ? `${t.promoRemaining}: ${item.remainingQty}`
                      : undefined;
                  return (
                    <CatalogQtyCard
                      key={item.sku}
                      item={item}
                      qty={qty}
                      promoNote={soldOut ? t.promoSoldOut : item.promoNote}
                      promoDealLabel={promoDealLabel}
                      promoPrice={promoPriceLabel}
                      promoDetails={promoDetailsLabel}
                      promoRemaining={promoRemainingLabel}
                      inCartLabel={t.inCart}
                      promoBadgeLabel={t.promoBadge}
                      editLabel={t.editProduct}
                      showAdminEdit={showAdminEditLinks}
                      highlight
                      disabled={soldOut}
                      onAdjust={adjustCatalogQty}
                      onUpdateQty={updateCatalogQty}
                    />
                  );
                })}
              </div>
            )}
          </section>
        ) : mode === "clearance" ? (
          <section style={{ ...cardStyle, border: "1px solid #fdba74", background: "linear-gradient(180deg, #fff7ed 0%, #ffffff 40%)" }}>
            <div style={sectionTitleStyle}>{t.clearanceMode}</div>
            <p style={{ fontSize: 13, color: "#9a3412", margin: "4px 0 10px", lineHeight: 1.45 }}>{t.clearanceHint}</p>
            {clearanceItems.length > 0 ? (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
                <button
                  type="button"
                  onClick={addAllClearanceOneCase}
                  style={{
                    border: "1px solid #ea580c",
                    background: "#ea580c",
                    color: "#fff",
                    borderRadius: 999,
                    padding: "8px 14px",
                    fontSize: 12,
                    fontWeight: 900,
                    cursor: "pointer",
                  }}
                >
                  {t.addAllClearanceOneCase}
                </button>
              </div>
            ) : null}
            {clearanceLoading ? (
              <div style={{ ...emptyStyle, border: "1px solid #fdba74", background: "#fff7ed", color: "#c2410c" }}>{t.loadingClearance}</div>
            ) : clearanceItems.length === 0 ? (
              <div style={emptyStyle}>{t.noClearance}</div>
            ) : (
              <div style={promoGridStyle}>
                {clearanceItems.map((item) => {
                  const sku = item.sku?.toUpperCase() || "";
                  const qty = catalogQtyMap[sku] || "";
                  const soldOut = item.remainingQty === 0;
                  const priceLabel = item.clearancePrice ? `${t.clearancePrice}: ${item.clearancePrice}` : undefined;
                  const detailsLabel = soldOut ? t.clearanceSoldOut : formatClearanceDetails(item, t);
                  const remainingLabel = soldOut ? t.clearanceSoldOut : item.remainingQty !== null && item.remainingQty !== undefined ? `${t.clearanceRemaining}: ${item.remainingQty}` : undefined;
                  return (
                    <CatalogQtyCard key={item.sku} item={item} qty={qty}
                      promoNote={soldOut ? t.clearanceSoldOut : item.clearanceNote || t.clearanceBadge}
                      promoPrice={priceLabel} promoDetails={detailsLabel} promoRemaining={remainingLabel}
                      policyNote={soldOut ? undefined : t.clearanceNoReturn}
                      inCartLabel={t.inCart} promoBadgeLabel={t.clearanceBadge} editLabel={t.editProduct}
                      showAdminEdit={showAdminEditLinks} highlight disabled={soldOut}
                      onAdjust={adjustCatalogQty} onUpdateQty={updateCatalogQty} />
                  );
                })}
              </div>
            )}
          </section>
        ) : (
          <section style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
              <div>
                <div style={sectionTitleStyle}>{t.allOrderable}</div>
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                  {t.selected}: {cartItemCount} · {orderableCatalogItems.length} {t.catalogCount}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => {
                    setCatalogShowRecommendedOnly((prev) => !prev);
                    setCatalogShowNewOnly(false);
                  }}
                  style={categoryButtonStyle(catalogShowRecommendedOnly)}
                >
                  {t.recommended} ({recommendedItemCount})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCatalogShowNewOnly((prev) => !prev);
                    setCatalogShowRecommendedOnly(false);
                  }}
                  style={newItemsButtonStyle(catalogShowNewOnly)}
                >
                  {t.newItems} ({newItemCount})
                </button>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 800, color: "#374151", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={catalogShowSelectedOnly}
                    onChange={(e) => setCatalogShowSelectedOnly(e.target.checked)}
                  />
                  {t.selectedOnly} ({cartItemCount})
                </label>
              </div>
            </div>

            <div style={stickyCatalogToolsStyle}>
              <div style={compactCatalogToolsRowStyle}>
                <input
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  placeholder={t.catalogSearch}
                  style={{ ...wideInputStyle, marginBottom: 0 }}
                />
                <button
                  type="button"
                  onClick={() => setCatalogFiltersOpen((prev) => !prev)}
                  style={categoryButtonStyle(catalogFiltersOpen || activeCatalogFilterCount > 0)}
                >
                  {catalogFiltersOpen ? t.hideFilters : t.showFilters}
                  {activeCatalogFilterCount > 0 ? ` (${activeCatalogFilterCount})` : ""}
                </button>
              </div>

              {catalogFiltersOpen ? (
                <div style={{ marginTop: 8 }}>
                  <div style={filterBlockStyle}>
                    <div style={filterLabelStyle}>{t.category}</div>
                    <div style={categoryBarStyle}>
                      {categoryOptions.map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setCategoryFilter(cat)}
                          style={categoryButtonStyle(categoryFilter === cat)}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  {(brandSplit.topBrands.length > 0 || brandSplit.moreBrands.length > 0) ? (
                    <div style={filterBlockStyle}>
                      <div style={filterLabelStyle}>{t.brand}</div>
                      <div style={categoryBarStyle}>
                        <button
                          type="button"
                          onClick={() => setBrandFilter("ALL")}
                          style={categoryButtonStyle(brandFilter === "ALL")}
                        >
                          {t.allBrands}
                        </button>
                        {brandSplit.topBrands.slice(0, 8).map((brand) => (
                          <button
                            key={brand}
                            type="button"
                            onClick={() => setBrandFilter(brand)}
                            style={categoryButtonStyle(brandFilter === brand)}
                          >
                            {formatBrandLabel(brand)}
                          </button>
                        ))}
                        {brandSplit.moreBrands.length > 0 ? (
                          <select
                            aria-label={t.moreBrandsPick}
                            value={
                              brandFilter !== "ALL" && brandSplit.moreBrands.includes(brandFilter)
                                ? brandFilter
                                : ""
                            }
                            onChange={(e) => setBrandFilter(e.target.value ? e.target.value : "ALL")}
                            style={brandSelectStyle}
                          >
                            <option value="">{t.moreBrandsPick}</option>
                            {brandSplit.moreBrands.map((brand) => (
                              <option key={brand} value={brand}>
                                {formatBrandLabel(brand)}
                              </option>
                            ))}
                          </select>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 10px" }}>
              {t.showing} {orderableCatalogItems.length} {t.catalogCount}
            </p>

            <CatalogVirtualGrid
              items={orderableCatalogItems}
              catalogQtyMap={catalogQtyMap}
              inCartLabel={t.inCart}
              promoBadgeLabel={t.promoBadge}
              weeklyPickSkus={promoSkuSet}
              clearancePickSkus={clearanceSkuSet}
              newItemChecker={isNewItem}
              clearanceBadgeLabel={t.clearanceBadge}
              newBadgeLabel={t.newItems}
              editLabel={t.editProduct}
              showAdminEdit={showAdminEditLinks}
              onAdjust={adjustCatalogQty}
              onUpdateQty={updateCatalogQty}
            />

            {orderableCatalogItems.length === 0 ? (
              <div style={{ ...emptyStyle, marginTop: 10 }}>{catalogShowSelectedOnly ? t.noItems : t.noMatches}</div>
            ) : null}
          </section>
        )}
        <OrderCartSection
          lang={lang}
          items={catalogItemsForSubmit}
          clearanceSkus={clearanceSkuSet}
          expanded={showCart}
          onToggleExpanded={() => setShowCart((prev) => !prev)}
          lineCount={cartItemCount}
          totalCases={totalCases}
          onAdjustQty={adjustQtyForSku}
          onQtyInput={updateCatalogQty}
          onRemove={removeSkuFromOrder}
        />

        <section style={cardStyle}>
          <div style={{ display: "grid", gap: 8 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <button type="button" onClick={downloadCsv} style={secondaryButtonStyle}>{t.downloadCsv}</button>
              <button type="button" onClick={() => fileInputRef.current?.click()} style={secondaryButtonStyle}>{t.uploadCsv}</button>
              <input ref={fileInputRef} type="file" accept=".csv" style={{ display: "none" }} onChange={handleUploadCsv} />
            </div>
            <button type="button" onClick={clearOrder} style={dangerButtonStyle}>{t.clearOrder}</button>
            
            {submitMsg ? <div style={{ marginTop: 4, fontSize: 13, fontWeight: 700, color: submitMsg.toLowerCase().includes("failed") ? "#b91c1c" : "#15803d", textAlign: "center" }}>{submitMsg}</div> : null}
          </div>
        </section>

        <div style={fixedSubmitBarStyle}>
          <div style={cartSummaryTextStyle}>
            <div>{t.cartSummary}: {cartItemCount} {t.lines} / {totalCases} {t.cases}</div>
            {weeklyInCartCount > 0 || clearanceInCartCount > 0 ? (
              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2, fontWeight: 700 }}>
                {t.cartSalesSummary
                  .replace("{weekly}", String(weeklyInCartCount))
                  .replace("{clearance}", String(clearanceInCartCount))}
              </div>
            ) : null}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "0.9fr 1.1fr", gap: 8 }}>
            <button type="button" onClick={openReview} disabled={submitting} style={secondaryButtonStyle}>
              {t.reviewCart}
            </button>
            <button type="button" onClick={openReview} disabled={submitting} style={{ ...submitButtonStyle, background: submitting ? "#93c5fd" : "#16a34a" }}>
              {submitting ? t.submitting : `${t.submitOrder}`}
            </button>
          </div>
        </div>

        <OrderReviewModal
          open={showReview}
          onClose={() => setShowReview(false)}
          lang={lang}
          items={catalogItemsForSubmit}
          warnings={orderReviewWarnings}
          weeklyUpsellLines={weeklyUpsellLines}
          clearanceUpsellLines={clearanceUpsellLines}
          onAddUpsellCase={(sku) => adjustQtyForSku(sku, 1)}
          onAddAllWeeklyUpsell={addAllMissingWeeklyUpsell}
          onAddAllClearanceUpsell={addAllMissingClearanceUpsell}
          clearanceSkus={clearanceSkuSet}
          promoDealBySku={promoDealBySku}
          newItemsReminder={
            showNewItemsReviewReminder
              ? {
                  count: newItemCount,
                  onView: () => {
                    setShowReview(false);
                    setCatalogShowNewOnly(true);
                    changeMode("catalog");
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  },
                }
              : null
          }
          accountNo={accountNo}
          storeName={storeName}
          submitting={submitting}
          onAdjustQty={adjustQtyForSku}
          onQtyInput={updateCatalogQty}
          onRemove={removeSkuFromOrder}
          onSubmit={submitOrder}
        />

        <OrderSubmittedModal
          open={Boolean(lastSubmittedRef)}
          onDone={() => {
            setLastSubmittedRef("");
            setLastSubmittedItems([]);
          }}
          lang={lang}
          orderRef={lastSubmittedRef}
          items={lastSubmittedItems}
          suggestLines={postSubmitSuggestLines}
          onBrowseWeeklyPicks={() => {
            setLastSubmittedRef("");
            setLastSubmittedItems([]);
            changeMode("promotion");
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        />

        {orderHistory.length > 0 ? (
          <section style={cardStyle}>
            <button type="button" onClick={() => setShowHistory((prev) => !prev)} style={sectionToggleStyle}>
              <div style={sectionTitleStyle}>{t.history}</div>
              <div style={toggleTextStyle}>{showHistory ? t.hide : t.show}</div>
            </button>

            {showHistory ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10, overflow: "visible" }}>
                {orderHistory.slice(0, 8).map((order, index) => {
                  const key = order.orderRef || order.createdAt || String(index);
                  const items = order.items || [];
                  const expanded = expandedHistoryKey === key;
                  const totalHistoryCases = items.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);

                  return (
                    <div key={key} style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 10, background: "#f9fafb", overflow: "visible" }}>
                      <button
                        type="button"
                        onClick={() => setExpandedHistoryKey((prev) => (prev === key ? "" : key))}
                        style={{
                          width: "100%",
                          border: "none",
                          background: "transparent",
                          padding: 0,
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          gap: 10,
                          textAlign: "left",
                          cursor: "pointer",
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 900, color: "#111827" }}>{order.orderRef || "-"}</div>
                          <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
                            {order.createdAt ? new Date(order.createdAt).toLocaleString() : ""} · {items.length} {t.items} · {totalHistoryCases} {t.cases}
                          </div>
                          {!expanded ? (
                            <div style={{ fontSize: 12, color: "#374151", marginTop: 6 }}>
                              {items.slice(0, 5).map((item) => `${item.sku}(${item.qty})`).join(", ")}
                              {items.length > 5 ? "..." : ""}
                            </div>
                          ) : null}
                        </div>
                        <div style={{ ...toggleTextStyle, flexShrink: 0 }}>{expanded ? t.hideDetails : t.viewDetails}</div>
                      </button>

                      {expanded ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
                          {items.map((item, itemIndex) => {
                            const catalogItem = getCatalogItemBySku(item.sku);
                            return (
                              <div
                                key={`${item.sku}-${itemIndex}`}
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                  gap: 10,
                                  border: "1px solid #e5e7eb",
                                  borderRadius: 10,
                                  padding: 8,
                                  background: "#ffffff",
                                  overflow: "visible",
                                }}
                              >
                                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                                  <ProductImage sku={item.sku} alt={item.sku} size={40} imageUrl={catalogItem?.imageUrl} />
                                  <div style={{ minWidth: 0 }}>
                                    <div style={{ fontSize: 13, fontWeight: 900, color: "#111827" }}>{item.sku}</div>
                                    <div style={{ fontSize: 12, color: "#4b5563", lineHeight: 1.35, overflow: "hidden", textOverflow: "ellipsis" }}>
                                      {catalogItem?.brand ? `${catalogItem.brand} | ` : ""}{catalogItem?.name || "-"}
                                    </div>
                                  </div>
                                </div>
                                <div style={{ fontSize: 13, fontWeight: 900, color: "#16a34a", flexShrink: 0 }}>
                                  {t.qty}: {item.qty}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : null}

                      <button type="button" onClick={() => reorderItems(items)} style={{ ...secondaryButtonStyle, marginTop: 8, padding: "8px 10px" }}>{t.reorder}</button>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </main>
  );
}


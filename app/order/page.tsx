"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { brandMatchesFilter, isKnownBrandFilter, splitBrandFilters } from "@/lib/catalogBrands";
import { CATEGORY_OPTIONS, inferCategory } from "@/lib/inferCategory";

import { CatalogVirtualGrid } from "./components/CatalogVirtualGrid";
import { CatalogQtyCard } from "./components/CatalogQtyCard";
import { OrderCartSection } from "./components/OrderCartSection";
import { OrderShopNudge } from "./components/OrderShopNudge";
import { RecommendedStrip } from "./components/RecommendedStrip";
import { OrderInput } from "./components/OrderInput";
import { OrderReviewModal } from "./components/OrderReviewModal";
import { OrderSubmittedModal } from "./components/OrderSubmittedModal";
import { buildClearanceUpsellLines } from "./salesFlow";
import { ProductImage } from "./components/ProductImage";
import { replaceCatalog, catalog } from "./catalogState";
import { compareCatalogForDisplay } from "@/lib/catalogNewItems";
import {
  formatBrandLabel,
  formatClearanceDetails,
  formatPromoBuyXGetY,
  formatPromoBuyXGetYPackHint,
  formatPromoDetails,
  getPromoBogoPackSize,
  formatPromotionDealReviewLabel,
  getPromotionDealHighlight,
  generateOrderRef,
  getCatalogItemBySku,
  getDisplayStatus,
  getStatusBadgeStyle,
  formatOrderNotAvailableMessage,
  isNewItem,
  isOrderableItem,
} from "./catalogUtils";
import { DEFAULT_ORDER_EMAIL, isValidOrderEmail, resolveCustomerOrderEmail } from "@/lib/customerOrderEmail";
import {
  buildCatalogQtyMapFromDraft,
  cartItemsFromQtyMap,
  countDraftItems,
  mergeOrderDrafts,
  normalizeOrderDraft,
  type OrderDraftPayload,
} from "@/lib/orderDraft";
import { copy } from "./orderCopy";
import {
  brandSelectStyle,
  cardStyle,
  categoryBarStyle,
  categoryButtonStyle,
  emptyStyle,
  filterBlockStyle,
  filterLabelStyle,
  limitedBadgeStyle,
  modeButtonStyle,
  newItemsModeButtonStyle,
  primarySmallButtonStyle,
  productSmallButtonStyle,
  clearanceModeButtonStyle,
  promoModeButtonStyle,
  qtyButtonStyle,
  secondaryButtonStyle,
  sectionTitleStyle,
  sectionToggleStyle,
  smallButtonStyle,
  stepButtonStyle,
  stepInputStyle,
  submitButtonStyle,
  toggleTextStyle,
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
  const autoLoadedRef = useRef(false);
  const clearanceFetchedRef = useRef(false);
  const draftSnapshotRef = useRef({
    accountNo: "",
    storeName: "",
    phone: "",
    orderEmail: DEFAULT_ORDER_EMAIL,
    note: "",
    cart: [] as CartItem[],
    catalogQtyMap: {} as Record<string, string>,
  });

  const [lang, setLang] = useState<Lang>("en");
  const [mode, setMode] = useState<OrderMode>("promotion");
  const [ready, setReady] = useState(false);
  const [accountNo, setAccountNo] = useState("");
  const [storeName, setStoreName] = useState("");
  const [phone, setPhone] = useState("");
  const [orderEmail, setOrderEmail] = useState(DEFAULT_ORDER_EMAIL);
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
  const [showCart, setShowCart] = useState(false);
  const [catalogShowSelectedOnly, setCatalogShowSelectedOnly] = useState(false);
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
        const res = await fetch("/api/catalog");
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
        const res = await fetch("/api/promotions");
        const data = await res.json();
        if (res.ok && Array.isArray(data.products)) {
          setPromotionItems(data.products);
        }
      } catch {
      } finally {
        setPromotionsLoading(false);
      }
    };

    void loadPromotions();
  }, [ready]);

  useEffect(() => {
    if (!ready || mode !== "clearance" || clearanceFetchedRef.current) return;

    const loadClearance = async () => {
      clearanceFetchedRef.current = true;
      setClearanceLoading(true);
      try {
        const res = await fetch("/api/clearance");
        const data = await res.json();
        if (res.ok && Array.isArray(data.products)) {
          setClearanceItems(data.products);
        }
      } catch {
        clearanceFetchedRef.current = false;
      } finally {
        setClearanceLoading(false);
      }
    };

    void loadClearance();
  }, [ready, mode]);

  useEffect(() => {
    const saved = localStorage.getItem("lang") as Lang | null;
    if (saved === "en" || saved === "zh" || saved === "ko" || saved === "vi") setLang(saved);

    const savedMode = localStorage.getItem("order_mode") as OrderMode | null;
    if (
      savedMode === "catalog" ||
      savedMode === "promotion" ||
      savedMode === "clearance" ||
      savedMode === "newItems"
    ) {
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
    autoLoadedRef.current = autoLoaded;
  }, [autoLoaded]);

  useEffect(() => {
    draftSnapshotRef.current = {
      accountNo,
      storeName,
      phone,
      orderEmail,
      note,
      cart,
      catalogQtyMap,
    };
  }, [accountNo, storeName, phone, orderEmail, note, cart, catalogQtyMap]);

  useEffect(() => {
    setAutoLoaded(false);
  }, [accountNo]);

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
    const savedOrderEmail = sessionStorage.getItem("customer_order_email");
    setOrderEmail(resolveCustomerOrderEmail(savedOrderEmail || ""));
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

    const applyDraft = (draft: OrderDraftPayload) => {
      setPhone(draft.phone || "");
      setNote(draft.note || "");
      const map = buildCatalogQtyMapFromDraft(draft);
      setCatalogQtyMap(map);
      setCart(cartItemsFromQtyMap(map));
    };

    const loadDrafts = async () => {
      let localParsed: OrderDraftPayload | null = null;
      let cloudParsed: OrderDraftPayload | null = null;

      const localDraft = localStorage.getItem(`draft_${accountNo}`);
      if (localDraft) {
        try {
          localParsed = normalizeOrderDraft(accountNo, JSON.parse(localDraft));
        } catch {}
      }

      try {
        const res = await fetch(`/api/load-draft?accountNo=${encodeURIComponent(accountNo)}`, { method: "GET", cache: "no-store" });
        const data = await res.json();
        if (res.ok && data?.draft) {
          cloudParsed = normalizeOrderDraft(accountNo, data.draft);
        }
      } catch {}

      const merged = mergeOrderDrafts(localParsed, cloudParsed);
      if (merged) {
        applyDraft(merged);
        localStorage.setItem(`draft_${accountNo}`, JSON.stringify(merged));
        if (countDraftItems(merged) > 0) {
          setSubmitMsg(t.loadedDraft);
        }
      }

      try {
        const profileRes = await fetch(
          `/api/customer-profile?accountNo=${encodeURIComponent(accountNo)}`,
          { cache: "no-store" }
        );
        const profileData = await profileRes.json();
        if (profileRes.ok && profileData?.orderEmail) {
          const resolved = resolveCustomerOrderEmail(profileData.orderEmail);
          setOrderEmail(resolved);
          sessionStorage.setItem("customer_order_email", resolved);
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

    const draft = normalizeOrderDraft(accountNo, {
      storeName,
      phone,
      orderEmail,
      note,
      cart,
      catalogQtyMap,
      updatedAt: new Date().toISOString(),
    });
    localStorage.setItem(`draft_${accountNo}`, JSON.stringify(draft));

    const timer = setTimeout(async () => {
      try {
        const saveBody = {
          ...draft,
          allowClear: countDraftItems(draft) === 0,
        };
        const res = await fetch("/api/save-draft", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(saveBody),
        });
        if (!res.ok) throw new Error("save failed");
      } catch {
        try {
          await fetch("/api/save-draft", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...draft, allowClear: countDraftItems(draft) === 0 }),
          });
        } catch {
          /* localStorage backup already written above */
        }
      }

      try {
        await fetch("/api/customer-profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accountNo,
            phone: phone.trim(),
          }),
        });
      } catch {}
    }, 700);

    return () => clearTimeout(timer);
  }, [ready, accountNo, storeName, phone, orderEmail, note, cart, catalogQtyMap, autoLoaded]);

  useEffect(() => {
    if (!ready || !accountNo) return;

    const flushDraft = () => {
      if (!autoLoadedRef.current) return;

      const snapshot = draftSnapshotRef.current;
      if (!snapshot.accountNo) return;

      const payload = normalizeOrderDraft(snapshot.accountNo, {
        ...snapshot,
        updatedAt: new Date().toISOString(),
      });

      localStorage.setItem(`draft_${snapshot.accountNo}`, JSON.stringify(payload));

      if (typeof navigator.sendBeacon === "function") {
        const body = JSON.stringify({
          ...payload,
          allowClear: countDraftItems(payload) === 0,
        });
        navigator.sendBeacon("/api/save-draft", new Blob([body], { type: "application/json" }));
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") flushDraft();
    };

    window.addEventListener("pagehide", flushDraft);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("pagehide", flushDraft);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [ready, accountNo]);

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
      .filter((x) => (showAvailableOnly ? isOrderableItem(x.item) : true))
      .sort((a, b) => {
        const aNormal = isOrderableItem(a.item);
        const bNormal = isOrderableItem(b.item);
        if (aNormal !== bNormal) return aNormal ? -1 : 1;
        if (b.score !== a.score) return b.score - a.score;
        return (a.item.sku || "").localeCompare(b.item.sku || "");
      })
      .map((x) => x.item)
      .slice(0, 60);
  }, [normalizedSkuInput, showAvailableOnly, catalogVersion]);

  const catalogBrowseBase = useMemo(() => {
    if (!showAvailableOnly) return catalog;
    return catalog.filter((item) => isOrderableItem(item));
  }, [catalogVersion, showAvailableOnly]);

  const brandSplit = useMemo(
    () => splitBrandFilters(catalogBrowseBase),
    [catalogBrowseBase]
  );

  const newItemCount = useMemo(
    () => catalogBrowseBase.filter((item) => isNewItem(item)).length,
    [catalogBrowseBase]
  );

  const newItemCatalogItems = useMemo(
    () =>
      catalogBrowseBase
        .filter((item) => isNewItem(item))
        .sort((a, b) => {
          const aNormal = isOrderableItem(a);
          const bNormal = isOrderableItem(b);
          if (aNormal !== bNormal) return aNormal ? -1 : 1;
          return compareCatalogForDisplay(a, b);
        }),
    [catalogBrowseBase]
  );

  const [invoiceFrequentSkus, setInvoiceFrequentSkus] = useState<string[]>([]);

  useEffect(() => {
    if (!accountNo) return;
    const inCart = new Set<string>();
    for (const [sku, qty] of Object.entries(catalogQtyMap || {})) {
      if (Number(qty) > 0) inCart.add(sku.toUpperCase());
    }
    for (const row of cart || []) {
      if (Number(row.qty) > 0) inCart.add(String(row.sku || "").toUpperCase());
    }
    const cartParam = Array.from(inCart).join(",");
    void fetch(
      `/api/recommended-cart-skus?accountNo=${encodeURIComponent(accountNo)}&cart=${encodeURIComponent(cartParam)}`,
      { cache: "no-store" }
    )
      .then((r) => r.json())
      .then((j) => {
        if (Array.isArray(j?.rows)) {
          setInvoiceFrequentSkus(j.rows.map((row: { sku: string }) => String(row.sku).toUpperCase()));
        }
      })
      .catch(() => setInvoiceFrequentSkus([]));
  }, [accountNo, cart, catalogQtyMap]);

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

    for (const sku of invoiceFrequentSkus) {
      if (sku) skuSet.add(sku);
    }

    return skuSet;
  }, [orderHistory, recentItems, invoiceFrequentSkus]);

  const recommendedItemCount = useMemo(
    () => catalogBrowseBase.filter((item) => recommendedSkuSet.has(item.sku?.toUpperCase() || "")).length,
    [catalogBrowseBase, recommendedSkuSet]
  );

  const activeCatalogFilterCount = useMemo(() => {
    let count = 0;
    if (showAvailableOnly) count += 1;
    if (categoryFilter !== "ALL") count += 1;
    if (brandFilter !== "ALL") count += 1;
    if (catalogShowRecommendedOnly) count += 1;
    if (catalogShowSelectedOnly) count += 1;
    return count;
  }, [brandFilter, catalogShowRecommendedOnly, catalogShowSelectedOnly, categoryFilter, showAvailableOnly]);

  const orderableCatalogItems = useMemo(() => {
    const q = catalogSearch.trim().toUpperCase();

    return catalogBrowseBase
      .filter((item) => {
        if (catalogShowSelectedOnly) {
          const sku = (item.sku || "").toUpperCase();
          if (Number(catalogQtyMap[sku] || 0) <= 0) return false;
        }
        if (categoryFilter !== "ALL" && inferCategory(item) !== categoryFilter) return false;
        if (brandFilter !== "ALL" && !brandMatchesFilter(item.brand, brandFilter)) return false;
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
      .sort((a, b) => {
        const aNormal = isOrderableItem(a);
        const bNormal = isOrderableItem(b);
        if (aNormal !== bNormal) return aNormal ? -1 : 1;
        return compareCatalogForDisplay(a, b);
      });
  }, [catalogSearch, categoryFilter, brandFilter, catalogQtyMap, catalogBrowseBase, catalogShowSelectedOnly, catalogShowRecommendedOnly, recommendedSkuSet]);

  useEffect(() => {
    if (brandFilter !== "ALL" && !isKnownBrandFilter(brandSplit, brandFilter)) {
      setBrandFilter("ALL");
    }
  }, [brandFilter, brandSplit]);

  const catalogItemsForSubmit = useMemo(() => {
    return Object.entries(catalogQtyMap)
      .map(([sku, qty]) => ({ sku: sku.toUpperCase(), qty: String(qty || "").trim() }))
      .filter((item) => item.qty && Number(item.qty) > 0);
  }, [catalogQtyMap]);

  const cartItemCount = catalogItemsForSubmit.length;

  useEffect(() => {
    if (cartItemCount === 0) setShowCart(false);
  }, [cartItemCount]);

  const totalCases = useMemo(() => {
    return catalogItemsForSubmit.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
  }, [catalogItemsForSubmit]);

  const blockAddForSku = (cleanSku: string) => {
    const catalogItem = getCatalogItemBySku(cleanSku);
    if (!catalogItem) {
      alert(`${cleanSku} is not in the catalog.`);
      return true;
    }
    if (!isOrderableItem(catalogItem)) {
      alert(formatOrderNotAvailableMessage(cleanSku, catalogItem.status, t));
      return true;
    }
    return false;
  };

  const setQtyForSku = (sku: string, value: string) => {
    const cleanSku = sku.trim().toUpperCase();
    const cleanQty = String(value || "").replace(/[^0-9]/g, "");

    if (cleanQty && Number(cleanQty) > 0 && blockAddForSku(cleanSku)) {
      return;
    }

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
      if (catalogItem && !isOrderableItem(catalogItem)) {
        warnings.push(formatOrderNotAvailableMessage(cleanSku, catalogItem.status, t));
      }
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

      if (promo?.endDate) {
        const end = new Date(promo.endDate);
        const daysLeft = Math.ceil((end.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
        if (daysLeft >= 0 && daysLeft <= 7) {
          warnings.push(`${cleanSku}: promotion ends in ${daysLeft} day(s).`);
        }
      }

      const clearance = clearanceItems.find((c) => c.sku?.toUpperCase() === cleanSku);
      if (clearance?.daysUntilExpiry != null && clearance.daysUntilExpiry <= 7 && clearance.daysUntilExpiry >= 0) {
        warnings.push(`${cleanSku}: clearance expires in ${clearance.daysUntilExpiry} day(s).`);
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
      const highlight = getPromotionDealHighlight(item, t);
      const label = formatPromotionDealReviewLabel(highlight);
      if (label) map[sku] = label;
    }
    return map;
  }, [promotionItems, t]);

  const cartSkuSet = useMemo(
    () => new Set(catalogItemsForSubmit.map((item) => item.sku.toUpperCase())),
    [catalogItemsForSubmit]
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

  const showNewItemsReviewReminder = useMemo(() => {
    if (newItemCount === 0 || catalogItemsForSubmit.length === 0) return false;
    return catalogItemsForSubmit.every((item) => {
      const catalogItem = getCatalogItemBySku(item.sku);
      return !isNewItem(catalogItem);
    });
  }, [catalogItemsForSubmit, newItemCount]);

  const recommendedStripItems = useMemo(() => {
    if (mode !== "catalog" || catalogShowRecommendedOnly) return [];
    return catalogBrowseBase
      .filter((item) => recommendedSkuSet.has((item.sku || "").toUpperCase()))
      .filter((item) => Number(catalogQtyMap[(item.sku || "").toUpperCase()] || 0) <= 0)
      .slice(0, 8);
  }, [mode, catalogBrowseBase, recommendedSkuSet, catalogQtyMap, catalogShowRecommendedOnly]);

  const scrollToCart = () => {
    setShowCart(true);
    requestAnimationFrame(() => {
      document.getElementById("order-cart")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  };

  const toggleCartPanel = () => {
    setShowCart((prev) => !prev);
  };

  const roundUpBogoQty = (sku: string, pack: number) => {
    const cleanSku = sku.trim().toUpperCase();
    const current = Number(catalogQtyMap[cleanSku] || 0);
    if (!pack || current <= 0) return;
    const remainder = current % pack;
    if (remainder === 0) return;
    setQtyForSku(cleanSku, String(current + (pack - remainder)));
  };

  const applyQuickQtyToSelected = (qty: string) => {
    const target = selectedItem || matchedItems[0];
    if (!target?.sku) return;
    setQtyForSku(target.sku, qty);
  };

  const adjustQtyForSku = (sku: string, delta: number) => {
    const cleanSku = sku.trim().toUpperCase();
    const current = Number(catalogQtyMap[cleanSku] || 0);
    let next = Math.max(0, current + delta);

    if (delta > 0 && next > 0 && current <= 0 && blockAddForSku(cleanSku)) {
      return;
    }

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
      if (!sku) continue;
      const catalogItem = getCatalogItemBySku(sku) || item;
      if (!isOrderableItem(catalogItem)) continue;
      adjustQtyForSku(sku, 1);
    }
  };

  const addAllNewItemsOneCase = () => {
    for (const item of newItemCatalogItems) {
      const sku = item.sku?.toUpperCase();
      if (!sku) continue;
      if (!isOrderableItem(item)) continue;
      adjustQtyForSku(sku, 1);
    }
  };

  const addAllClearanceOneCase = () => {
    for (const item of clearanceItems) {
      if (item.remainingQty === 0) continue;
      const sku = item.sku?.toUpperCase();
      if (!sku) continue;
      const catalogItem = getCatalogItemBySku(sku) || item;
      if (!isOrderableItem(catalogItem)) continue;
      adjustQtyForSku(sku, 1);
    }
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
    if (exactMatch && (!showAvailableOnly || isOrderableItem(exactMatch))) {
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
    addSkuToCart(item.sku, qty);
  };

  const updateCatalogQty = (sku: string, value: string) => {
    const cleanSku = sku.toUpperCase();
    const clean = value.replace(/[^0-9]/g, "");

    if (clean && Number(clean) > 0 && blockAddForSku(cleanSku)) {
      return;
    }

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
      const sku = String(item.sku || "").trim().toUpperCase();
      const qty = String(item.qty || "").trim();
      return sku && qty && Number(qty) > 0;
    });

    if (valid.length === 0) {
      alert(t.noValidRows);
      return;
    }

    const orderable = valid.filter((item) => {
      const sku = item.sku.toUpperCase();
      const catalogItem = getCatalogItemBySku(sku);
      if (!catalogItem || !isOrderableItem(catalogItem)) {
        alert(formatOrderNotAvailableMessage(sku, catalogItem?.status, t));
        return false;
      }
      return true;
    });

    if (orderable.length === 0) return;

    setCart((prev) => [...prev, ...orderable]);
    setCatalogQtyMap((prev) => {
      const next = { ...prev };
      for (const item of orderable) {
        const qtyNumber = Number(String(item.qty || "").replace(/[^0-9]/g, ""));
        if (qtyNumber > 0) next[item.sku.toUpperCase()] = String(Number(next[item.sku.toUpperCase()] || 0) + qtyNumber);
      }
      return next;
    });
    setSubmitMsg(`${orderable.length} ${t.items} added.`);
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
    setShowCart(false);
    setSkuInput("");
    setQtyInput("");
    setSelectedItem(null);
    setSubmitMsg(t.cleared);
    localStorage.removeItem(`draft_${accountNo}`);

    try {
      await fetch("/api/save-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountNo,
          storeName,
          phone: phone.trim(),
          orderEmail: orderEmail.trim(),
          note: note.trim(),
          cart: [],
          catalogQtyMap: {},
          allowClear: true,
        }),
      });
    } catch {}

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
    sessionStorage.removeItem("customer_order_email");
    router.replace("/");
  };

  const openReview = () => {
    const items = getCurrentSubmitItems();

    if (items.length === 0) {
      alert(t.addAtLeast);
      return;
    }

    for (const item of items) {
      const catalogItem = getCatalogItemBySku(item.sku);
      if (catalogItem && !isOrderableItem(catalogItem)) {
        alert(formatOrderNotAvailableMessage(item.sku, catalogItem.status, t));
        return;
      }
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

    const emailToSend = resolveCustomerOrderEmail(orderEmail);
    if (!isValidOrderEmail(emailToSend)) {
      alert(t.orderEmailInvalid);
      setShowCustomerInfo(true);
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
        body: JSON.stringify({
          accountNo,
          storeName,
          phone: phone.trim(),
          orderEmail: emailToSend,
          note: note.trim(),
          orderRef: ref,
          items,
        }),
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
    <main className="order-page">
      <div className="order-container">
        <section style={cardStyle} className="order-top-card order-compact-card">
          <div className="order-header-bar">
            <div className="order-header-main">
              <div className="order-top-title-line">
                <span className="order-top-title">{t.title}</span>
                <span className="order-top-meta">
                  {accountNo} · {storeName}
                </span>
              </div>
            </div>
            <div className="order-lang-inline" role="group" aria-label="Language">
              {(["en", "zh", "ko", "vi"] as Lang[]).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => changeLang(item)}
                  className={`order-lang-btn${lang === item ? " is-active" : ""}`}
                >
                  {ORDER_LANG_LABELS[item]}
                </button>
              ))}
            </div>
            <button
              type="button"
              className={`order-header-link${showCustomerInfo ? " is-open" : ""}`}
              onClick={() => setShowCustomerInfo((prev) => !prev)}
            >
              {t.customerInfo}
            </button>
            <button type="button" onClick={logout} className="order-header-logout" style={smallButtonStyle}>
              {t.logout}
            </button>
          </div>
          {showCustomerInfo ? (
            <div className="order-customer-fields">
              <OrderInput fullWidth label={t.phone} value={phone} onChange={setPhone} placeholder="" />
              <OrderInput fullWidth label={t.note} value={note} onChange={setNote} placeholder="" />
            </div>
          ) : null}
        </section>

        <div className="order-sticky-bar">
          <div className="order-sticky-bar-inner">
            <div className="order-mode-tabs" role="tablist" aria-label="Order mode">
              <button
                type="button"
                role="tab"
                aria-selected={mode === "promotion"}
                onClick={() => changeMode("promotion")}
                className="order-mode-tab"
                style={promoModeButtonStyle(mode === "promotion")}
              >
                {t.promotionMode}
                {promotionItems.length > 0 ? ` (${promotionItems.length})` : ""}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "newItems"}
                onClick={() => changeMode("newItems")}
                className="order-mode-tab"
                style={newItemsModeButtonStyle(mode === "newItems")}
              >
                {t.newItemsMode}
                {newItemCount > 0 ? ` (${newItemCount})` : ""}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "clearance"}
                onClick={() => changeMode("clearance")}
                className="order-mode-tab"
                style={clearanceModeButtonStyle(mode === "clearance")}
              >
                {t.clearanceMode}
                {clearanceItems.length > 0 ? ` (${clearanceItems.length})` : ""}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "catalog"}
                onClick={() => changeMode("catalog")}
                className="order-mode-tab"
                style={modeButtonStyle(mode === "catalog")}
              >
                {t.catalogMode}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "search"}
                onClick={() => changeMode("search")}
                className="order-mode-tab"
                style={modeButtonStyle(mode === "search")}
              >
                {t.searchMode}
              </button>
            </div>

            {mode === "catalog" ? (
              <>
                <div className="order-sticky-search-row">
                  <input
                    value={catalogSearch}
                    onChange={(e) => setCatalogSearch(e.target.value)}
                    placeholder={t.catalogSearch}
                    className="order-sticky-search-input"
                    aria-label={t.catalogSearch}
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
                <div className="order-sticky-catalog-chips">
                  <button
                    type="button"
                    onClick={() => setCatalogShowRecommendedOnly((prev) => !prev)}
                    style={categoryButtonStyle(catalogShowRecommendedOnly)}
                  >
                    {t.recommended} ({recommendedItemCount})
                  </button>
                  <label style={{ display: "flex", alignItems: "center", gap: 4, fontWeight: 800, color: "#374151", cursor: "pointer", whiteSpace: "nowrap" }}>
                    <input
                      type="checkbox"
                      checked={catalogShowSelectedOnly}
                      onChange={(e) => setCatalogShowSelectedOnly(e.target.checked)}
                    />
                    {t.selectedOnly} ({cartItemCount})
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 4, fontWeight: 800, color: "#374151", cursor: "pointer", whiteSpace: "nowrap" }}>
                    <input type="checkbox" checked={showAvailableOnly} onChange={(e) => setShowAvailableOnly(e.target.checked)} />
                    {t.availableOnly}
                  </label>
                </div>
                <div className="order-sticky-catalog-meta">
                  {t.selected}: {cartItemCount} · {t.showing} {orderableCatalogItems.length} {t.catalogCount}
                </div>
                {catalogFiltersOpen ? (
                  <div className="order-sticky-filters">
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
              </>
            ) : null}

            {mode === "search" ? (
              <div className="order-sticky-search-row is-single">
                <input
                  ref={skuInputRef}
                  value={skuInput}
                  onChange={(e) => setSkuInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addItem();
                    }
                  }}
                  placeholder={t.searchPlaceholder}
                  autoCapitalize="characters"
                  className="order-sticky-search-input"
                  aria-label={t.skuItem}
                />
              </div>
            ) : null}
          </div>
        </div>

        {mode === "search" && recentItems.length > 0 ? (
          <section style={cardStyle} className="order-compact-fold">
            <button type="button" onClick={() => setShowRecent((prev) => !prev)} className="order-compact-fold-btn">
              <span className="order-compact-fold-title">{t.recent}</span>
              <span className="order-compact-fold-action">{showRecent ? t.hide : t.show}</span>
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
          <section style={cardStyle} className="order-shop-card">
            <div style={{ ...sectionTitleStyle, marginBottom: 8 }}>{t.addItems}</div>
            <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 10px", lineHeight: 1.45 }}>{t.searchModeHint}</p>

            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontWeight: 800, color: "#374151", marginBottom: 10 }}>
              <input type="checkbox" checked={showAvailableOnly} onChange={(e) => setShowAvailableOnly(e.target.checked)} />
              {t.availableOnly}
            </label>

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
                  const canOrder = isOrderableItem(item);
                  return (
                    <div
                      key={item.sku}
                      style={{
                        position: "relative",
                        border: isActive ? "2px solid #2563eb" : "1px solid #e5e7eb",
                        background: inCart ? "#ecfdf5" : isActive ? "#eff6ff" : canOrder ? "#ffffff" : "#f3f4f6",
                        borderRadius: 12,
                        padding: 10,
                        opacity: canOrder ? 1 : 0.72,
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
                            {!canOrder ? (
                              <div style={{ marginTop: 6, fontSize: 11, fontWeight: 800, color: "#b91c1c", lineHeight: 1.35 }}>
                                {formatOrderNotAvailableMessage(item.sku || "", item.status, t)}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </button>
                      <div style={{ display: "flex", gap: 6, marginTop: 8, alignItems: "center" }}>
                        <button type="button" onClick={() => adjustCatalogQty(item.sku, -1)} disabled={!canOrder} style={{ ...stepButtonStyle, width: 36, opacity: canOrder ? 1 : 0.5 }}>−</button>
                        <input
                          value={catalogQtyMap[(item.sku || "").toUpperCase()] || ""}
                          onChange={(e) => updateCatalogQty(item.sku, e.target.value)}
                          placeholder="0"
                          inputMode="numeric"
                          disabled={!canOrder}
                          style={{ ...stepInputStyle, flex: 1, opacity: canOrder ? 1 : 0.5 }}
                        />
                        <button type="button" onClick={() => adjustCatalogQty(item.sku, 1)} disabled={!canOrder} style={{ ...stepButtonStyle, width: 36, opacity: canOrder ? 1 : 0.5 }}>+</button>
                        <button
                          type="button"
                          onClick={() => adjustCatalogQty(item.sku, 1)}
                          disabled={!canOrder}
                          style={{ flex: 1, border: "none", borderRadius: 10, background: canOrder ? "#2563eb" : "#9ca3af", color: "#fff", fontWeight: 800, padding: "8px 10px", cursor: canOrder ? "pointer" : "not-allowed", minHeight: 40 }}
                        >
                          {t.addOneCase}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}

            <div style={{ marginTop: 12 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6 }}>
                {t.qty} — {t.quickAddSelected}
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8 }}>
                {quickQtyButtons.map((qty) => (
                  <button key={qty} type="button" onClick={() => applyQuickQtyToSelected(qty)} style={qtyButtonStyle}>
                    {qty}
                  </button>
                ))}
              </div>
            </div>
          </section>
        ) : mode === "newItems" ? (
          <section
            className="order-shop-card"
            style={{ ...cardStyle, border: "1px solid #fdba74", background: "linear-gradient(180deg, #fff7ed 0%, #ffffff 40%)" }}
          >
            <div style={sectionTitleStyle}>{t.newItemsMode}</div>
            <p style={{ fontSize: 13, color: "#9a3412", margin: "4px 0 10px", lineHeight: 1.45 }}>{t.newItemsHero}</p>
            {newItemCatalogItems.length > 0 ? (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
                <button
                  type="button"
                  onClick={addAllNewItemsOneCase}
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
                  {t.addAllNewItemsOneCase}
                </button>
              </div>
            ) : null}

            {newItemCatalogItems.length === 0 ? (
              <div style={{ ...emptyStyle, border: "1px solid #fdba74", background: "#fff7ed", color: "#c2410c" }}>{t.noNewItems}</div>
            ) : (
              <CatalogVirtualGrid
                items={newItemCatalogItems}
                catalogQtyMap={catalogQtyMap}
                inCartLabel={t.inCart}
                palletLabel={t.pallet}
                justAddedLabel={t.justAdded}
                newBadgeLabel={t.newItems}
                newItemChecker={() => true}
                promoBadgeLabel={t.newItems}
                editLabel={t.editProduct}
                showAdminEdit={showAdminEditLinks}
                canOrderItem={isOrderableItem}
                orderBlockedMessage={(item) => formatOrderNotAvailableMessage(item.sku || "", item.status, t)}
                onAdjust={adjustCatalogQty}
                onUpdateQty={updateCatalogQty}
              />
            )}
          </section>
        ) : mode === "promotion" ? (
          <section
            className="order-shop-card"
            style={{ ...cardStyle, border: "1px solid #5eead4", background: "linear-gradient(180deg, #f0fdfa 0%, #ffffff 40%)" }}
          >
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
              <div className="order-promo-grid">
                {promotionItems.map((item) => {
                  const sku = item.sku?.toUpperCase() || "";
                  const qty = catalogQtyMap[sku] || "";
                  const soldOut = item.remainingQty === 0;
                  const dealHighlight = soldOut ? {} : getPromotionDealHighlight(item, t);
                  const promoDealLabel = dealHighlight.headline;
                  const promoDealDetail = dealHighlight.detail;
                  const promoPriceLabel = dealHighlight.simplePrice;
                  const promoDetailsLabel = soldOut
                    ? t.promoSoldOut
                    : [formatPromoBuyXGetYPackHint(item, t), formatPromoDetails(item, t)].filter(Boolean).join(" · ");
                  const promoRemainingLabel = soldOut
                    ? t.promoSoldOut
                    : item.remainingQty !== null && item.remainingQty !== undefined
                      ? `${t.promoRemaining}: ${item.remainingQty}`
                      : undefined;
                  const bogoPack = soldOut ? null : getPromoBogoPackSize(item);
                  const catalogItem = getCatalogItemBySku(sku) || item;
                  const notOrderable = !isOrderableItem(catalogItem);
                  const cardItem = catalogItem.palletSize
                    ? { ...item, palletSize: catalogItem.palletSize }
                    : item;
                  return (
                    <CatalogQtyCard
                      key={item.sku}
                      item={cardItem}
                      qty={qty}
                      palletLabel={t.pallet}
                      justAddedLabel={t.justAdded}
                      promoNote={soldOut ? t.promoSoldOut : item.promoNote}
                      promoDealLabel={promoDealLabel}
                      promoDealDetail={promoDealDetail}
                      promoPrice={promoPriceLabel}
                      promoDetails={promoDetailsLabel}
                      promoRemaining={promoRemainingLabel}
                      bogoPackSize={bogoPack}
                      roundUpBogoLabel={bogoPack ? t.roundUpBogo.replace("{pack}", String(bogoPack)) : undefined}
                      onRoundUpBogo={bogoPack ? () => roundUpBogoQty(sku, bogoPack) : undefined}
                      inCartLabel={t.inCart}
                      promoBadgeLabel={t.promoBadge}
                      editLabel={t.editProduct}
                      showAdminEdit={showAdminEditLinks}
                      highlight
                      disabled={soldOut || notOrderable}
                      unavailableNote={
                        notOrderable ? formatOrderNotAvailableMessage(sku, catalogItem.status, t) : undefined
                      }
                      onAdjust={adjustCatalogQty}
                      onUpdateQty={updateCatalogQty}
                    />
                  );
                })}
              </div>
            )}
          </section>
        ) : mode === "clearance" ? (
          <section
            className="order-shop-card"
            style={{ ...cardStyle, border: "1px solid #fdba74", background: "linear-gradient(180deg, #fff7ed 0%, #ffffff 40%)" }}
          >
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
              <div className="order-promo-grid">
                {clearanceItems.map((item) => {
                  const sku = item.sku?.toUpperCase() || "";
                  const qty = catalogQtyMap[sku] || "";
                  const soldOut = item.remainingQty === 0;
                  const priceLabel = item.clearancePrice ? `${t.clearancePrice}: ${item.clearancePrice}` : undefined;
                  const detailsLabel = soldOut ? t.clearanceSoldOut : formatClearanceDetails(item, t);
                  const remainingLabel = soldOut ? t.clearanceSoldOut : item.remainingQty !== null && item.remainingQty !== undefined ? `${t.clearanceRemaining}: ${item.remainingQty}` : undefined;
                  const catalogItem = getCatalogItemBySku(sku) || item;
                  const notOrderable = !isOrderableItem(catalogItem);
                  const cardItem = catalogItem.palletSize
                    ? { ...item, palletSize: catalogItem.palletSize }
                    : item;
                  return (
                    <CatalogQtyCard key={item.sku} item={cardItem} qty={qty}
                      palletLabel={t.pallet}
                      justAddedLabel={t.justAdded}
                      promoNote={soldOut ? t.clearanceSoldOut : item.clearanceNote || t.clearanceBadge}
                      promoPrice={priceLabel} promoDetails={detailsLabel} promoRemaining={remainingLabel}
                      policyNote={soldOut ? undefined : t.clearanceNoReturn}
                      inCartLabel={t.inCart} promoBadgeLabel={t.clearanceBadge} editLabel={t.editProduct}
                      showAdminEdit={showAdminEditLinks} highlight disabled={soldOut || notOrderable}
                      unavailableNote={
                        notOrderable ? formatOrderNotAvailableMessage(sku, catalogItem.status, t) : undefined
                      }
                      onAdjust={adjustCatalogQty} onUpdateQty={updateCatalogQty} />
                  );
                })}
              </div>
            )}
          </section>
        ) : (
          <section style={cardStyle} className="order-shop-card">
            {recommendedStripItems.length > 0 ? (
              <details className="order-details-fold">
                <summary>
                  {t.recommendedStripTitle} ({recommendedStripItems.length})
                </summary>
                <RecommendedStrip
                  lang={lang}
                  items={recommendedStripItems}
                  onAddOne={(sku) => adjustCatalogQty(sku, 1)}
                  hideTitle
                />
              </details>
            ) : null}

            <CatalogVirtualGrid
              items={orderableCatalogItems}
              catalogQtyMap={catalogQtyMap}
              inCartLabel={t.inCart}
              palletLabel={t.pallet}
              justAddedLabel={t.justAdded}
              promoBadgeLabel={t.promoBadge}
              weeklyPickSkus={promoSkuSet}
              clearancePickSkus={clearanceSkuSet}
              newItemChecker={isNewItem}
              clearanceBadgeLabel={t.clearanceBadge}
              newBadgeLabel={t.newItems}
              editLabel={t.editProduct}
              showAdminEdit={showAdminEditLinks}
              canOrderItem={isOrderableItem}
              orderBlockedMessage={(item) => formatOrderNotAvailableMessage(item.sku || "", item.status, t)}
              onAdjust={adjustCatalogQty}
              onUpdateQty={updateCatalogQty}
            />

            {orderableCatalogItems.length === 0 ? (
              <div style={{ ...emptyStyle, marginTop: 10 }}>{catalogShowSelectedOnly ? t.noItems : t.noMatches}</div>
            ) : null}
          </section>
        )}

        {orderHistory.length > 0 ? (
          <section style={cardStyle} className="order-secondary-section order-compact-fold">
            <button type="button" onClick={() => setShowHistory((prev) => !prev)} className="order-compact-fold-btn">
              <span className="order-compact-fold-title">{t.history}</span>
              <span className="order-compact-fold-action">{showHistory ? t.hide : t.show}</span>
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

      {showCart ? (
        <button
          type="button"
          className="order-cart-scrim"
          aria-label={t.hideCart}
          onClick={toggleCartPanel}
        />
      ) : null}

      {showCart ? (
        <div className="order-cart-sheet" aria-label={t.orderCart}>
          <div className="order-cart-sheet-inner">
            <OrderCartSection
              lang={lang}
              items={catalogItemsForSubmit}
              clearanceSkus={clearanceSkuSet}
              expanded
              onToggleExpanded={toggleCartPanel}
              lineCount={cartItemCount}
              totalCases={totalCases}
              onAdjustQty={adjustQtyForSku}
              onQtyInput={updateCatalogQty}
              onRemove={removeSkuFromOrder}
              nudge={
                clearanceUpsellLines.length > 0 ? (
                  <details className="order-cart-nudge-fold" open={cartItemCount > 0}>
                    <summary>
                      {t.clearanceMode} ({clearanceItems.length})
                    </summary>
                    <OrderShopNudge
                      lang={lang}
                      clearanceMissing={clearanceUpsellLines.length}
                      clearanceDealCount={clearanceItems.length}
                      onAddClearanceMissing={addAllMissingClearanceUpsell}
                      onViewClearance={() => changeMode("clearance")}
                    />
                  </details>
                ) : null
              }
              tools={
                <div className="order-cart-tools">
                  <div className="order-cart-tools-row">
                    <button type="button" onClick={downloadCsv} className="order-cart-tool-btn" style={secondaryButtonStyle}>
                      {t.downloadCsv}
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="order-cart-tool-btn"
                      style={secondaryButtonStyle}
                    >
                      {t.uploadCsv}
                    </button>
                    <button type="button" onClick={clearOrder} className="order-cart-clear-btn">
                      {t.clearOrder}
                    </button>
                    <input ref={fileInputRef} type="file" accept=".csv" style={{ display: "none" }} onChange={handleUploadCsv} />
                  </div>
                </div>
              }
            />
          </div>
        </div>
      ) : null}

      <div className="order-fixed-bar">
        <div className="order-fixed-bar-inner">
          {submitMsg ? (
            <div className={`order-fixed-msg${submitMsg.toLowerCase().includes("failed") ? " is-error" : " is-ok"}`}>
              {submitMsg}
            </div>
          ) : null}
          <div className="order-fixed-bar-layout">
            <button
              type="button"
              onClick={() => (showCart ? scrollToCart() : setShowCart(true))}
              className="order-fixed-summary-btn"
            >
              <span>
                {t.cartSummary}: {cartItemCount} {t.lines} / {totalCases} {t.cases}
                {!showCart ? (
                  <span className="order-fixed-inline-link">· {t.showCart}</span>
                ) : cartItemCount > 0 ? (
                  <span className="order-fixed-inline-link">· {t.jumpToCart}</span>
                ) : null}
              </span>
              {weeklyInCartCount > 0 || clearanceInCartCount > 0 ? (
                <span style={{ display: "block", fontSize: 10, color: "#6b7280", marginTop: 1, fontWeight: 700 }}>
                  {t.cartSalesSummary
                    .replace("{weekly}", String(weeklyInCartCount))
                    .replace("{clearance}", String(clearanceInCartCount))}
                </span>
              ) : null}
            </button>
            <button
              type="button"
              onClick={openReview}
              disabled={submitting || cartItemCount === 0}
              className="order-fixed-btn"
              style={secondaryButtonStyle}
            >
              {t.reviewCart}
            </button>
            <button
              type="button"
              onClick={openReview}
              disabled={submitting || cartItemCount === 0}
              className="order-fixed-btn is-submit"
              style={{ ...submitButtonStyle, background: submitting ? "#93c5fd" : "#16a34a" }}
            >
              {submitting ? t.submitting : t.submitOrder}
            </button>
          </div>
        </div>
      </div>

        <OrderReviewModal
          open={showReview}
          onClose={() => setShowReview(false)}
          lang={lang}
          items={catalogItemsForSubmit}
          warnings={orderReviewWarnings}
          clearanceUpsellLines={clearanceUpsellLines}
          onAddUpsellCase={(sku) => adjustQtyForSku(sku, 1)}
          onAddAllClearanceUpsell={addAllMissingClearanceUpsell}
          clearanceSkus={clearanceSkuSet}
          promoDealBySku={promoDealBySku}
          newItemsReminder={
            showNewItemsReviewReminder
              ? {
                  count: newItemCount,
                  onView: () => {
                    setShowReview(false);
                    changeMode("newItems");
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
        />
    </main>
  );
}


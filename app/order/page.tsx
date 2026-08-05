"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { brandMatchesFilter, isKnownBrandFilter, splitBrandFilters } from "@/lib/catalogBrands";
import { productMatchesCategoryFilters } from "@/lib/productCategories";
import { CATEGORY_OPTIONS } from "@/lib/inferCategory";

import { CatalogVirtualGrid } from "./components/CatalogVirtualGrid";
import { CatalogQtyCard } from "./components/CatalogQtyCard";
import { OrderCartModal } from "./components/OrderCartModal";
import { OrderBarcodeScanner } from "./components/OrderBarcodeScanner";
import { OrderFloatingCartFab } from "./components/OrderFloatingCartFab";
import { OrderPastOrdersModal } from "./components/OrderPastOrdersModal";
import { OrderQuickOrderPanel } from "./components/OrderQuickOrderPanel";
import { OrderQuickPicksStrip } from "./components/OrderQuickPicksStrip";
import { OrderShopNudge } from "./components/OrderShopNudge";
import { RecommendedStrip } from "./components/RecommendedStrip";
import { OrderInput } from "./components/OrderInput";
import { OrderReviewModal } from "./components/OrderReviewModal";
import { OrderSubmittedModal } from "./components/OrderSubmittedModal";
import { buildClearanceUpsellLines, buildWeeklyUpsellLines, pickPostSubmitSuggestions } from "./salesFlow";
import { consumePendingOrderIntent } from "@/lib/pendingOrderIntent";
import { ProductImage } from "./components/ProductImage";
import { replaceCatalog, catalog } from "./catalogState";
import { isProductOrderingBlocked } from "@/lib/productAvailability";
import { compareCatalogByNewestImport, compareCatalogForDisplay } from "@/lib/catalogNewItems";
import { clearCustomerSession, readCustomerSession, updateCustomerOrderEmail } from "@/lib/customerSession";
import { hasSavedAdminPassword } from "@/app/admin/_components/useAdminAuth";
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
  getUnavailableSubmitLines,
  findCatalogItemByScanCode,
  catalogSearchQueryFromScan,
  isOrderSearchQtyAdjustKey,
  resolveCatalogFilterTargetItem,
  resolveQuickSearchTargetItem,
  isNewItem,
  isOrderableItem,
  isCustomerVisibleCatalogItem,
  scoreCatalogSearchQuery,
} from "./catalogUtils";
import { DEFAULT_ORDER_EMAIL, isValidOrderEmail, resolveCustomerOrderEmail } from "@/lib/customerOrderEmail";
import {
  formatCustomerInvoicePriceLabel,
  type CustomerInvoicePriceEntry,
} from "@/lib/customerInvoicePriceDisplay";
import {
  buildCatalogQtyMapFromDraft,
  cartItemsFromQtyMap,
  countDraftItems,
  deviceQtyForSharedTotal,
  ensureDeviceCarts,
  getOrCreateOrderDeviceId,
  mergeOrderDrafts,
  normalizeOrderDraft,
  type OrderDraftPayload,
} from "@/lib/orderDraft";
import {
  applyQtyDelta,
  applyQtySet,
  buildCartDisplayItems,
  countCartLines,
  countTotalCases,
  expandOrderSubmitLines,
  getCatalogQty,
  getClearanceQty,
  nhItemsSkuSet,
  type QtyMaps,
} from "@/lib/orderNhItems";
import { copy } from "./orderCopy";
import { readInitialStickyPanelOpen, useMobileViewport } from "./useMobileViewport";
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
  clearanceModeButtonStyle,
  promoModeButtonStyle,
  secondaryButtonStyle,
  smallButtonStyle,
  submitButtonStyle,
} from "./orderStyles";
import type { CartItem, CatalogItem, ClearanceItem, Lang, OrderHistoryItem, OrderMode, PromotionItem } from "./types";

const ORDER_LANG_LABELS: Record<Lang, string> = {
  en: "EN",
  zh: "中文",
  ko: "한국어",
  vi: "Tiếng Việt",
};


const categoryOptions = CATEGORY_OPTIONS;

export default function OrderPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const skuInputRef = useRef<HTMLInputElement | null>(null);
  const mainRef = useRef<HTMLElement | null>(null);
  const submitLockRef = useRef(false);
  const autoLoadedRef = useRef(false);
  const clearanceFetchedRef = useRef(false);
  const transientMsgTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const addSkuToCartRef = useRef<(sku: string, qty?: string) => void>(() => {});
  const qtyInputRef = useRef("");
  const draftSnapshotRef = useRef({
    accountNo: "",
    storeName: "",
    phone: "",
    orderEmail: DEFAULT_ORDER_EMAIL,
    note: "",
    cart: [] as CartItem[],
    catalogQtyMap: {} as Record<string, string>,
  });
  const deviceIdRef = useRef("");
  const cloudDraftRef = useRef<OrderDraftPayload | null>(null);
  const deviceQtyMapRef = useRef<Record<string, string>>({});
  const cartDirtyRef = useRef(false);
  const lastCloudUpdatedAtRef = useRef("");

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
  qtyInputRef.current = qtyInput;
  const [cart, setCart] = useState<CartItem[]>([]);
  const [catalogQtyMap, setCatalogQtyMap] = useState<Record<string, string>>({});
  /** Session-only clearance cart — independent from catalogQtyMap. Not saved in drafts. */
  const [clearanceQtyMap, setClearanceQtyMap] = useState<Record<string, string>>({});
  const [catalogSearch, setCatalogSearch] = useState("");
  const [categoryFilters, setCategoryFilters] = useState<string[]>([]);
  const [brandFilter, setBrandFilter] = useState("ALL");
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState("");
  const [toastMsg, setToastMsg] = useState("");
  const [showReview, setShowReview] = useState(false);
  const [lastSubmittedRef, setLastSubmittedRef] = useState("");
  const [lastSubmittedItems, setLastSubmittedItems] = useState<CartItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<CatalogItem | null>(null);
  const [autoLoaded, setAutoLoaded] = useState(false);
  const [showAvailableOnly, setShowAvailableOnly] = useState(true);
  const [showCustomerInfo, setShowCustomerInfo] = useState(false);
  const [invoicePricingEnabled, setInvoicePricingEnabled] = useState(false);
  const [invoicePriceEntries, setInvoicePriceEntries] = useState<
    Record<string, CustomerInvoicePriceEntry>
  >({});
  const [fullscreen, setFullscreen] = useState(false);
  const [showPastOrders, setShowPastOrders] = useState(false);
  const [showCart, setShowCart] = useState(false);
  const [catalogShowSelectedOnly, setCatalogShowSelectedOnly] = useState(false);
  const [catalogShowRecommendedOnly, setCatalogShowRecommendedOnly] = useState(false);
  const [catalogFiltersOpen, setCatalogFiltersOpen] = useState(false);
  const [barcodeScannerOpen, setBarcodeScannerOpen] = useState(false);
  const [recentItems, setRecentItems] = useState<CartItem[]>([]);
  const [orderHistory, setOrderHistory] = useState<OrderHistoryItem[]>([]);
  const [catalogVersion, setCatalogVersion] = useState(0);
  const [promotionItems, setPromotionItems] = useState<PromotionItem[]>([]);
  const [promotionsLoading, setPromotionsLoading] = useState(false);
  const [clearanceItems, setClearanceItems] = useState<ClearanceItem[]>([]);
  const [clearanceLoading, setClearanceLoading] = useState(false);
  const [showAdminEditLinks, setShowAdminEditLinks] = useState(false);
  const [stickyPanelOpen, setStickyPanelOpen] = useState(readInitialStickyPanelOpen);
  const isMobileViewport = useMobileViewport();

  useEffect(() => {
    if (isMobileViewport && mode === "search") {
      setStickyPanelOpen(true);
    }
  }, [isMobileViewport, mode]);

  const toggleCategoryFilter = (cat: string) => {
    if (cat === "ALL") {
      setCategoryFilters([]);
      return;
    }
    setCategoryFilters((prev) =>
      prev.includes(cat) ? prev.filter((value) => value !== cat) : [...prev, cat]
    );
  };

  const categoryAllActive = categoryFilters.length === 0;

  const t = copy[lang];

  const passesAvailableFilter = useCallback(
    (item?: CatalogItem | null) => Boolean(item) && isOrderableItem(item) && !isProductOrderingBlocked(item),
    []
  );

  const showTransientToast = useCallback((message: string, ms = 4000) => {
    if (transientMsgTimerRef.current) clearTimeout(transientMsgTimerRef.current);
    setToastMsg(message);
    transientMsgTimerRef.current = setTimeout(() => {
      setToastMsg((current) => (current === message ? "" : current));
      transientMsgTimerRef.current = null;
    }, ms);
  }, []);

  const dismissFloatingNotice = useCallback(() => {
    if (transientMsgTimerRef.current) {
      clearTimeout(transientMsgTimerRef.current);
      transientMsgTimerRef.current = null;
    }
    setToastMsg("");
    setSubmitMsg("");
  }, []);

  useEffect(() => {
    return () => {
      if (transientMsgTimerRef.current) clearTimeout(transientMsgTimerRef.current);
    };
  }, []);

  const invoicePriceLabelForSku = useCallback(
    (sku: string) =>
      invoicePricingEnabled
        ? formatCustomerInvoicePriceLabel(sku, invoicePriceEntries, t.invoicePrice)
        : undefined,
    [invoicePricingEnabled, invoicePriceEntries, t.invoicePrice]
  );

  useEffect(() => {
    const syncAdminEdit = () => {
      setShowAdminEditLinks(hasSavedAdminPassword());
    };
    syncAdminEdit();

    const onVisible = () => {
      if (document.visibilityState === "visible") syncAdminEdit();
    };
    window.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", syncAdminEdit);

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
    return () => {
      window.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", syncAdminEdit);
    };
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
    dismissFloatingNotice();
  };

  const setFullscreenMode = async (next: boolean) => {
    setFullscreen(next);
    try {
      if (next) {
        await mainRef.current?.requestFullscreen?.();
      } else if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch {
      /* CSS-only fullscreen still works */
    }
  };

  const toggleFullscreen = () => {
    void setFullscreenMode(!fullscreen);
  };

  useEffect(() => {
    const syncFullscreen = () => {
      setFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", syncFullscreen);
    return () => document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && fullscreen && !document.fullscreenElement) {
        setFullscreen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [fullscreen]);

  useEffect(() => {
    autoLoadedRef.current = autoLoaded;
  }, [autoLoaded]);

  useEffect(() => {
    if (!deviceIdRef.current) {
      deviceIdRef.current = getOrCreateOrderDeviceId();
    }
  }, []);

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
    setInvoicePricingEnabled(false);
    setInvoicePriceEntries({});
  }, [accountNo]);

  useEffect(() => {
    const session = readCustomerSession();

    if (!session?.accountNo) {
      router.replace("/");
      return;
    }

    setAccountNo(session.accountNo);
    setStoreName(session.storeName || "");
    setOrderEmail(resolveCustomerOrderEmail(session.orderEmail || ""));
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

    const applySharedDraft = (draft: OrderDraftPayload, opts?: { keepClearance?: boolean }) => {
      const normalized = ensureDeviceCarts(draft) || normalizeOrderDraft(accountNo, draft);
      const deviceId = deviceIdRef.current || getOrCreateOrderDeviceId();
      deviceIdRef.current = deviceId;
      cloudDraftRef.current = normalized;
      deviceQtyMapRef.current = {
        ...(normalized.deviceCarts?.[deviceId]?.catalogQtyMap || {}),
      };
      lastCloudUpdatedAtRef.current = String(normalized.updatedAt || "");
      cartDirtyRef.current = false;
      setPhone(normalized.phone || "");
      setNote(normalized.note || "");
      const map = buildCatalogQtyMapFromDraft(normalized);
      setCatalogQtyMap(map);
      if (!opts?.keepClearance) setClearanceQtyMap({});
      setCart(cartItemsFromQtyMap(map));
      localStorage.setItem(`draft_${accountNo}`, JSON.stringify(normalized));
    };

    const loadDrafts = async () => {
      let localParsed: OrderDraftPayload | null = null;
      let cloudParsed: OrderDraftPayload | null = null;
      if (!deviceIdRef.current) {
        deviceIdRef.current = getOrCreateOrderDeviceId();
      }

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
        applySharedDraft(merged);
        if (countDraftItems(merged) > 0) {
          showTransientToast(t.loadedDraft);
        }

        try {
          await fetch("/api/save-draft", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...merged,
              deviceId: deviceIdRef.current,
              deviceQtyMap: deviceQtyMapRef.current,
              allowClear: countDraftItems(merged) === 0,
            }),
          });
        } catch {}
      }

      try {
        const profileRes = await fetch(
          `/api/customer-profile?accountNo=${encodeURIComponent(accountNo)}`,
          { cache: "no-store" }
        );
        const profileData = await profileRes.json();
        if (profileRes.ok) {
          if (profileData?.orderEmail) {
            const resolved = resolveCustomerOrderEmail(profileData.orderEmail);
            setOrderEmail(resolved);
            updateCustomerOrderEmail(resolved);
          }
          if (profileData?.invoicePricing) {
            setInvoicePricingEnabled(true);
            try {
              const priceRes = await fetch(
                `/api/customer-invoice-prices?accountNo=${encodeURIComponent(accountNo)}`,
                { cache: "no-store" }
              );
              const priceData = await priceRes.json();
              if (priceRes.ok && priceData?.enabled && priceData?.prices) {
                setInvoicePriceEntries(priceData.prices);
              } else {
                setInvoicePriceEntries({});
              }
            } catch {
              setInvoicePriceEntries({});
            }
          } else {
            setInvoicePricingEnabled(false);
            setInvoicePriceEntries({});
          }
        }
      } catch {}

      await loadRecentAndHistory(accountNo);
      setAutoLoaded(true);
      // Do not auto-focus SKU input on mobile; prevents page from jumping.
    };

    loadDrafts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, accountNo, autoLoaded]);

  useEffect(() => {
    if (!ready || !accountNo || !autoLoaded) return;

    const deviceId = deviceIdRef.current || getOrCreateOrderDeviceId();
    deviceIdRef.current = deviceId;
    const draft = normalizeOrderDraft(accountNo, {
      storeName,
      phone,
      orderEmail,
      note,
      cart,
      catalogQtyMap,
      deviceCarts: {
        ...(cloudDraftRef.current?.deviceCarts || {}),
        [deviceId]: {
          catalogQtyMap: deviceQtyMapRef.current,
          updatedAt: new Date().toISOString(),
        },
      },
      removedSkus: cloudDraftRef.current?.removedSkus,
      updatedAt: new Date().toISOString(),
    });
    localStorage.setItem(`draft_${accountNo}`, JSON.stringify(draft));

    const timer = setTimeout(async () => {
      const allowClear = countDraftItems(draft) === 0;
      const saveBody = {
        ...draft,
        deviceId,
        deviceQtyMap: deviceQtyMapRef.current,
        removedSkus: cloudDraftRef.current?.removedSkus,
        allowClear,
      };

      try {
        const res = await fetch("/api/save-draft", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(saveBody),
        });
        if (!res.ok) throw new Error("save failed");
        const data = await res.json();
        if (data?.draft) {
          const normalized = ensureDeviceCarts(data.draft) || normalizeOrderDraft(accountNo, data.draft);
          cloudDraftRef.current = normalized;
          deviceQtyMapRef.current = {
            ...(normalized.deviceCarts?.[deviceId]?.catalogQtyMap || {}),
          };
          lastCloudUpdatedAtRef.current = String(normalized.updatedAt || "");
          cartDirtyRef.current = false;
          localStorage.setItem(`draft_${accountNo}`, JSON.stringify(normalized));
          const shared = buildCatalogQtyMapFromDraft(normalized);
          setCatalogQtyMap((prev) => {
            const same =
              Object.keys(prev).length === Object.keys(shared).length &&
              Object.entries(shared).every(([sku, qty]) => prev[sku] === qty);
            return same ? prev : shared;
          });
          setCart((prev) => {
            const clearance = Object.fromEntries(
              prev.filter((item) => item.nhItems).map((item) => [item.sku.toUpperCase(), item.qty])
            );
            return buildCartDisplayItems({ catalog: shared, clearance });
          });
        }
      } catch {
        try {
          await fetch("/api/save-draft", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(saveBody),
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
      const deviceId = deviceIdRef.current || getOrCreateOrderDeviceId();

      const payload = normalizeOrderDraft(snapshot.accountNo, {
        ...snapshot,
        deviceCarts: {
          ...(cloudDraftRef.current?.deviceCarts || {}),
          [deviceId]: {
            catalogQtyMap: deviceQtyMapRef.current,
            updatedAt: new Date().toISOString(),
          },
        },
        removedSkus: cloudDraftRef.current?.removedSkus,
        updatedAt: new Date().toISOString(),
      });

      localStorage.setItem(`draft_${snapshot.accountNo}`, JSON.stringify(payload));

      if (typeof navigator.sendBeacon === "function") {
        const body = JSON.stringify({
          ...payload,
          deviceId,
          deviceQtyMap: deviceQtyMapRef.current,
          removedSkus: cloudDraftRef.current?.removedSkus,
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

  // Pull the shared cart so the other person's adds show up without refresh.
  useEffect(() => {
    if (!ready || !accountNo || !autoLoaded) return;

    const pullSharedCart = async () => {
      if (cartDirtyRef.current) return;
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      try {
        const res = await fetch(`/api/load-draft?accountNo=${encodeURIComponent(accountNo)}`, {
          method: "GET",
          cache: "no-store",
        });
        const data = await res.json();
        if (!res.ok || !data?.draft) return;
        const normalized = ensureDeviceCarts(data.draft) || normalizeOrderDraft(accountNo, data.draft);
        const updatedAt = String(normalized.updatedAt || "");
        if (!updatedAt || updatedAt === lastCloudUpdatedAtRef.current) return;
        if (cartDirtyRef.current) return;

        const deviceId = deviceIdRef.current || getOrCreateOrderDeviceId();
        cloudDraftRef.current = normalized;
        deviceQtyMapRef.current = {
          ...(normalized.deviceCarts?.[deviceId]?.catalogQtyMap || {}),
        };
        lastCloudUpdatedAtRef.current = updatedAt;
        const shared = buildCatalogQtyMapFromDraft(normalized);
        setCatalogQtyMap(shared);
        setCart((prev) => {
          // Keep clearance lines; replace catalog portion via buildCartDisplayItems.
          const clearance = Object.fromEntries(
            prev
              .filter((item) => item.nhItems)
              .map((item) => [item.sku.toUpperCase(), item.qty])
          );
          return buildCartDisplayItems({ catalog: shared, clearance });
        });
        localStorage.setItem(`draft_${accountNo}`, JSON.stringify(normalized));
      } catch {
        /* ignore poll errors */
      }
    };

    const timer = setInterval(pullSharedCart, 4000);
    const onVisible = () => {
      if (document.visibilityState === "visible") pullSharedCart();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [ready, accountNo, autoLoaded]);

  const normalizedSkuInput = useMemo(() => skuInput.trim().toUpperCase(), [skuInput]);

  const matchedItems = useMemo(() => {
    if (!normalizedSkuInput) return [];
    const q = normalizedSkuInput;

    return catalog
      .map((item) => ({ item, score: scoreCatalogSearchQuery(item, q) }))
      .filter((x) => x.score >= 0)
      .filter((x) => isCustomerVisibleCatalogItem(x.item))
      .filter((x) => (showAvailableOnly ? passesAvailableFilter(x.item) : true))
      .sort((a, b) => {
        const aNormal = isOrderableItem(a.item);
        const bNormal = isOrderableItem(b.item);
        if (aNormal !== bNormal) return aNormal ? -1 : 1;
        if (b.score !== a.score) return b.score - a.score;
        return compareCatalogForDisplay(a.item, b.item);
      })
      .map((x) => x.item)
      .slice(0, 60);
  }, [normalizedSkuInput, showAvailableOnly, catalogVersion]);

  const catalogBrowseBase = useMemo(() => {
    const visible = catalog.filter((item) => isCustomerVisibleCatalogItem(item));
    if (!showAvailableOnly) return visible;
    return visible.filter((item) => passesAvailableFilter(item));
  }, [catalogVersion, showAvailableOnly, passesAvailableFilter]);

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
        .sort(compareCatalogByNewestImport),
    [catalogBrowseBase]
  );

  const [invoiceFrequentSkus, setInvoiceFrequentSkus] = useState<string[]>([]);

  useEffect(() => {
    if (!accountNo) return;
    const inCart = new Set<string>();
    for (const [sku, qty] of Object.entries(catalogQtyMap || {})) {
      if (Number(qty) > 0) inCart.add(sku.toUpperCase());
    }
    for (const [sku, qty] of Object.entries(clearanceQtyMap || {})) {
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
  }, [accountNo, cart, catalogQtyMap, clearanceQtyMap]);

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
    () =>
      catalogBrowseBase.filter(
        (item) => recommendedSkuSet.has(item.sku?.toUpperCase() || "") && !isNewItem(item)
      ).length,
    [catalogBrowseBase, recommendedSkuSet]
  );

  const frequentCatalogItems = useMemo(
    () =>
      invoiceFrequentSkus
        .map((sku) => getCatalogItemBySku(sku))
        .filter((item): item is CatalogItem => Boolean(item))
        .filter((item) => (showAvailableOnly ? passesAvailableFilter(item) : true))
        .slice(0, 14),
    [invoiceFrequentSkus, showAvailableOnly, catalogVersion]
  );

  const cycleQuickOrderMatch = (direction: 1 | -1) => {
    if (matchedItems.length === 0) return;
    const currentIndex = selectedItem
      ? matchedItems.findIndex((item) => item.sku === selectedItem.sku)
      : -1;
    const nextIndex =
      direction === 1
        ? currentIndex < 0
          ? 0
          : Math.min(currentIndex + 1, matchedItems.length - 1)
        : currentIndex < 0
          ? 0
          : Math.max(currentIndex - 1, 0);
    const next = matchedItems[nextIndex];
    if (!next) return;
    setSelectedItem(next);
    setSkuInput(next.sku || "");
  };

  const activeCatalogFilterCount = useMemo(() => {
    let count = 0;
    if (showAvailableOnly) count += 1;
    if (categoryFilters.length > 0) count += 1;
    if (brandFilter !== "ALL") count += 1;
    if (catalogShowRecommendedOnly) count += 1;
    if (catalogShowSelectedOnly) count += 1;
    return count;
  }, [brandFilter, catalogShowRecommendedOnly, catalogShowSelectedOnly, categoryFilters, showAvailableOnly]);

  const orderableCatalogItems = useMemo(() => {
    const q = catalogSearch.trim().toUpperCase();

    return catalogBrowseBase
      .filter((item) => {
        if (catalogShowSelectedOnly) {
          const sku = (item.sku || "").toUpperCase();
          if (Number(catalogQtyMap[sku] || 0) <= 0) return false;
        }
        if (!productMatchesCategoryFilters(item, categoryFilters)) return false;
        if (brandFilter !== "ALL" && !brandMatchesFilter(item.brand, brandFilter)) return false;
        if (catalogShowRecommendedOnly && !recommendedSkuSet.has(item.sku?.toUpperCase() || "")) return false;
        return true;
      })
      .filter((item) => {
        if (!q) return true;
        return scoreCatalogSearchQuery(item, q) >= 0;
      })
      .sort((a, b) => {
        const aNormal = isOrderableItem(a);
        const bNormal = isOrderableItem(b);
        if (aNormal !== bNormal) return aNormal ? -1 : 1;
        return compareCatalogForDisplay(a, b);
      });
  }, [catalogSearch, categoryFilters, brandFilter, catalogQtyMap, catalogBrowseBase, catalogShowSelectedOnly, catalogShowRecommendedOnly, recommendedSkuSet]);

  useEffect(() => {
    if (brandFilter !== "ALL" && !isKnownBrandFilter(brandSplit, brandFilter)) {
      setBrandFilter("ALL");
    }
  }, [brandFilter, brandSplit]);

  const qtyMaps = useMemo(
    (): QtyMaps => ({ catalog: catalogQtyMap, clearance: clearanceQtyMap }),
    [catalogQtyMap, clearanceQtyMap]
  );

  const cartDisplayItems = useMemo(() => buildCartDisplayItems(qtyMaps), [qtyMaps]);

  const cartItemCount = useMemo(() => countCartLines(qtyMaps), [qtyMaps]);

  useEffect(() => {
    if (cartItemCount === 0) setShowCart(false);
  }, [cartItemCount]);

  const totalCases = useMemo(() => countTotalCases(qtyMaps), [qtyMaps]);

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
    if (isProductOrderingBlocked(catalogItem)) {
      alert(
        t.statusWarning
          .replace("{sku}", cleanSku)
          .replace("{status}", String(catalogItem.status || "UNAVAILABLE").trim().toUpperCase() || "UNAVAILABLE")
      );
      return true;
    }
    return false;
  };

  const applyQtyState = (next: QtyMaps) => {
    setCatalogQtyMap(next.catalog);
    setClearanceQtyMap(next.clearance);
    setCart(buildCartDisplayItems(next));
  };

  const syncDeviceContribution = (sku: string, desiredTotal: number) => {
    const deviceId = deviceIdRef.current || getOrCreateOrderDeviceId();
    deviceIdRef.current = deviceId;
    const myQty = deviceQtyForSharedTotal(cloudDraftRef.current, deviceId, sku, desiredTotal);
    const nextDevice = { ...deviceQtyMapRef.current };
    if (myQty > 0) nextDevice[sku] = String(myQty);
    else delete nextDevice[sku];
    deviceQtyMapRef.current = nextDevice;
    cartDirtyRef.current = true;
  };

  const setQtyForSku = (sku: string, value: string, source: "clearance" | "normal" = "normal") => {
    const cleanSku = sku.trim().toUpperCase();
    const cleanQty = String(value || "").replace(/[^0-9]/g, "");

    if (cleanQty && Number(cleanQty) > 0 && blockAddForSku(cleanSku)) {
      return;
    }

    if (source === "normal") {
      syncDeviceContribution(cleanSku, Number(cleanQty) || 0);
    }

    applyQtyState(applyQtySet(qtyMaps, cleanSku, cleanQty, source));
  };

  // Apply SKUs queued from /new or /promo after sign-in.
  useEffect(() => {
    if (!ready || !accountNo || !autoLoaded) return;
    const intent = consumePendingOrderIntent();
    if (!intent?.skus?.length) return;

    if (
      intent.mode === "promotion" ||
      intent.mode === "newItems" ||
      intent.mode === "catalog" ||
      intent.mode === "search" ||
      intent.mode === "clearance"
    ) {
      setMode(intent.mode);
      try {
        localStorage.setItem("order_mode", intent.mode);
      } catch {
        /* ignore */
      }
    }

    let maps = {
      catalog: { ...catalogQtyMap },
      clearance: { ...clearanceQtyMap },
    };
    let added = 0;
    for (const line of intent.skus) {
      const sku = String(line.sku || "").trim().toUpperCase();
      const qty = String(line.qty || "1").replace(/[^0-9]/g, "") || "1";
      if (!sku) continue;
      const item = getCatalogItemBySku(sku);
      if (!item || !isOrderableItem(item) || isProductOrderingBlocked(item)) continue;
      const next = Number(maps.catalog[sku] || 0) + (Number(qty) || 1);
      maps = applyQtySet(maps, sku, String(next), "normal");
      syncDeviceContribution(sku, next);
      added += 1;
    }

    if (added > 0) {
      applyQtyState(maps);
      showTransientToast(
        lang === "zh"
          ? `已加入 ${added} 个浏览商品到购物车`
          : lang === "ko"
            ? `둘러본 상품 ${added}개를 카트에 담았습니다`
            : lang === "vi"
              ? `Đã thêm ${added} SP xem trước vào giỏ`
              : `Added ${added} browsed item${added === 1 ? "" : "s"} to cart`
      );
      setShowCart(true);
    }
    // Run once after draft load; qty maps captured from that render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, accountNo, autoLoaded]);

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

    for (const item of expandOrderSubmitLines(qtyMaps)) {
      const cleanSku = item.sku.toUpperCase();
      const qty = Number(item.qty || 0);
      const catalogItem = getCatalogItemBySku(cleanSku);

      if (qty >= 100) warnings.push(t.highQtyWarning.replace("{sku}", cleanSku).replace("{qty}", String(qty)));
      // Unavailable / discontinued SKUs are shown in a dedicated review banner.

      if (item.nhItems) {
        const clearanceRemaining = getClearanceRemainingForSku(cleanSku);
        if (clearanceRemaining !== null && qty > clearanceRemaining) {
          warnings.push(t.clearanceQtyWarning.replace("{sku}", cleanSku).replace("{qty}", String(clearanceRemaining)));
        }
        const clearance = clearanceItems.find((c) => c.sku?.toUpperCase() === cleanSku);
        if (clearance?.daysUntilExpiry != null && clearance.daysUntilExpiry <= 7 && clearance.daysUntilExpiry >= 0) {
          warnings.push(`${cleanSku}: clearance expires in ${clearance.daysUntilExpiry} day(s).`);
        }
        continue;
      }

      const limitedQty = Number(String(catalogItem?.limitedQty || "").replace(/[^0-9]/g, ""));
      const promoRemaining = getPromoRemainingForSku(cleanSku);
      if (limitedQty > 0 && qty > limitedQty) warnings.push(t.limitedQtyWarning.replace("{sku}", cleanSku).replace("{qty}", String(limitedQty)));
      if (promoRemaining !== null && qty > promoRemaining) warnings.push(t.promoQtyWarning.replace("{sku}", cleanSku).replace("{qty}", String(promoRemaining)));

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
    }

    return warnings;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qtyMaps, promotionItems, clearanceItems, t]);

  const promoSkuSet = useMemo(
    () => new Set(promotionItems.map((item) => item.sku?.toUpperCase()).filter(Boolean) as Iterable<string>),
    [promotionItems]
  );

  const nhItemsSkuSetForOrder = useMemo(() => nhItemsSkuSet(qtyMaps), [qtyMaps]);

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

  const clearanceCartSkuSet = useMemo(() => nhItemsSkuSet(qtyMaps), [qtyMaps]);

  const clearanceUpsellLines = useMemo(
    () => buildClearanceUpsellLines(lang, clearanceItems, clearanceCartSkuSet, t),
    [lang, clearanceItems, clearanceCartSkuSet, t]
  );

  const showNewItemsReviewReminder = useMemo(() => {
    const catalogLines = expandOrderSubmitLines(qtyMaps).filter((item) => !item.nhItems);
    if (newItemCount === 0 || catalogLines.length === 0) return false;
    return catalogLines.every((item) => {
      const catalogItem = getCatalogItemBySku(item.sku);
      return !isNewItem(catalogItem);
    });
  }, [qtyMaps, newItemCount]);

  const recommendedStripItems = useMemo(() => {
    if (catalogShowRecommendedOnly) return [];
    return catalogBrowseBase
      .filter((item) => recommendedSkuSet.has((item.sku || "").toUpperCase()))
      .filter((item) => !isNewItem(item))
      .filter((item) => Number(catalogQtyMap[(item.sku || "").toUpperCase()] || 0) <= 0)
      .filter((item) => isOrderableItem(item) && !isProductOrderingBlocked(item))
      .slice(0, 8);
  }, [catalogBrowseBase, recommendedSkuSet, catalogQtyMap, catalogShowRecommendedOnly]);

  const postSubmitSuggestLines = useMemo(() => {
    if (!lastSubmittedRef || lastSubmittedItems.length === 0) return [];
    const submitted = new Set(
      lastSubmittedItems.map((item) => String(item.sku || "").trim().toUpperCase()).filter(Boolean)
    );
    const picks = pickPostSubmitSuggestions(promotionItems, submitted, 4);
    return buildWeeklyUpsellLines(lang, picks, submitted, copy[lang]).slice(0, 4);
  }, [lastSubmittedRef, lastSubmittedItems, promotionItems, lang]);

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

  const adjustQtyForSku = (sku: string, delta: number, source: "clearance" | "normal" = "normal") => {
    const cleanSku = sku.trim().toUpperCase();
    const current =
      source === "clearance" ? getClearanceQty(qtyMaps, cleanSku) : getCatalogQty(qtyMaps, cleanSku);
    let next = Math.max(0, current + delta);
    let appliedDelta = delta;

    if (delta > 0 && next > 0 && current <= 0 && blockAddForSku(cleanSku)) {
      return;
    }

    if (source === "normal") {
      const promoRemaining = getPromoRemainingForSku(cleanSku);
      if (delta > 0 && promoRemaining !== null && next > promoRemaining) {
        alert(t.promoLimitAlert.replace("{sku}", cleanSku).replace("{qty}", String(promoRemaining)));
        next = promoRemaining;
        appliedDelta = next - current;
      }

      const catalogItem = getCatalogItemBySku(cleanSku);
      const limitedQty = Number(String(catalogItem?.limitedQty || "").replace(/[^0-9]/g, ""));
      if (delta > 0 && limitedQty > 0 && next > limitedQty) {
        alert(`${cleanSku} limited qty is ${limitedQty}.`);
        next = limitedQty;
        appliedDelta = next - current;
      }
    }

    if (source === "clearance" && delta > 0) {
      const clearanceRemaining = getClearanceRemainingForSku(cleanSku);
      if (clearanceRemaining !== null && next > clearanceRemaining) {
        alert(t.clearanceLimitAlert.replace("{sku}", cleanSku).replace("{qty}", String(clearanceRemaining)));
        appliedDelta = clearanceRemaining - current;
        if (appliedDelta <= 0) return;
        next = current + appliedDelta;
      }
    }

    if (!appliedDelta) return;

    if (source === "normal") {
      syncDeviceContribution(cleanSku, next);
    }

    applyQtyState(applyQtyDelta(qtyMaps, cleanSku, appliedDelta, source));
  };

  const removeSkuFromOrder = (sku: string, nhItems?: boolean) => {
    // Catalog lines omit nhItems (undefined). Only clear the matching pool so
    // removing a catalog row does not wipe an independent clearance line.
    setQtyForSku(sku, "", nhItems === true ? "clearance" : "normal");
  };

  const adjustCartLineQty = (sku: string, delta: number, nhItems?: boolean) => {
    adjustQtyForSku(sku, delta, nhItems ? "clearance" : "normal");
  };

  const updateCartLineQty = (sku: string, value: string, nhItems?: boolean) => {
    if (nhItems) updateClearanceQty(sku, value);
    else updateCatalogQty(sku, value);
  };

  const addAllClearanceOneCase = () => {
    let next = qtyMaps;
    for (const item of clearanceItems) {
      if (item.remainingQty === 0) continue;
      const sku = item.sku?.toUpperCase();
      if (!sku) continue;
      const catalogItem = getCatalogItemBySku(sku) || item;
      if (!isOrderableItem(catalogItem)) continue;
      if (getClearanceQty(next, sku) <= 0 && blockAddForSku(sku)) continue;

      const current = getClearanceQty(next, sku);
      let appliedDelta = 1;
      const clearanceRemaining = getClearanceRemainingForSku(sku);
      if (clearanceRemaining !== null && current + 1 > clearanceRemaining) {
        appliedDelta = clearanceRemaining - current;
        if (appliedDelta <= 0) continue;
      }
      next = applyQtyDelta(next, sku, appliedDelta, "clearance");
    }
    applyQtyState(next);
  };

  const addAllMissingClearanceUpsell = () => {
    let next = qtyMaps;
    for (const line of clearanceUpsellLines) {
      const sku = String(line.sku || "").trim().toUpperCase();
      if (!sku) continue;
      if (getClearanceQty(next, sku) <= 0 && blockAddForSku(sku)) continue;

      const current = getClearanceQty(next, sku);
      let appliedDelta = 1;
      const clearanceRemaining = getClearanceRemainingForSku(sku);
      if (clearanceRemaining !== null && current + 1 > clearanceRemaining) {
        appliedDelta = clearanceRemaining - current;
        if (appliedDelta <= 0) continue;
      }
      next = applyQtyDelta(next, sku, appliedDelta, "clearance");
    }
    applyQtyState(next);
  };

  useEffect(() => {
    if (!normalizedSkuInput) {
      setSelectedItem(null);
      return;
    }

    const exactMatch =
      catalog.find((item) => item.sku?.toUpperCase() === normalizedSkuInput) ||
      findCatalogItemByScanCode(normalizedSkuInput);
    if (exactMatch && (!showAvailableOnly || passesAvailableFilter(exactMatch))) {
      setSelectedItem(exactMatch);
      return;
    }

    setSelectedItem(matchedItems.length > 0 ? matchedItems[0] : null);
  }, [normalizedSkuInput, matchedItems, showAvailableOnly]);

  const renderMobileScanButton = () => (
    <button
      type="button"
      className="order-shop-scan-btn"
      onClick={() => setBarcodeScannerOpen(true)}
      aria-label={t.scanBarcode}
    >
      <svg viewBox="0 0 24 24" width="20" height="20" focusable="false" aria-hidden>
        <path
          d="M3 5a2 2 0 012-2h3v2H5v3H3V5zm13-2h3a2 2 0 012 2v3h-2V5h-3V3zm2 13h3v-3h2v4a2 2 0 01-2 2h-3v-2zm-13 2H5v-3H3v4a2 2 0 002 2h3v-2z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path d="M8 9h1.5v6H8V9zm3.25 0H13v6h-1.75V9zm3.25 0H18v6h-1.5V9z" fill="currentColor" />
      </svg>
    </button>
  );

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
    adjustQtyForSku(finalSku, nextQty - currentQty, "normal");

    setSkuInput("");
    setQtyInput("");
    setSelectedItem(null);
    // Do not auto-focus SKU input; prevents page from jumping.
  };
  addSkuToCartRef.current = addSkuToCart;

  const handleBarcodeScan = useCallback(
    (raw: string) => {
      const term = catalogSearchQueryFromScan(raw);
      if (!term) return;
      setBarcodeScannerOpen(false);
      if (mode === "catalog") {
        setCatalogSearch(term);
        return;
      }
      if (mode === "search") {
        const scannedItem = findCatalogItemByScanCode(raw.trim());
        if (
          scannedItem?.sku &&
          isOrderableItem(scannedItem) &&
          !isProductOrderingBlocked(scannedItem)
        ) {
          const qty = qtyInputRef.current.trim() || "1";
          addSkuToCartRef.current(scannedItem.sku, qty);
          showTransientToast(`${scannedItem.sku} +${qty}`);
          return;
        }
        setSkuInput(term);
        requestAnimationFrame(() => skuInputRef.current?.focus());
      }
    },
    [mode, showTransientToast]
  );

  const addItem = () => {
    const typedSku = skuInput.trim().toUpperCase();
    const exactMatch =
      catalog.find((item) => item.sku?.toUpperCase() === typedSku) ||
      findCatalogItemByScanCode(skuInput.trim());
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
      setQtyForSku(cleanSku, promoRemaining ? String(promoRemaining) : "", "normal");
      return;
    }

    setQtyForSku(sku, value, "normal");
  };

  const updateClearanceQty = (sku: string, value: string) => {
    const cleanSku = sku.toUpperCase();
    const clean = value.replace(/[^0-9]/g, "");

    if (clean && Number(clean) > 0 && blockAddForSku(cleanSku)) {
      return;
    }

    const clearanceRemaining = getClearanceRemainingForSku(cleanSku);
    const requested = Number(clean) || 0;
    if (clearanceRemaining !== null && requested > clearanceRemaining) {
      alert(t.clearanceLimitAlert.replace("{sku}", cleanSku).replace("{qty}", String(clearanceRemaining)));
      setQtyForSku(cleanSku, clearanceRemaining ? String(clearanceRemaining) : "", "clearance");
      return;
    }

    setQtyForSku(cleanSku, clean, "clearance");
  };

  const adjustCatalogQty = (sku: string, delta: number) => {
    adjustQtyForSku(sku, delta, "normal");
  };

  const handleSearchQtyKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    target: CatalogItem | null
  ) => {
    if (!target?.sku || !isOrderSearchQtyAdjustKey(e.key)) return false;
    e.preventDefault();
    adjustCatalogQty(target.sku, e.key === "-" || e.key === "_" ? -1 : 1);
    return true;
  };

  const adjustClearanceQty = (sku: string, delta: number) => {
    adjustQtyForSku(sku, delta, "clearance");
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
      return Boolean(catalogItem && isOrderableItem(catalogItem));
    });
    const skipped = valid.length - orderable.length;
    if (skipped > 0) {
      const unavailable = getUnavailableSubmitLines(valid);
      const detail = unavailable
        .slice(0, 8)
        .map((item) => formatOrderNotAvailableMessage(item.sku, item.status, t))
        .join("\n");
      alert(`${t.unavailableInCartTitle}\n${detail}${unavailable.length > 8 ? "\n…" : ""}`);
    }

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
    showTransientToast(`${orderable.length} ${t.items} added.`);
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
    setClearanceQtyMap({});
    setShowCart(false);
    setSkuInput("");
    setQtyInput("");
    setSelectedItem(null);
    deviceQtyMapRef.current = {};
    cloudDraftRef.current = null;
    cartDirtyRef.current = false;
    lastCloudUpdatedAtRef.current = "";
    showTransientToast(t.cleared);
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
          deviceId: deviceIdRef.current || getOrCreateOrderDeviceId(),
          deviceQtyMap: {},
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
    return expandOrderSubmitLines(qtyMaps);
  };

  const unavailableSubmitItems = useMemo(
    () => getUnavailableSubmitLines(expandOrderSubmitLines(qtyMaps)),
    // catalogVersion refreshes after catalog reload / submit so status changes are picked up
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [qtyMaps, catalogVersion]
  );

  const removeUnavailableFromOrder = () => {
    const unavailable = getUnavailableSubmitLines(getCurrentSubmitItems());
    for (const item of unavailable) {
      removeSkuFromOrder(item.sku, item.nhItems);
    }
    return unavailable;
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
      setClearanceQtyMap({});
      setCart(parsed);
      showTransientToast(`${parsed.length} ${t.items} loaded.`);
    } catch (error: any) {
      alert(error?.message || "Failed to read CSV.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const logout = () => {
    clearCustomerSession();
    router.replace("/");
  };

  const openReview = () => {
    const items = getCurrentSubmitItems();

    if (items.length === 0) {
      alert(t.addAtLeast);
      return;
    }

    // Open review even if some SKUs are discontinued — the modal lists them and
    // offers remove / remove-and-submit so the customer can finish the order.
    setShowReview(true);
  };

  const submitOrder = async (itemsOverride?: CartItem[]) => {
    if (submitLockRef.current || submitting) return;

    const items = itemsOverride ?? getCurrentSubmitItems();

    if (items.length === 0) {
      alert(t.addAtLeast);
      return;
    }

    const unavailable = getUnavailableSubmitLines(items);
    if (unavailable.length > 0) {
      const detail = unavailable
        .map((item) => formatOrderNotAvailableMessage(item.sku, item.status, t))
        .join("\n");
      setSubmitMsg(`${t.unavailableInCartTitle}\n${detail}`);
      setShowReview(true);
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
      if (!res.ok) {
        if (Array.isArray(data?.unavailableItems) && data.unavailableItems.length > 0) {
          const detail = data.unavailableItems
            .map((item: { sku?: string; status?: string }) =>
              formatOrderNotAvailableMessage(String(item?.sku || ""), item?.status, t)
            )
            .join("\n");
          throw new Error(`${t.unavailableInCartTitle}\n${detail}`);
        }
        throw new Error(data?.error || t.failedSubmit);
      }

      setSubmitMsg(`${t.orderSuccess} ${t.ref}: ${ref}`);
      setLastSubmittedRef(ref);
      setLastSubmittedItems(items);
      setShowReview(false);
      setCart([]);
      setCatalogQtyMap({});
      setClearanceQtyMap({});
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

  const removeUnavailableAndSubmit = () => {
    const current = getCurrentSubmitItems();
    const unavailable = getUnavailableSubmitLines(current);
    if (unavailable.length === 0) {
      void submitOrder(current);
      return;
    }

    const unavailableKey = new Set(
      unavailable.map((item) => `${item.sku.toUpperCase()}::${item.nhItems ? "nh" : "cat"}`)
    );
    const remaining = current.filter(
      (item) => !unavailableKey.has(`${item.sku.toUpperCase()}::${item.nhItems ? "nh" : "cat"}`)
    );

    for (const item of unavailable) {
      removeSkuFromOrder(item.sku, item.nhItems);
    }

    showTransientToast(t.unavailableRemoved.replace("{count}", String(unavailable.length)));

    if (remaining.length === 0) {
      setSubmitMsg(t.addAtLeast);
      return;
    }

    void submitOrder(remaining);
  };

  const renderProductMeta = (item: CatalogItem) => (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginTop: 5, overflow: "visible" }}>
      {item.size ? <span style={{ fontSize: 10, color: "#6b7280" }}>{t.size}: {item.size}</span> : null}
      {item.palletSize ? <span style={{ fontSize: 10, color: "#6b7280" }}>{t.pallet}: {item.palletSize}</span> : null}
      {item.limitedQty ? <span style={limitedBadgeStyle}>{t.limited}: {item.limitedQty}</span> : null}
      {getDisplayStatus(item.status) ? <span style={{ padding: "2px 7px", borderRadius: 999, fontSize: 10, fontWeight: 700, ...getStatusBadgeStyle(item.status) }}>{getDisplayStatus(item.status)}</span> : null}
    </div>
  );

  const stickyModeLabel =
    mode === "promotion"
      ? t.promotionMode
      : mode === "newItems"
        ? t.newItemsMode
        : mode === "clearance"
          ? t.clearanceMode
          : mode === "catalog"
            ? t.catalogMode
            : t.searchMode;

  const renderCatalogSearchRow = (className = "") => (
    <div className={`order-sticky-search-row${className ? ` ${className}` : ""}`}>
      <input
        value={catalogSearch}
        onChange={(e) => setCatalogSearch(e.target.value)}
        onKeyDown={(e) => {
          handleSearchQtyKeyDown(e, resolveCatalogFilterTargetItem(catalogSearch, orderableCatalogItems));
        }}
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
  );

  const renderCatalogScopeChips = (className = "") => (
    <div className={`order-sticky-catalog-chips${className ? ` ${className}` : ""}`}>
      <button
        type="button"
        onClick={() => setCatalogShowRecommendedOnly((prev) => !prev)}
        style={categoryButtonStyle(catalogShowRecommendedOnly)}
      >
        {t.recommended} ({recommendedItemCount})
      </button>
      <label className="order-sticky-filter-check">
        <input
          type="checkbox"
          checked={catalogShowSelectedOnly}
          onChange={(e) => setCatalogShowSelectedOnly(e.target.checked)}
        />
        {t.selectedOnly} ({cartItemCount})
      </label>
      <label className="order-sticky-filter-check">
        <input type="checkbox" checked={showAvailableOnly} onChange={(e) => setShowAvailableOnly(e.target.checked)} />
        {t.availableOnly}
      </label>
    </div>
  );

  const renderModeTabs = () => (
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
  );

  const renderMobileModeTags = () => (
    <div className="order-shop-mode-tags" role="tablist" aria-label="Order mode">
      <button
        type="button"
        role="tab"
        aria-selected={mode === "promotion"}
        onClick={() => changeMode("promotion")}
        className={`order-shop-tag order-shop-tag--promo${mode === "promotion" ? " is-active" : ""}`}
      >
        {t.promotionMode}
        {promotionItems.length > 0 ? ` (${promotionItems.length})` : ""}
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mode === "newItems"}
        onClick={() => changeMode("newItems")}
        className={`order-shop-tag order-shop-tag--new${mode === "newItems" ? " is-active" : ""}`}
      >
        {t.newItemsMode}
        {newItemCount > 0 ? ` (${newItemCount})` : ""}
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mode === "clearance"}
        onClick={() => changeMode("clearance")}
        className={`order-shop-tag order-shop-tag--clearance${mode === "clearance" ? " is-active" : ""}`}
      >
        {t.clearanceMode}
        {clearanceItems.length > 0 ? ` (${clearanceItems.length})` : ""}
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mode === "catalog"}
        onClick={() => changeMode("catalog")}
        className={`order-shop-tag order-shop-tag--catalog${mode === "catalog" ? " is-active" : ""}`}
      >
        {t.catalogMode}
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mode === "search"}
        onClick={() => changeMode("search")}
        className={`order-shop-tag order-shop-tag--quick${mode === "search" ? " is-active" : ""}`}
      >
        {t.searchMode}
      </button>
    </div>
  );

  const renderMobileShopHeader = () => (
    <div className="order-shop-header">
      <div className="order-shop-header-top">
        <div className="order-shop-store">
          <span className="order-shop-store-name">{storeName}</span>
          <span className="order-shop-store-id">{accountNo}</span>
        </div>
        <div className="order-shop-header-actions">
          <div className="order-shop-lang" role="group" aria-label="Language">
            {(["en", "zh", "ko", "vi"] as Lang[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => changeLang(item)}
                className={`order-shop-lang-btn${lang === item ? " is-active" : ""}`}
              >
                {ORDER_LANG_LABELS[item]}
              </button>
            ))}
          </div>
          {orderHistory.length > 0 ? (
            <button
              type="button"
              className="order-shop-icon-btn"
              onClick={() => setShowPastOrders(true)}
              aria-label={`${t.history} (${orderHistory.length})`}
            >
              <span aria-hidden>📋</span>
              <span className="order-shop-icon-badge">{orderHistory.length}</span>
            </button>
          ) : null}
          <button type="button" onClick={logout} className="order-shop-icon-btn order-shop-icon-btn--text">
            {t.logout}
          </button>
        </div>
      </div>

      {renderMobileModeTags()}

      {mode === "catalog" ? (
        <div className="order-shop-search-row">
          <label className="order-shop-search-field">
            <span className="order-shop-search-icon" aria-hidden>
              <svg viewBox="0 0 24 24" width="18" height="18" focusable="false">
                <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2.2" />
                <path d="M20 20l-3.5-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
              </svg>
            </span>
            <input
              value={catalogSearch}
              onChange={(e) => setCatalogSearch(e.target.value)}
              onKeyDown={(e) => {
                handleSearchQtyKeyDown(e, resolveCatalogFilterTargetItem(catalogSearch, orderableCatalogItems));
              }}
              placeholder={t.catalogSearch}
              className="order-shop-search-input"
              aria-label={t.catalogSearch}
            />
          </label>
          {renderMobileScanButton()}
          <button
            type="button"
            className={`order-shop-filter-btn${catalogFiltersOpen || activeCatalogFilterCount > 0 ? " is-active" : ""}`}
            onClick={() => setCatalogFiltersOpen((prev) => !prev)}
            aria-label={catalogFiltersOpen ? t.hideFilters : t.showFilters}
            aria-pressed={catalogFiltersOpen}
          >
            <svg viewBox="0 0 24 24" width="20" height="20" focusable="false" aria-hidden>
              <path
                d="M4 7h16M7 12h10M10 17h4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            </svg>
            {activeCatalogFilterCount > 0 ? (
              <span className="order-shop-filter-badge">{activeCatalogFilterCount}</span>
            ) : null}
          </button>
        </div>
      ) : null}

      {mode === "search" ? (
        <div className="order-shop-search-row order-shop-quick-composer">
          <label className="order-shop-search-field">
            <span className="order-shop-search-icon" aria-hidden>
              <svg viewBox="0 0 24 24" width="18" height="18" focusable="false">
                <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2.2" />
                <path d="M20 20l-3.5-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
              </svg>
            </span>
            <input
              ref={skuInputRef}
              value={skuInput}
              onChange={(e) => setSkuInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (
                  handleSearchQtyKeyDown(
                    e,
                    resolveQuickSearchTargetItem(skuInput, {
                      selected: selectedItem,
                      matched: matchedItems,
                    })
                  )
                ) {
                  return;
                }
                if (e.key === "Enter") {
                  e.preventDefault();
                  addItem();
                  return;
                }
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  cycleQuickOrderMatch(1);
                  return;
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  cycleQuickOrderMatch(-1);
                }
              }}
              placeholder={t.searchPlaceholder}
              autoCapitalize="characters"
              className="order-shop-search-input"
              aria-label={t.skuItem}
            />
          </label>
          {renderMobileScanButton()}
          <input
            value={qtyInput}
            onChange={(e) => setQtyInput(e.target.value.replace(/[^0-9]/g, ""))}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addItem();
              }
            }}
            placeholder="1"
            inputMode="numeric"
            className="order-shop-qty-input order-shop-qty-input--inline"
            aria-label={t.qty}
          />
          <button type="button" className="order-shop-add-btn order-shop-add-btn--inline" onClick={addItem}>
            +
          </button>
        </div>
      ) : null}

      {mode === "search" && !normalizedSkuInput ? (
        <OrderQuickPicksStrip
          lang={lang}
          compact
          recentItems={recentItems}
          frequentItems={frequentCatalogItems}
          catalogQtyMap={catalogQtyMap}
          onAddSkuToCart={addSkuFromSearch}
          onAdjustQty={adjustCatalogQty}
        />
      ) : null}
    </div>
  );

  const showCatalogSearch = mode === "catalog" && stickyPanelOpen && !isMobileViewport;

  const renderCatalogFiltersPanel = () =>
    catalogFiltersOpen && mode === "catalog" ? (
      <div className="order-sticky-filters">
        {isMobileViewport ? (
          <>
            {renderCatalogScopeChips("order-sticky-catalog-chips--in-filters")}
            <div className="order-sticky-catalog-meta order-sticky-catalog-meta--in-filters">
              {t.selected}: {cartItemCount} · {t.showing} {orderableCatalogItems.length} {t.catalogCount}
            </div>
          </>
        ) : null}
        <div style={filterBlockStyle}>
          <div style={filterLabelStyle}>{t.category}</div>
          <div style={categoryBarStyle} className="order-category-filters">
            {categoryOptions.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => toggleCategoryFilter(cat)}
                style={categoryButtonStyle(cat === "ALL" ? categoryAllActive : categoryFilters.includes(cat))}
                aria-pressed={cat === "ALL" ? categoryAllActive : categoryFilters.includes(cat)}
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
                  value={brandFilter !== "ALL" && brandSplit.moreBrands.includes(brandFilter) ? brandFilter : ""}
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
    ) : null;

  if (!ready) return null;

  const renderStickyPanelToggle = (inline = false) => (
    <button
      type="button"
      className={`order-sticky-panel-toggle${inline ? " order-sticky-panel-toggle--inline" : ""}`}
      onClick={() => setStickyPanelOpen((open) => !open)}
      aria-expanded={stickyPanelOpen}
      aria-label={stickyPanelOpen ? t.hide : t.show}
    >
      <span className="order-sticky-panel-toggle-label">{stickyPanelOpen ? t.hide : t.show}</span>
      <span className="order-sticky-panel-toggle-icon" aria-hidden>
        {stickyPanelOpen ? (
          <svg viewBox="0 0 20 12" width="20" height="12" focusable="false">
            <path d="M3 9.5 10 3.5 17 9.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M3 5.5 10 1 17 5.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg viewBox="0 0 20 12" width="20" height="12" focusable="false">
            <path d="M3 2.5 10 8.5 17 2.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M3 6.5 10 11 17 6.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
    </button>
  );

  return (
    <main ref={mainRef} className={`order-page${fullscreen ? " is-fullscreen" : ""}${isMobileViewport ? " order-page--mobile-shop" : ""}`}>
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
              className={`order-header-link order-fullscreen-toggle${fullscreen ? " is-open" : ""}`}
              onClick={toggleFullscreen}
              aria-pressed={fullscreen}
            >
              {fullscreen ? t.exitFullscreen : t.enterFullscreen}
            </button>
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
            {fullscreen ? (
              <div className="order-fullscreen-toolbar">
                <span className="order-fullscreen-meta">
                  {accountNo} · {storeName}
                </span>
                <button type="button" className="order-fullscreen-exit" onClick={toggleFullscreen}>
                  {t.exitFullscreen}
                </button>
              </div>
            ) : null}
            {isMobileViewport && !fullscreen ? (
              <>
                {renderMobileShopHeader()}
                {renderCatalogFiltersPanel()}
              </>
            ) : (
              <>
            {renderModeTabs()}

            {showCatalogSearch ? renderCatalogSearchRow() : null}
            {renderCatalogFiltersPanel()}

            {stickyPanelOpen ? (
              <>
                {!isMobileViewport && orderHistory.length > 0 ? (
                  <button
                    type="button"
                    className="order-past-orders-chip order-past-orders-chip--compact"
                    onClick={() => setShowPastOrders(true)}
                    aria-label={`${t.history} (${orderHistory.length})`}
                  >
                    <span className="order-past-orders-chip-icon" aria-hidden>
                      📋
                    </span>
                    <span className="order-past-orders-chip-text">
                      <strong>{t.history}</strong>
                      <span className="order-past-orders-chip-hint">{t.historyChipHint}</span>
                    </span>
                    <span className="order-past-orders-chip-count">{orderHistory.length}</span>
                  </button>
                ) : null}

                {mode === "catalog" ? (
                  <>
                    {!isMobileViewport ? renderCatalogScopeChips() : null}
                    {!isMobileViewport ? (
                      <div className="order-sticky-catalog-footer">
                        <div className="order-sticky-catalog-meta">
                          {t.selected}: {cartItemCount} · {t.showing} {orderableCatalogItems.length} {t.catalogCount}
                        </div>
                        {renderStickyPanelToggle(true)}
                      </div>
                    ) : null}
                  </>
                ) : null}

                {mode === "search" && !isMobileViewport ? (
                  <>
                    <div className="order-sticky-search-row is-single">
                      <input
                        ref={skuInputRef}
                        value={skuInput}
                        onChange={(e) => setSkuInput(e.target.value.toUpperCase())}
                        onKeyDown={(e) => {
                          if (
                            handleSearchQtyKeyDown(
                              e,
                              resolveQuickSearchTargetItem(skuInput, {
                                selected: selectedItem,
                                matched: matchedItems,
                              })
                            )
                          ) {
                            return;
                          }
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addItem();
                            return;
                          }
                          if (e.key === "ArrowDown") {
                            e.preventDefault();
                            cycleQuickOrderMatch(1);
                            return;
                          }
                          if (e.key === "ArrowUp") {
                            e.preventDefault();
                            cycleQuickOrderMatch(-1);
                          }
                        }}
                        placeholder={t.searchPlaceholder}
                        autoCapitalize="characters"
                        className="order-sticky-search-input"
                        aria-label={t.skuItem}
                      />
                    </div>
                    <div className="order-sticky-search-row order-sticky-search-composer">
                      <input
                        value={qtyInput}
                        onChange={(e) => setQtyInput(e.target.value.replace(/[^0-9]/g, ""))}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addItem();
                          }
                        }}
                        placeholder="1"
                        inputMode="numeric"
                        className="order-sticky-search-qty"
                        aria-label={t.qty}
                      />
                      <button type="button" className="order-sticky-search-add" onClick={addItem}>
                        {t.addItem}
                      </button>
                    </div>
                  </>
                ) : null}

                {mode !== "catalog" && !isMobileViewport ? (
                  <div className="order-sticky-panel-footer order-sticky-panel-footer--end">
                    {renderStickyPanelToggle(true)}
                  </div>
                ) : null}
              </>
            ) : (
              !isMobileViewport ? <div className="order-sticky-panel-collapsed">{stickyModeLabel}</div> : null
            )}

            {!stickyPanelOpen && !isMobileViewport ? renderStickyPanelToggle() : null}
              </>
            )}
          </div>
        </div>

        {mode === "search" && (!isMobileViewport || normalizedSkuInput) ? (
          <OrderQuickOrderPanel
            lang={lang}
            compact={isMobileViewport}
            hideQuickPicks={isMobileViewport}
            normalizedQuery={normalizedSkuInput}
            matchedItems={matchedItems}
            selectedItem={selectedItem}
            onSelectItem={(item) => {
              setSelectedItem(item);
              setSkuInput(item.sku || "");
            }}
            catalogQtyMap={catalogQtyMap}
            recentItems={recentItems}
            frequentItems={frequentCatalogItems}
            showAvailableOnly={showAvailableOnly}
            onShowAvailableOnlyChange={setShowAvailableOnly}
            invoicePriceLabelForSku={invoicePriceLabelForSku}
            onApplyQuickQty={applyQuickQtyToSelected}
            onAdjustQty={adjustCatalogQty}
            onUpdateQty={updateCatalogQty}
            onAddSkuToCart={addSkuFromSearch}
          />
        ) : mode === "newItems" ? (
          <section className="order-shop-card order-shop-card--new">
            {newItemCatalogItems.length === 0 ? (
              <div style={{ ...emptyStyle, border: "1px solid #fdba74", background: "#fff7ed", color: "#c2410c" }}>{t.noNewItems}</div>
            ) : (
              <div className="order-promo-grid order-new-items-grid">
                {newItemCatalogItems.map((item) => {
                  const sku = item.sku?.toUpperCase() || "";
                  const qty = catalogQtyMap[sku] || "";
                  return (
                    <CatalogQtyCard
                      key={item.sku}
                      item={item}
                      qty={qty}
                      palletLabel={t.pallet}
                      justAddedLabel={t.justAdded}
                      inCartLabel={t.inCart}
                      promoBadgeLabel={t.newItems}
                      editLabel={t.editProduct}
                      showAdminEdit={showAdminEditLinks}
                      showNewItemListPrice
                      showNewProductBadge
                      showPublishedDate
                      publishedDateLabel={t.publishedDate}
                      showComingDate
                      comingDateLabel={t.comingDate}
                      listPriceLabel={t.listPrice}
                      lang={lang}
                      disabled={!isOrderableItem(item)}
                      unavailableNote={
                        !isOrderableItem(item)
                          ? formatOrderNotAvailableMessage(item.sku || "", item.status, t)
                          : undefined
                      }
                      invoicePrice={invoicePriceLabelForSku(sku)}
                      onAdjust={adjustCatalogQty}
                      onUpdateQty={updateCatalogQty}
                    />
                  );
                })}
              </div>
            )}
          </section>
        ) : mode === "promotion" ? (
          <section className="order-shop-card order-shop-card--promo">
            {recommendedStripItems.length > 0 ? (
              <RecommendedStrip
                lang={lang}
                items={recommendedStripItems}
                onAddOne={(sku) => adjustCatalogQty(sku, 1)}
              />
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
          <section className="order-shop-card order-shop-card--clearance">
            {clearanceItems.length > 0 ? (
              <div className="order-clearance-bulk-row">
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
                  const qty = clearanceQtyMap[sku] || "";
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
                      onAdjust={adjustClearanceQty} onUpdateQty={updateClearanceQty} />
                  );
                })}
              </div>
            )}
          </section>
        ) : (
          <section className="order-shop-card order-shop-card--listing">
            {recommendedStripItems.length > 0 ? (
              <RecommendedStrip
                lang={lang}
                items={recommendedStripItems}
                onAddOne={(sku) => adjustCatalogQty(sku, 1)}
              />
            ) : null}

            {orderableCatalogItems.length === 0 ? (
              <div style={{ ...emptyStyle, marginTop: 10 }}>{catalogShowSelectedOnly ? t.noItems : t.noMatches}</div>
            ) : (
              <div className="order-catalog-css-grid">
                {orderableCatalogItems.map((item) => {
                  const sku = item.sku?.toUpperCase() || "";
                  const qty = catalogQtyMap[sku] || "";
                  const isWeekly = promoSkuSet.has(sku);
                  const showItemNewBadge = isNewItem(item);
                  const promoNote = showItemNewBadge
                    ? undefined
                    : isWeekly
                      ? t.promoBadge
                      : undefined;
                  const canOrder = isOrderableItem(item) && !isProductOrderingBlocked(item);
                  return (
                    <CatalogQtyCard
                      key={item.sku}
                      item={item}
                      qty={qty}
                      promoNote={promoNote}
                      inCartLabel={t.inCart}
                      promoBadgeLabel={t.promoBadge}
                      highlight={Boolean(isWeekly)}
                      editLabel={t.editProduct}
                      palletLabel={t.pallet}
                      justAddedLabel={t.justAdded}
                      lang={lang}
                      showAdminEdit={showAdminEditLinks}
                      showNewProductBadge={showItemNewBadge}
                      disabled={!canOrder}
                      unavailableNote={
                        !canOrder ? formatOrderNotAvailableMessage(item.sku || "", item.status, t) : undefined
                      }
                      invoicePrice={invoicePriceLabelForSku(sku)}
                      onAdjust={adjustCatalogQty}
                      onUpdateQty={updateCatalogQty}
                    />
                  );
                })}
              </div>
            )}
          </section>
        )}

      </div>

      <OrderCartModal
        open={showCart}
        onClose={toggleCartPanel}
        onReview={() => {
          setShowCart(false);
          openReview();
        }}
        onConfirm={() => {
          setShowCart(false);
          openReview();
        }}
        statusMessage={submitMsg}
        lang={lang}
        items={cartDisplayItems}
        nhItemsSkus={nhItemsSkuSetForOrder}
        lineCount={cartItemCount}
        totalCases={totalCases}
        submitting={submitting}
        onAdjustQty={adjustCartLineQty}
        onQtyInput={updateCartLineQty}
        onRemove={removeSkuFromOrder}
        unavailableItems={unavailableSubmitItems}
        onRemoveUnavailable={() => {
          const removed = removeUnavailableFromOrder();
          if (removed.length > 0) {
            showTransientToast(t.unavailableRemoved.replace("{count}", String(removed.length)));
          }
        }}
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

      <OrderPastOrdersModal
        open={showPastOrders}
        onClose={() => setShowPastOrders(false)}
        lang={lang}
        orders={orderHistory}
        onReorder={reorderItems}
      />

      <OrderBarcodeScanner
        open={barcodeScannerOpen}
        onClose={() => setBarcodeScannerOpen(false)}
        onScan={handleBarcodeScan}
        labels={{
          title: t.scanBarcodeTitle,
          hint: t.scanBarcodeHint,
          close: t.close,
          cameraError: t.scanBarcodeCameraError,
          torchOn: t.scanBarcodeTorchOn,
          torchOff: t.scanBarcodeTorchOff,
        }}
      />

      <OrderFloatingCartFab
        count={cartItemCount}
        label={t.cartSummary}
        hidden={showCart || showPastOrders || barcodeScannerOpen}
        onClick={() => (showCart ? toggleCartPanel() : setShowCart(true))}
      />

      {(toastMsg || submitMsg) && !showCart ? (
        <div
          className={`order-floating-toast${(toastMsg || submitMsg).toLowerCase().includes("failed") ? " is-error" : " is-ok"}`}
          role="status"
          onClick={dismissFloatingNotice}
        >
          {toastMsg || submitMsg}
        </div>
      ) : null}

        <OrderReviewModal
          open={showReview}
          onClose={() => setShowReview(false)}
          lang={lang}
          items={cartDisplayItems}
          warnings={orderReviewWarnings}
          unavailableItems={unavailableSubmitItems}
          clearanceUpsellLines={clearanceUpsellLines}
          onAddUpsellCase={(sku) => adjustQtyForSku(sku, 1, "clearance")}
          onAddAllClearanceUpsell={addAllMissingClearanceUpsell}
          nhItemsSkus={nhItemsSkuSetForOrder}
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
          onAdjustQty={adjustCartLineQty}
          onQtyInput={updateCartLineQty}
          onRemove={removeSkuFromOrder}
          onRemoveUnavailable={() => {
            const removed = removeUnavailableFromOrder();
            if (removed.length > 0) {
              showTransientToast(t.unavailableRemoved.replace("{count}", String(removed.length)));
            }
          }}
          onRemoveUnavailableAndSubmit={removeUnavailableAndSubmit}
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
          onAddSuggestCase={(sku) => {
            adjustCatalogQty(sku, 1);
            showTransientToast(`+1 ${sku}`);
          }}
          onAddAllSuggest={() => {
            for (const line of postSubmitSuggestLines) {
              adjustCatalogQty(line.sku, 1);
            }
            if (postSubmitSuggestLines.length > 0) {
              showTransientToast(
                lang === "zh"
                  ? `已加入 ${postSubmitSuggestLines.length} 个促销商品`
                  : `Added ${postSubmitSuggestLines.length} promo item${postSubmitSuggestLines.length === 1 ? "" : "s"}`
              );
            }
          }}
          onBrowseWeeklyPicks={() => {
            setLastSubmittedRef("");
            setLastSubmittedItems([]);
            setMode("promotion");
            try {
              localStorage.setItem("order_mode", "promotion");
            } catch {
              /* ignore */
            }
          }}
        />
    </main>
  );
}


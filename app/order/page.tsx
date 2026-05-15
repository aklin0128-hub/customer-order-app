"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import catalogData from "@/data/catalog_sku_master_extracted.json";

type Lang = "en" | "zh" | "ko";
type OrderMode = "search" | "catalog";

type CartItem = {
  sku: string;
  qty: string;
};

type CatalogItem = {
  sku: string;
  name?: string;
  brand?: string;
  status?: string;
  barcode?: string;
  upc?: string;
  size?: string;
  limitedQty?: string;
  palletSize?: string;
  imageUrl?: string;
};

type OrderHistoryItem = {
  accountNo: string;
  storeName: string;
  orderRef: string;
  items: CartItem[];
  note?: string;
  phone?: string;
  createdAt: string;
};

let catalog = catalogData as CatalogItem[];

const quickQtyButtons = ["1", "2", "3", "4", "5", "10", "15", "20"];

const copy = {
  en: {
    title: "Customer Order",
    logout: "Logout",
    customerInfo: "Customer Info",
    show: "Show",
    hide: "Hide",
    phone: "Phone (Optional)",
    note: "Note (Optional)",
    searchMode: "Search Order",
    catalogMode: "Catalog Order",
    addItems: "Add Items",
    availableOnly: "Show available items only",
    skuItem: "SKU / Item",
    qty: "Qty",
    addItem: "Add Item",
    catalogSearch: "Search all orderable items...",
    recent: "Recently Ordered",
    history: "Order History",
    reorder: "Reorder",
    orderCart: "Order Cart",
    noItems: "No items added yet.",
    clearAll: "Clear All",
    clearOrder: "Clear Order",
    remove: "Remove",
    downloadCsv: "Download CSV",
    uploadCsv: "Upload CSV",
    submitOrder: "Submit Order",
    submitting: "Submitting...",
    unavailable: "This item is currently unavailable",
    enterSku: "Please enter SKU.",
    duplicate: "is already in cart.\n\nDo you want to add it again?",
    clearConfirm: "Please confirm clear current order.",
    cleared: "Current order cleared.",
    addAtLeast: "Please add at least one item.",
    submitConfirm: "Submit this order?",
    accountNo: "Account",
    storeName: "Store",
    items: "Items",
    ref: "Ref",
    loadedDraft: "Last saved draft loaded.",
    csvEmpty: "CSV is empty.",
    noValidRows: "No valid orderable SKU/Qty rows found.",
    orderSuccess: "Order submitted successfully.",
    failedSubmit: "Failed to submit order.",
    size: "Size",
    limited: "Limited",
    pallet: "Pallet",
    selected: "Selected",
    allOrderable: "All Orderable Items",
  },
  zh: {
    title: "客户订单",
    logout: "登出",
    customerInfo: "客户信息",
    show: "展开",
    hide: "收起",
    phone: "电话（可选）",
    note: "备注（可选）",
    searchMode: "搜索下单",
    catalogMode: "商品目录下单",
    addItems: "添加商品",
    availableOnly: "只显示可下单商品",
    skuItem: "SKU / 商品",
    qty: "数量",
    addItem: "添加",
    catalogSearch: "搜索全部可下单商品...",
    recent: "最近常订",
    history: "订单历史",
    reorder: "再次下单",
    orderCart: "订单购物车",
    noItems: "还没有添加商品。",
    clearAll: "清空",
    clearOrder: "清空订单",
    remove: "删除",
    downloadCsv: "下载 CSV",
    uploadCsv: "上传 CSV",
    submitOrder: "提交订单",
    submitting: "提交中...",
    unavailable: "此商品目前无法下单",
    enterSku: "请输入 SKU。",
    duplicate: "已经在购物车里。\n\n是否还要再添加一次？",
    clearConfirm: "请确认是否清空当前订单？",
    cleared: "当前订单已清空。",
    addAtLeast: "请至少添加一个商品。",
    submitConfirm: "确定提交这个订单吗？",
    accountNo: "客户账号",
    storeName: "店名",
    items: "商品数",
    ref: "编号",
    loadedDraft: "已载入上次保存的草稿。",
    csvEmpty: "CSV 是空的。",
    noValidRows: "没有找到可下单的有效 SKU/Qty。",
    orderSuccess: "订单提交成功。",
    failedSubmit: "订单提交失败。",
    size: "规格",
    limited: "限量",
    pallet: "板数",
    selected: "已选",
    allOrderable: "全部可下单商品",
  },
  ko: {
    title: "고객 주문",
    logout: "로그아웃",
    customerInfo: "고객 정보",
    show: "보기",
    hide: "숨기기",
    phone: "전화번호 (선택)",
    note: "메모 (선택)",
    searchMode: "검색 주문",
    catalogMode: "카탈로그 주문",
    addItems: "상품 추가",
    availableOnly: "주문 가능 상품만 보기",
    skuItem: "SKU / 상품",
    qty: "수량",
    addItem: "추가",
    catalogSearch: "주문 가능 상품 검색...",
    recent: "최근 주문 상품",
    history: "주문 내역",
    reorder: "다시 주문",
    orderCart: "주문 카트",
    noItems: "아직 추가된 상품이 없습니다.",
    clearAll: "전체 삭제",
    clearOrder: "주문 삭제",
    remove: "삭제",
    downloadCsv: "CSV 다운로드",
    uploadCsv: "CSV 업로드",
    submitOrder: "주문 제출",
    submitting: "제출 중...",
    unavailable: "현재 주문할 수 없는 상품입니다",
    enterSku: "SKU를 입력해 주세요.",
    duplicate: "이미 카트에 있습니다.\n\n다시 추가하시겠습니까?",
    clearConfirm: "현재 주문을 모두 삭제하시겠습니까?",
    cleared: "현재 주문이 삭제되었습니다.",
    addAtLeast: "상품을 최소 1개 추가해 주세요.",
    submitConfirm: "이 주문을 제출하시겠습니까?",
    accountNo: "거래처 번호",
    storeName: "매장명",
    items: "상품 수",
    ref: "주문번호",
    loadedDraft: "마지막 저장된 주문을 불러왔습니다.",
    csvEmpty: "CSV가 비어 있습니다.",
    noValidRows: "주문 가능한 유효한 SKU/Qty 행이 없습니다.",
    orderSuccess: "주문이 성공적으로 제출되었습니다.",
    failedSubmit: "주문 제출 실패.",
    size: "규격",
    limited: "한정",
    pallet: "팔레트",
    selected: "선택됨",
    allOrderable: "전체 주문 가능 상품",
  },
};

function getImageUrl(sku?: string) {
  if (!sku) return "";
  return `/product/${sku}.jpg`;
}

function isNormalItem(item?: CatalogItem | null) {
  const s = String(item?.status || "").trim().toUpperCase();
  return s === "NORMAL" || s === "NORMAL_NOBR" || s === "NORMAL_NBR" || s === "TBD" || s === "LIMITED";
}

function getDisplayStatus(status?: string) {
  const s = String(status || "").trim().toUpperCase();
  if (!s || s === "INV") return "";
  return s;
}

function getCatalogItemBySku(sku: string) {
  return catalog.find((item) => item.sku?.toUpperCase() === sku.toUpperCase());
}

function generateOrderRef(accountNo: string) {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  return `${accountNo}-${mm}${dd}-${hh}${min}`;
}

function getStatusBadgeStyle(status?: string): React.CSSProperties {
  const value = String(status || "").trim().toUpperCase();

  if (value === "NORMAL" || value === "NORMAL_NOBR" || value === "NORMAL_NBR" || value === "TBD") {
    return { background: "#ecfdf5", color: "#059669", border: "1px solid #a7f3d0" };
  }

  if (value === "LIMITED") {
    return { background: "#fff7ed", color: "#c2410c", border: "1px solid #fed7aa" };
  }

  return { background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" };
}

function ProductImage({ sku, alt, size = 56, imageUrl }: { sku?: string; alt: string; size?: number; imageUrl?: string }) {
  const [imgError, setImgError] = useState(false);
  const src = imageUrl || getImageUrl(sku);

  if (!sku || imgError) {
    return (
      <div style={{ width: size, height: size, borderRadius: 10, background: "#f3f4f6", border: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
        No Image
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      style={{ width: size, height: size, objectFit: "contain", borderRadius: 10, background: "#fff", border: "1px solid #e5e7eb", flexShrink: 0, transition: "all 0.22s ease", cursor: "zoom-in", transformOrigin: "center center", position: "relative", zIndex: 1 }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "scale(3)";
        e.currentTarget.style.background = "#fff";
        e.currentTarget.style.border = "2px solid #2563eb";
        e.currentTarget.style.boxShadow = "0 12px 28px rgba(0,0,0,0.25)";
        e.currentTarget.style.zIndex = "9999";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "scale(1)";
        e.currentTarget.style.border = "1px solid #e5e7eb";
        e.currentTarget.style.boxShadow = "none";
        e.currentTarget.style.zIndex = "1";
      }}
      onError={() => setImgError(true)}
    />
  );
}

export default function OrderPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const skuInputRef = useRef<HTMLInputElement | null>(null);
  const submitLockRef = useRef(false);

  const [lang, setLang] = useState<Lang>("en");
  const [mode, setMode] = useState<OrderMode>("search");
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
  const [recentItems, setRecentItems] = useState<CartItem[]>([]);
  const [orderHistory, setOrderHistory] = useState<OrderHistoryItem[]>([]);
  const [catalogVersion, setCatalogVersion] = useState(0);

  const t = copy[lang];

  useEffect(() => {
    const loadCatalog = async () => {
      try {
        const res = await fetch("/api/catalog", { cache: "no-store" });
        const data = await res.json();
        if (res.ok && Array.isArray(data.products)) {
          catalog = data.products;
          setCatalogVersion((v) => v + 1);
        }
      } catch {}
    };
    loadCatalog();
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("lang") as Lang | null;
    if (saved === "en" || saved === "zh" || saved === "ko") setLang(saved);

    const savedMode = localStorage.getItem("order_mode") as OrderMode | null;
    if (savedMode === "search" || savedMode === "catalog") setMode(savedMode);
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
      setTimeout(() => skuInputRef.current?.focus(), 250);
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
          body: JSON.stringify({ accountNo, phone: phone.trim(), note: note.trim(), cart, catalogQtyMap }),
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

  const orderableCatalogItems = useMemo(() => {
    const q = catalogSearch.trim().toUpperCase();

    return catalog
      .filter((item) => isNormalItem(item))
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
  }, [catalogSearch, catalogVersion]);

  const catalogItemsForSubmit = useMemo(() => {
    return Object.entries(catalogQtyMap)
      .map(([sku, qty]) => ({ sku: sku.toUpperCase(), qty: String(qty || "").trim() }))
      .filter((item) => item.qty && Number(item.qty) > 0)
      .filter((item) => {
        const catalogItem = getCatalogItemBySku(item.sku);
        return !catalogItem || isNormalItem(catalogItem);
      });
  }, [catalogQtyMap, catalogVersion]);

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

    setCart((prev) => [...prev, { sku: finalSku, qty: finalQty }]);
    syncCatalogQty(finalSku, finalQty);

    setSkuInput("");
    setQtyInput("");
    setSelectedItem(null);
    setTimeout(() => skuInputRef.current?.focus(), 50);
  };

  const addItem = () => {
    const typedSku = skuInput.trim().toUpperCase();
    const exactMatch = catalog.find((item) => item.sku?.toUpperCase() === typedSku) || null;
    const finalItem = exactMatch || selectedItem;
    const finalSku = finalItem?.sku || typedSku;
    const qty = qtyInput.trim().toUpperCase() || "1";

    if (!finalSku) {
      alert(t.enterSku);
      return;
    }

    addSkuToCart(finalSku, qty);
  };

  const syncCartFromCatalogQty = (sku: string, qty: string) => {
    const cleanSku = sku.trim().toUpperCase();
    const cleanQty = String(qty || "").replace(/[^0-9]/g, "");

    setCart((prev) => {
      const withoutSku = prev.filter((item) => item.sku.toUpperCase() !== cleanSku);
      if (!cleanQty || Number(cleanQty) <= 0) return withoutSku;
      return [...withoutSku, { sku: cleanSku, qty: String(Number(cleanQty)) }];
    });
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

    setCatalogQtyMap((prev) => {
      const next = { ...prev };
      if (!clean || Number(clean) <= 0) delete next[cleanSku];
      else next[cleanSku] = String(Number(clean));
      return next;
    });

    syncCartFromCatalogQty(cleanSku, clean);
  };

  const adjustCatalogQty = (sku: string, delta: number) => {
    const current = Number(catalogQtyMap[sku.toUpperCase()] || 0);
    const next = Math.max(0, current + delta);
    updateCatalogQty(sku, next ? String(next) : "");
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
    setTimeout(() => skuInputRef.current?.focus(), 50);
  };

  const removeItem = (index: number) => setCart((prev) => prev.filter((_, i) => i !== index));
  const updateCartQty = (index: number, qty: string) => setCart((prev) => prev.map((item, i) => (i === index ? { ...item, qty } : item)));

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

    setTimeout(() => skuInputRef.current?.focus(), 50);
  };

  const getCurrentSubmitItems = () => {
    if (mode === "catalog") return catalogItemsForSubmit;
    return cart.filter((item) => item.sku && item.qty);
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

      if (mode === "catalog") setCatalogQtyMap(parsedMap);
      else setCart(parsed);
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
            {(["en", "zh", "ko"] as Lang[]).map((item) => (
              <button key={item} type="button" onClick={() => changeLang(item)} style={langButtonStyle(lang === item)}>
                {item === "en" ? "EN" : item === "zh" ? "中文" : "한국어"}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 21, fontWeight: 800, color: "#111827", lineHeight: 1.15 }}>{t.title}</div>
              <div style={{ marginTop: 4, fontSize: 12, color: "#6b7280" }}>{accountNo} | {storeName}</div>
            </div>
            <button type="button" onClick={logout} style={smallButtonStyle}>{t.logout}</button>
          </div>
        </section>

        <section style={cardStyle}>
          <button type="button" onClick={() => setShowCustomerInfo((prev) => !prev)} style={sectionToggleStyle}>
            <div style={sectionTitleStyle}>{t.customerInfo}</div>
            <div style={toggleTextStyle}>{showCustomerInfo ? t.hide : t.show}</div>
          </button>

          {showCustomerInfo ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
              <Input label={t.phone} value={phone} onChange={setPhone} placeholder="" />
              <Input label={t.note} value={note} onChange={setNote} placeholder="" />
            </div>
          ) : null}
        </section>

        {recentItems.length > 0 && mode === "search" ? (
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

        <section style={cardStyle}>
          <div style={modeTabsStyle}>
            <button type="button" onClick={() => changeMode("search")} style={modeButtonStyle(mode === "search")}>{t.searchMode}</button>
            <button type="button" onClick={() => changeMode("catalog")} style={modeButtonStyle(mode === "catalog")}>{t.catalogMode}</button>
          </div>
        </section>

        {mode === "search" ? (
          <section style={cardStyle}>
            <div style={{ ...sectionTitleStyle, textAlign: "center", marginBottom: 10 }}>{t.addItems}</div>

            <label style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontSize: 12, fontWeight: 800, color: "#374151", marginBottom: 10 }}>
              <input type="checkbox" checked={showAvailableOnly} onChange={(e) => setShowAvailableOnly(e.target.checked)} />
              {t.availableOnly}
            </label>

            <Input label={t.skuItem} value={skuInput} onChange={(v) => setSkuInput(v.toUpperCase())} placeholder="00002D" inputRef={skuInputRef} onEnter={addItem} />

            {matchedItems.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10, overflow: "visible" }}>
                {matchedItems.map((item, index) => {
                  const isActive = selectedItem?.sku === item.sku || (!selectedItem && index === 0);
                  return (
                    <button key={item.sku} type="button" onClick={() => { setSelectedItem(item); setSkuInput(item.sku); setQtyInput(""); }} style={{ width: "100%", border: isActive ? "2px solid #93c5fd" : "1px solid #e5e7eb", background: isActive ? "#eff6ff" : "#ffffff", borderRadius: 12, padding: 10, textAlign: "left", cursor: "pointer", overflow: "visible", position: "relative" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "56px 1fr", gap: 10, alignItems: "start", overflow: "visible", position: "relative" }}>
                        <ProductImage sku={item.sku} alt={item.name || item.sku} size={56} imageUrl={item.imageUrl} />
                        <div style={{ overflow: "visible" }}>
                          <div style={{ fontSize: 14, fontWeight: 800, color: "#111827" }}>{item.sku}{item.brand ? ` | ${item.brand}` : ""}</div>
                          <div style={{ fontSize: 12, color: "#374151", marginTop: 3, lineHeight: 1.4 }}>{item.name || "-"}</div>
                          {renderProductMeta(item)}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : null}

            <div style={{ marginTop: 10 }}><Input label={t.qty} value={qtyInput} onChange={setQtyInput} placeholder="2" onEnter={addItem} /></div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8, marginTop: 10 }}>
              {quickQtyButtons.map((qty) => <button key={qty} type="button" onClick={() => setQtyInput(qty)} style={qtyButtonStyle}>{qty}</button>)}
            </div>

            <div style={{ display: "flex", justifyContent: "center", marginTop: 10 }}>
              <button type="button" onClick={addItem} style={primarySmallButtonStyle}>{t.addItem}</button>
            </div>
          </section>
        ) : (
          <section style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div>
                <div style={sectionTitleStyle}>{t.allOrderable}</div>
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{t.selected}: {catalogItemsForSubmit.length}</div>
              </div>
              
            </div>

            <input value={catalogSearch} onChange={(e) => setCatalogSearch(e.target.value)} placeholder={t.catalogSearch} style={{ ...wideInputStyle, marginBottom: 12 }} />

            <div style={catalogListStyle}>
              {orderableCatalogItems.map((item) => {
                const sku = item.sku?.toUpperCase() || "";
                const qty = catalogQtyMap[sku] || "";
                return (
                  <div
                    key={item.sku}
                    style={{
                      ...catalogCardStyle,
                      background: qty ? "#ecfdf5" : "#ffffff",
                      border: qty ? "2px solid #86efac" : "1px solid #e5e7eb",
                    }}
                  >
                    <div style={{ minHeight: 62 }}>
                      <div style={{ fontSize: 11, fontWeight: 900, color: "#111827", lineHeight: 1.2 }}>{item.sku}</div>
                      <div style={{ fontSize: 10, fontWeight: 800, color: "#374151", marginTop: 2, lineHeight: 1.2 }}>{item.brand || "-"}</div>
                      <div style={{ fontSize: 10, color: "#4b5563", marginTop: 2, lineHeight: 1.2, height: 24, overflow: "hidden" }}>{item.name || "-"}</div>
                    </div>

                    <div style={{ display: "flex", justifyContent: "center", overflow: "visible", padding: "4px 0" }}>
                      <ProductImage sku={item.sku} alt={item.name || item.sku} size={100} imageUrl={item.imageUrl} />
                    </div>

                    <div style={stepperStyle}>
                      <button type="button" onClick={() => adjustCatalogQty(item.sku, -1)} style={stepButtonStyle}>−</button>
                      <input value={qty} onChange={(e) => updateCatalogQty(item.sku, e.target.value)} placeholder="0" inputMode="numeric" style={stepInputStyle} />
                      <button type="button" onClick={() => adjustCatalogQty(item.sku, 1)} style={stepButtonStyle}>+</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {mode === "search" ? (
          <section style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={sectionTitleStyle}>{t.orderCart} ({cart.length})</div>
              
            </div>

            {cart.length === 0 ? <div style={emptyStyle}>{t.noItems}</div> : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, overflow: "visible" }}>
                {cart.map((item, index) => {
                  const catalogItem = getCatalogItemBySku(item.sku);
                  return (
                    <div key={`${item.sku}-${index}`} style={cartItemStyle}>
                      <div style={{ display: "flex", gap: 10, alignItems: "center", minWidth: 0, flex: 1, overflow: "visible" }}>
                        <ProductImage sku={item.sku} alt={item.sku} size={48} imageUrl={catalogItem?.imageUrl} />
                        <div style={{ minWidth: 0, flex: 1, overflow: "visible" }}>
                          <div style={{ fontSize: 15, fontWeight: 800, color: "#111827" }}>{item.sku}</div>
                          {catalogItem ? <div style={{ fontSize: 12, color: "#4b5563", marginTop: 2, lineHeight: 1.35 }}>{catalogItem.brand ? `${catalogItem.brand} | ` : ""}{catalogItem.name || ""}</div> : null}
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
                            <span style={{ fontSize: 12, fontWeight: 800, color: "#4b5563" }}>{t.qty}:</span>
                            <input value={item.qty} onChange={(e) => updateCartQty(index, e.target.value)} style={cartQtyInputStyle} />
                          </div>
                        </div>
                      </div>
                      <button type="button" onClick={() => removeItem(index)} style={dangerSmallButtonStyle}>{t.remove}</button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        ) : null}

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
          <div style={{ display: "grid", gridTemplateColumns: "0.8fr 1.2fr", gap: 8 }}>
            <button type="button" onClick={openReview} disabled={submitting} style={secondaryButtonStyle}>
              Cart ({getCurrentSubmitItems().length})
            </button>
            <button type="button" onClick={openReview} disabled={submitting} style={{ ...submitButtonStyle, background: submitting ? "#93c5fd" : "#16a34a" }}>
              {submitting ? t.submitting : `${t.submitOrder} (${getCurrentSubmitItems().length})`}
            </button>
          </div>
        </div>

        {showReview ? (
          <div style={reviewOverlayStyle}>
            <div style={reviewModalStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: "#111827" }}>Review Order</div>
                  <div style={{ fontSize: 12, color: "#6b7280", marginTop: 3 }}>{accountNo} | {storeName} | {getCurrentSubmitItems().length} {t.items}</div>
                </div>
                <button type="button" onClick={() => setShowReview(false)} style={dangerSmallButtonStyle}>Close</button>
              </div>

              <div style={reviewListStyle}>
                {getCurrentSubmitItems().map((item, index) => {
                  const catalogItem = getCatalogItemBySku(item.sku);
                  return (
                    <div key={`${item.sku}-${index}`} style={reviewItemStyle}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", minWidth: 0 }}>
                        <ProductImage sku={item.sku} alt={item.sku} size={42} imageUrl={catalogItem?.imageUrl} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 900, color: "#111827" }}>{item.sku}</div>
                          <div style={{ fontSize: 12, color: "#4b5563", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 520 }}>
                            {catalogItem?.brand ? `${catalogItem.brand} | ` : ""}{catalogItem?.name || "-"}
                          </div>
                        </div>
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 900, color: "#16a34a" }}>Qty: {item.qty}</div>
                    </div>
                  );
                })}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
                <button type="button" onClick={() => setShowReview(false)} style={secondaryButtonStyle}>Back</button>
                <button type="button" onClick={submitOrder} disabled={submitting} style={{ ...submitButtonStyle, background: submitting ? "#93c5fd" : "#16a34a" }}>
                  {submitting ? t.submitting : "Confirm Submit"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {lastSubmittedRef ? (
          <div style={reviewOverlayStyle}>
            <div style={reviewModalStyle}>
              <div style={{ fontSize: 22, fontWeight: 900, color: "#16a34a", textAlign: "center" }}>Order Submitted</div>
              <div style={{ fontSize: 14, color: "#374151", textAlign: "center", marginTop: 6 }}>{t.ref}: {lastSubmittedRef}</div>
              <div style={{ fontSize: 13, color: "#6b7280", textAlign: "center", marginTop: 4 }}>{lastSubmittedItems.length} {t.items}</div>

              <div style={{ ...reviewListStyle, marginTop: 12 }}>
                {lastSubmittedItems.map((item, index) => {
                  const catalogItem = getCatalogItemBySku(item.sku);
                  return (
                    <div key={`${item.sku}-${index}`} style={reviewItemStyle}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 900 }}>{item.sku}</div>
                        <div style={{ fontSize: 12, color: "#6b7280" }}>{catalogItem?.brand ? `${catalogItem.brand} | ` : ""}{catalogItem?.name || "-"}</div>
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 900, color: "#16a34a" }}>Qty: {item.qty}</div>
                    </div>
                  );
                })}
              </div>

              <button type="button" onClick={() => setLastSubmittedRef("")} style={{ ...submitButtonStyle, background: "#2563eb", marginTop: 12 }}>
                Done
              </button>
            </div>
          </div>
        ) : null}

        {orderHistory.length > 0 ? (
          <section style={cardStyle}>
            <button type="button" onClick={() => setShowHistory((prev) => !prev)} style={sectionToggleStyle}>
              <div style={sectionTitleStyle}>{t.history}</div>
              <div style={toggleTextStyle}>{showHistory ? t.hide : t.show}</div>
            </button>

            {showHistory ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10, overflow: "visible" }}>
                {orderHistory.slice(0, 8).map((order) => (
                  <div key={order.orderRef || order.createdAt} style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 10, background: "#f9fafb", overflow: "visible" }}>
                    <div style={{ fontSize: 13, fontWeight: 900, color: "#111827" }}>{order.orderRef || "-"}</div>
                    <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{order.createdAt ? new Date(order.createdAt).toLocaleString() : ""} · {order.items?.length || 0} {t.items}</div>
                    <div style={{ fontSize: 12, color: "#374151", marginTop: 6 }}>{(order.items || []).slice(0, 5).map((item) => `${item.sku}(${item.qty})`).join(", ")}{(order.items || []).length > 5 ? "..." : ""}</div>
                    <button type="button" onClick={() => reorderItems(order.items || [])} style={{ ...secondaryButtonStyle, marginTop: 8, padding: "8px 10px" }}>{t.reorder}</button>
                  </div>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </main>
  );
}

function Input({ label, value, onChange, placeholder, inputRef, onEnter }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; inputRef?: React.RefObject<HTMLInputElement | null>; onEnter?: () => void }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6, textAlign: "center" }}>{label}</label>
      <div style={{ display: "flex", justifyContent: "center" }}>
        <input ref={inputRef} value={value} onChange={(e) => onChange(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && onEnter) { e.preventDefault(); onEnter(); } }} placeholder={placeholder} style={{ width: "70%", minWidth: 220, maxWidth: 320, padding: "10px 12px", borderRadius: 10, border: "1px solid #d1d5db", fontSize: 15, background: "#ffffff", outline: "none", boxSizing: "border-box", textAlign: "center" }} />
      </div>
    </div>
  );
}

const mainStyle: React.CSSProperties = { minHeight: "100vh", background: "#f8fafc", padding: "14px 10px 24px", fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', overflow: "visible" };
const containerStyle: React.CSSProperties = { width: "100%", maxWidth: 980, margin: "0 auto", display: "flex", flexDirection: "column", gap: 12, overflow: "visible" };
const cardStyle: React.CSSProperties = { background: "#ffffff", borderRadius: 14, padding: 14, border: "1px solid #e5e7eb", boxShadow: "0 1px 2px rgba(0,0,0,0.04)", overflow: "visible" };
const sectionTitleStyle: React.CSSProperties = { fontSize: 17, fontWeight: 800, color: "#111827" };
const sectionToggleStyle: React.CSSProperties = { width: "100%", border: "none", background: "transparent", padding: 0, display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" };
const toggleTextStyle: React.CSSProperties = { fontSize: 13, fontWeight: 800, color: "#2563eb" };
const smallButtonStyle: React.CSSProperties = { border: "1px solid #d1d5db", background: "#ffffff", borderRadius: 10, padding: "7px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer" };
const dangerSmallButtonStyle: React.CSSProperties = { border: "1px solid #fecaca", background: "#ffffff", color: "#dc2626", borderRadius: 10, padding: "7px 9px", fontSize: 12, fontWeight: 700, cursor: "pointer", flexShrink: 0 };
const langButtonStyle = (active: boolean): React.CSSProperties => ({ border: active ? "1px solid #2563eb" : "1px solid #d1d5db", background: active ? "#eff6ff" : "#ffffff", color: active ? "#2563eb" : "#374151", borderRadius: 999, padding: "6px 10px", fontSize: 12, fontWeight: 800, cursor: "pointer" });
const modeTabsStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 };
const modeButtonStyle = (active: boolean): React.CSSProperties => ({ padding: "10px 8px", borderRadius: 12, border: active ? "1px solid #2563eb" : "1px solid #d1d5db", background: active ? "#eff6ff" : "#ffffff", color: active ? "#1d4ed8" : "#374151", fontSize: 13, fontWeight: 900, cursor: "pointer" });
const qtyButtonStyle: React.CSSProperties = { padding: "6px 0", borderRadius: 10, border: "1px solid #d1d5db", background: "#f9fafb", fontWeight: 700, fontSize: 13, cursor: "pointer" };
const primarySmallButtonStyle: React.CSSProperties = { width: "35%", minWidth: 110, maxWidth: 150, padding: "8px 0", borderRadius: 10, border: "none", background: "#2563eb", color: "#ffffff", fontSize: 14, fontWeight: 800, cursor: "pointer" };
const secondaryButtonStyle: React.CSSProperties = { width: "100%", padding: "11px 16px", borderRadius: 12, border: "1px solid #d1d5db", background: "#ffffff", color: "#111827", fontSize: 14, fontWeight: 800, cursor: "pointer" };
const dangerButtonStyle: React.CSSProperties = { width: "100%", padding: "11px 16px", borderRadius: 12, border: "1px solid #fecaca", background: "#fef2f2", color: "#b91c1c", fontSize: 14, fontWeight: 800, cursor: "pointer" };
const submitButtonStyle: React.CSSProperties = { width: "100%", padding: "13px 16px", borderRadius: 12, border: "none", color: "#ffffff", fontSize: 15, fontWeight: 800, cursor: "pointer" };
const emptyStyle: React.CSSProperties = { padding: "14px 12px", borderRadius: 12, background: "#f9fafb", color: "#6b7280", fontSize: 14, textAlign: "center" };
const cartItemStyle: React.CSSProperties = { border: "1px solid #e5e7eb", borderRadius: 12, padding: 10, background: "#f9fafb", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, overflow: "visible" };
const cartQtyInputStyle: React.CSSProperties = { width: 92, padding: "6px 8px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, fontWeight: 700, background: "#ffffff", outline: "none" };
const productSmallButtonStyle: React.CSSProperties = { width: "100%", border: "1px solid #e5e7eb", background: "#ffffff", borderRadius: 12, padding: 10, textAlign: "left", cursor: "pointer", display: "flex", gap: 10, alignItems: "center", overflow: "visible", position: "relative" };
const wideInputStyle: React.CSSProperties = { width: "100%", padding: "11px 12px", borderRadius: 12, border: "1px solid #d1d5db", fontSize: 14, boxSizing: "border-box", outline: "none", background: "#ffffff" };
const catalogListStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", columnGap: 12, rowGap: 12, overflow: "visible" };
const catalogCardStyle: React.CSSProperties = { border: "1px solid #e5e7eb", borderRadius: 14, background: "#ffffff", padding: 8, display: "flex", flexDirection: "column", gap: 6, overflow: "visible", position: "relative", minWidth: 0 };
const stepperStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "30px 1fr 30px", gap: 5, alignItems: "center" };
const stepButtonStyle: React.CSSProperties = { width: 30, height: 32, borderRadius: 10, border: "1px solid #d1d5db", background: "#f9fafb", fontSize: 18, fontWeight: 900, cursor: "pointer", lineHeight: 1 };
const stepInputStyle: React.CSSProperties = { width: "100%", height: 32, borderRadius: 10, border: "1px solid #d1d5db", textAlign: "center", fontSize: 14, fontWeight: 900, outline: "none", boxSizing: "border-box" };
const limitedBadgeStyle: React.CSSProperties = { padding: "2px 7px", borderRadius: 999, fontSize: 10, fontWeight: 800, background: "#fff7ed", color: "#c2410c", border: "1px solid #fed7aa" };
const fixedSubmitBarStyle: React.CSSProperties = { position: "fixed", left: "50%", bottom: 14, transform: "translateX(-50%)", width: "calc(100% - 24px)", maxWidth: 980, background: "rgba(255,255,255,0.96)", border: "1px solid #d1d5db", borderRadius: 16, padding: 10, boxShadow: "0 12px 32px rgba(0,0,0,0.18)", zIndex: 8000 };
const reviewOverlayStyle: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(17,24,39,0.48)", display: "flex", alignItems: "center", justifyContent: "center", padding: 14, zIndex: 9000 };
const reviewModalStyle: React.CSSProperties = { width: "100%", maxWidth: 760, maxHeight: "82vh", background: "#ffffff", borderRadius: 18, border: "1px solid #e5e7eb", padding: 16, boxShadow: "0 24px 60px rgba(0,0,0,0.28)", overflow: "hidden", display: "flex", flexDirection: "column" };
const reviewListStyle: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 8, overflowY: "auto", paddingRight: 4 };
const reviewItemStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, border: "1px solid #e5e7eb", borderRadius: 12, background: "#f9fafb", padding: 10 };

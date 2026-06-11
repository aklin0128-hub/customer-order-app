"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  displayCatalogStatus,
  filterCatalogBrowseItems,
  mapProductsToCatalogBrowse,
  type CatalogBrowseItem,
} from "@/lib/catalogBrowse";

import "./catalog.css";

type Lang = "en" | "zh" | "ko" | "vi";

const LANG_KEY = "catalog_lang";

const copy = {
  en: {
    brand: "Store Portal",
    title: "SKU catalog",
    subtitle: "Product reference sorted by SKU number. Sign in to place orders.",
    searchPlaceholder: "Search SKU, name, brand, UPC…",
    signIn: "Sign in to order",
    newItems: "New items",
    showing: "Showing",
    of: "of",
    skus: "SKUs",
    loading: "Loading catalog…",
    loadError: "Could not load catalog. Please refresh.",
    emptySearch: "No SKUs match your search.",
    colSku: "SKU",
    colBrand: "Brand",
    colName: "Name",
    colSize: "Size",
    colUpc: "UPC",
    colCategory: "Category",
    colStatus: "Status",
    colPallet: "Pallet",
    sortedBy: "Sorted by SKU (A→Z, numeric)",
  },
  zh: {
    brand: "门店订货",
    title: "SKU 目录",
    subtitle: "按 SKU 编号排序的产品信息。登录后可下单。",
    searchPlaceholder: "搜索 SKU、品名、品牌、条码…",
    signIn: "登录下单",
    newItems: "新品",
    showing: "显示",
    of: "/",
    skus: "个 SKU",
    loading: "正在加载目录…",
    loadError: "无法加载目录，请刷新页面。",
    emptySearch: "没有匹配的 SKU。",
    colSku: "SKU",
    colBrand: "品牌",
    colName: "品名",
    colSize: "规格",
    colUpc: "条码",
    colCategory: "分类",
    colStatus: "状态",
    colPallet: "托盘",
    sortedBy: "按 SKU 编号排序",
  },
  ko: {
    brand: "매장 주문",
    title: "SKU 카탈로그",
    subtitle: "SKU 번호순 제품 정보. 로그인 후 주문할 수 있습니다.",
    searchPlaceholder: "SKU, 품명, 브랜드, 바코드 검색…",
    signIn: "로그인 후 주문",
    newItems: "신상품",
    showing: "표시",
    of: "/",
    skus: "개 SKU",
    loading: "카탈로그 불러오는 중…",
    loadError: "카탈로그를 불러올 수 없습니다. 새로고침하세요.",
    emptySearch: "일치하는 SKU가 없습니다.",
    colSku: "SKU",
    colBrand: "브랜드",
    colName: "품명",
    colSize: "규격",
    colUpc: "바코드",
    colCategory: "분류",
    colStatus: "상태",
    colPallet: "팔레트",
    sortedBy: "SKU 번호순 정렬",
  },
  vi: {
    brand: "Cửa hàng",
    title: "Danh mục SKU",
    subtitle: "Thông tin sản phẩm theo số SKU. Đăng nhập để đặt hàng.",
    searchPlaceholder: "Tìm SKU, tên, thương hiệu, mã vạch…",
    signIn: "Đăng nhập để đặt",
    newItems: "Hàng mới",
    showing: "Hiển thị",
    of: "/",
    skus: "SKU",
    loading: "Đang tải danh mục…",
    loadError: "Không tải được danh mục. Vui lòng tải lại.",
    emptySearch: "Không có SKU phù hợp.",
    colSku: "SKU",
    colBrand: "Thương hiệu",
    colName: "Tên",
    colSize: "Quy cách",
    colUpc: "Mã vạch",
    colCategory: "Loại",
    colStatus: "Trạng thái",
    colPallet: "Pallet",
    sortedBy: "Sắp xếp theo số SKU",
  },
};

const langLabels: Record<Lang, string> = {
  en: "EN",
  zh: "中文",
  ko: "한국어",
  vi: "VI",
};

const ROW_HEIGHT = 52;

function readLang(): Lang {
  if (typeof window === "undefined") return "en";
  const saved = localStorage.getItem(LANG_KEY);
  if (saved === "zh" || saved === "ko" || saved === "vi" || saved === "en") return saved;
  return "en";
}

function formatBrand(brand?: string) {
  if (!brand) return "—";
  return brand
    .toLowerCase()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function itemName(item: CatalogBrowseItem, lang: Lang) {
  if (lang === "ko" && item.name_k) return item.name_k;
  return item.name || "—";
}

function StatusPill({ status }: { status?: string }) {
  const label = displayCatalogStatus(status);
  if (!label) return <span className="catalog-status catalog-status--normal">OK</span>;
  const tone =
    label === "DISCONTINUED"
      ? "catalog-status--discontinued"
      : label === "LIMITED" || label === "NEW"
        ? "catalog-status--limited"
        : "catalog-status--other";
  return <span className={`catalog-status ${tone}`}>{label}</span>;
}

function CatalogThumb({ item }: { item: CatalogBrowseItem }) {
  const [error, setError] = useState(false);
  const src = item.imageUrl || `/product/${item.sku}.jpg`;

  if (error) {
    return <div className="catalog-thumb catalog-thumb--placeholder" aria-hidden />;
  }

  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      className="catalog-thumb"
      onError={() => setError(true)}
    />
  );
}

function CatalogRow({ item, lang }: { item: CatalogBrowseItem; lang: Lang }) {
  const upc = item.upc || item.barcode || "—";
  return (
    <div className="catalog-row">
      <div className="catalog-cell catalog-cell--sku">{item.sku}</div>
      <div className="catalog-cell catalog-cell--thumb">
        <CatalogThumb item={item} />
      </div>
      <div className="catalog-cell catalog-cell--brand" title={item.brand || ""}>
        {formatBrand(item.brand)}
      </div>
      <div className="catalog-cell catalog-cell--name" title={itemName(item, lang)}>
        {itemName(item, lang)}
      </div>
      <div className="catalog-cell catalog-cell--size">{item.size || "—"}</div>
      <div className="catalog-cell catalog-cell--upc">{upc}</div>
      <div className="catalog-cell catalog-cell--category">{item.category || "—"}</div>
      <div className="catalog-cell catalog-cell--status">
        <StatusPill status={item.status} />
      </div>
      <div className="catalog-cell catalog-cell--pallet">{item.palletSize || "—"}</div>
    </div>
  );
}

export default function CatalogBrowseClient() {
  const [lang, setLang] = useState<Lang>("en");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<CatalogBrowseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLang(readLang());
  }, []);

  useEffect(() => {
    localStorage.setItem(LANG_KEY, lang);
  }, [lang]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/catalog");
        const data = await res.json();
        if (!res.ok || !Array.isArray(data.products)) {
          throw new Error(data?.error || "Failed to load catalog");
        }
        if (!cancelled) {
          setItems(mapProductsToCatalogBrowse(data.products));
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load catalog");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const t = copy[lang];

  const filtered = useMemo(() => filterCatalogBrowseItems(items, query), [items, query]);

  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
  });

  const langButtons = useMemo(
    () =>
      (["en", "zh", "ko", "vi"] as Lang[]).map((code) => (
        <button
          key={code}
          type="button"
          className={`catalog-lang-btn${lang === code ? " is-active" : ""}`}
          onClick={() => setLang(code)}
        >
          {langLabels[code]}
        </button>
      )),
    [lang]
  );

  return (
    <div className="catalog-page">
      <header className="catalog-header">
        <div className="catalog-header-top">
          <div className="catalog-brand">
            <div className="catalog-logo">CO</div>
            <span className="catalog-brand-text">{t.brand}</span>
          </div>
          <div className="catalog-lang-row" role="group" aria-label="Language">
            {langButtons}
          </div>
        </div>

        <div className="catalog-hero">
          <h1 className="catalog-title">{t.title}</h1>
          <p className="catalog-subtitle">{t.subtitle}</p>
          <div className="catalog-hero-actions">
            <Link href="/" className="catalog-link-btn catalog-link-btn--primary">
              {t.signIn}
            </Link>
            <Link href="/new" className="catalog-link-btn">
              {t.newItems}
            </Link>
          </div>
        </div>

        <div className="catalog-toolbar">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value.toUpperCase())}
            placeholder={t.searchPlaceholder}
            className="catalog-search"
            autoCapitalize="characters"
            spellCheck={false}
          />
          <div className="catalog-toolbar-meta">
            {loading ? (
              <span>{t.loading}</span>
            ) : error ? (
              <span className="catalog-toolbar-error">{t.loadError}</span>
            ) : (
              <>
                <span>
                  {t.showing} <strong>{filtered.length.toLocaleString()}</strong> {t.of}{" "}
                  <strong>{items.length.toLocaleString()}</strong> {t.skus}
                </span>
                <span className="catalog-toolbar-sort">{t.sortedBy}</span>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="catalog-table-wrap">
        <div className="catalog-table-head" aria-hidden>
          <div className="catalog-row catalog-row--head">
            <div className="catalog-cell catalog-cell--sku">{t.colSku}</div>
            <div className="catalog-cell catalog-cell--thumb" />
            <div className="catalog-cell catalog-cell--brand">{t.colBrand}</div>
            <div className="catalog-cell catalog-cell--name">{t.colName}</div>
            <div className="catalog-cell catalog-cell--size">{t.colSize}</div>
            <div className="catalog-cell catalog-cell--upc">{t.colUpc}</div>
            <div className="catalog-cell catalog-cell--category">{t.colCategory}</div>
            <div className="catalog-cell catalog-cell--status">{t.colStatus}</div>
            <div className="catalog-cell catalog-cell--pallet">{t.colPallet}</div>
          </div>
        </div>

        <div ref={scrollRef} className="catalog-table-body">
          {loading ? (
            <div className="catalog-empty">{t.loading}</div>
          ) : error ? (
            <div className="catalog-empty catalog-empty--error">{t.loadError}</div>
          ) : filtered.length === 0 ? (
            <div className="catalog-empty">{t.emptySearch}</div>
          ) : (
            <div
              className="catalog-virtual-spacer"
              style={{ height: virtualizer.getTotalSize() }}
            >
              {virtualizer.getVirtualItems().map((vr) => {
                const item = filtered[vr.index];
                if (!item) return null;
                return (
                  <div
                    key={item.sku}
                    className="catalog-virtual-row"
                    style={{
                      transform: `translateY(${vr.start}px)`,
                      height: ROW_HEIGHT,
                    }}
                  >
                    <CatalogRow item={item} lang={lang} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

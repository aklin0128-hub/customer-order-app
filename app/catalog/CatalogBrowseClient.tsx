"use client";

import { useEffect, useMemo, useState } from "react";

import type { Lang } from "@/app/order/types";
import {
  filterCatalogBrowseItems,
  mapProductsToCatalogBrowse,
  type CatalogBrowseItem,
} from "@/lib/catalogBrowse";

import { CatalogBrowseGrid } from "./CatalogBrowseGrid";

import "../order/order.css";
import "./catalog.css";

const LANG_KEY = "catalog_lang";

const copy = {
  en: {
    brand: "Store Portal",
    title: "SKU catalog",
    subtitle: "All available products, sorted by SKU number.",
    searchPlaceholder: "Search SKU, name, brand, UPC…",
    showing: "Showing",
    of: "of",
    skus: "SKUs",
    loading: "Loading catalog…",
    loadError: "Could not load catalog. Please refresh.",
    emptySearch: "No SKUs match your search.",
    sortedBy: "Sorted by SKU (A→Z, numeric)",
    size: "Size",
    pallet: "Pallet",
    upc: "UPC",
    category: "Category",
  },
  zh: {
    brand: "门店订货",
    title: "SKU 目录",
    subtitle: "显示全部可订购商品，按 SKU 编号排序。",
    searchPlaceholder: "搜索 SKU、品名、品牌、条码…",
    showing: "显示",
    of: "/",
    skus: "个 SKU",
    loading: "正在加载目录…",
    loadError: "无法加载目录，请刷新页面。",
    emptySearch: "没有匹配的 SKU。",
    sortedBy: "按 SKU 编号排序",
    size: "规格",
    pallet: "托盘",
    upc: "条码",
    category: "分类",
  },
  ko: {
    brand: "매장 주문",
    title: "SKU 카탈로그",
    subtitle: "주문 가능 상품 전체를 SKU 번호순으로 표시합니다.",
    searchPlaceholder: "SKU, 품명, 브랜드, 바코드 검색…",
    showing: "표시",
    of: "/",
    skus: "개 SKU",
    loading: "카탈로그 불러오는 중…",
    loadError: "카탈로그를 불러올 수 없습니다. 새로고침하세요.",
    emptySearch: "일치하는 SKU가 없습니다.",
    sortedBy: "SKU 번호순 정렬",
    size: "규격",
    pallet: "팔레트",
    upc: "바코드",
    category: "분류",
  },
  vi: {
    brand: "Cửa hàng",
    title: "Danh mục SKU",
    subtitle: "Hiển thị tất cả SKU có thể đặt, sắp xếp theo số SKU.",
    searchPlaceholder: "Tìm SKU, tên, thương hiệu, mã vạch…",
    showing: "Hiển thị",
    of: "/",
    skus: "SKU",
    loading: "Đang tải danh mục…",
    loadError: "Không tải được danh mục. Vui lòng tải lại.",
    emptySearch: "Không có SKU phù hợp.",
    sortedBy: "Sắp xếp theo số SKU",
    size: "Quy cách",
    pallet: "Pallet",
    upc: "Mã vạch",
    category: "Loại",
  },
};

const langLabels: Record<Lang, string> = {
  en: "EN",
  zh: "中文",
  ko: "한국어",
  vi: "VI",
};

function readLang(): Lang {
  if (typeof window === "undefined") return "en";
  const saved = localStorage.getItem(LANG_KEY);
  if (saved === "zh" || saved === "ko" || saved === "vi" || saved === "en") return saved;
  return "en";
}

export default function CatalogBrowseClient() {
  const [lang, setLang] = useState<Lang>("en");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<CatalogBrowseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
          setItems(mapProductsToCatalogBrowse(data.products, { availableOnly: true }));
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

      <section className="catalog-grid-wrap order-shop-card">
        {loading ? (
          <div className="catalog-empty">{t.loading}</div>
        ) : error ? (
          <div className="catalog-empty catalog-empty--error">{t.loadError}</div>
        ) : filtered.length === 0 ? (
          <div className="catalog-empty">{t.emptySearch}</div>
        ) : (
          <CatalogBrowseGrid
            items={filtered}
            lang={lang}
            sizeLabel={t.size}
            palletLabel={t.pallet}
            upcLabel={t.upc}
            categoryLabel={t.category}
          />
        )}
      </section>
    </div>
  );
}

#!/usr/bin/env python3
from pathlib import Path

HEADER = '''"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { brandMatchesFilter, isKnownBrandFilter, splitBrandFilters } from "@/lib/catalogBrands";
import { CATEGORY_OPTIONS, inferCategory } from "@/lib/inferCategory";

import { CatalogVirtualGrid } from "./components/CatalogVirtualGrid";
import { CatalogQtyCard } from "./components/CatalogQtyCard";
import { OrderInput } from "./components/OrderInput";
import { ProductImage } from "./components/ProductImage";
import { replaceCatalog, catalog } from "./catalogState";
import {
  formatBrandLabel,
  formatPromoDetails,
  generateOrderRef,
  getCatalogItemBySku,
  getDisplayStatus,
  getStatusBadgeStyle,
  isNormalItem,
} from "./catalogUtils";
import { copy } from "./orderCopy";
import {
  brandSelectStyle,
  cardStyle,
  cartItemStyle,
  cartQtyInputStyle,
  cartSummaryTextStyle,
  categoryBarStyle,
  categoryButtonStyle,
  containerStyle,
  dangerButtonStyle,
  dangerSmallButtonStyle,
  emptyStyle,
  filterBlockStyle,
  filterLabelStyle,
  fixedSubmitBarStyle,
  langButtonStyle,
  limitedBadgeStyle,
  mainStyle,
  modeButtonStyle,
  modeTabsStyle,
  primarySmallButtonStyle,
  productSmallButtonStyle,
  promoGridStyle,
  promoModeButtonStyle,
  qtyButtonStyle,
  reviewItemStyle,
  reviewListStyle,
  reviewModalStyle,
  reviewOverlayStyle,
  reviewQtyButtonStyle,
  reviewQtyControlStyle,
  reviewQtyInputStyle,
  reviewRemoveButtonStyle,
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
import type { CartItem, CatalogItem, Lang, OrderHistoryItem, OrderMode, PromotionItem } from "./types";

const quickQtyButtons = ["1", "2", "3", "4", "5", "10", "15", "20"];

const categoryOptions = CATEGORY_OPTIONS;

'''

BRAND_JSX = '''              {(brandSplit.topBrands.length > 0 || brandSplit.moreBrands.length > 0) ? (
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
                    {brandSplit.topBrands.map((brand) => (
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
'''

GRID_BLOCK = '''            <CatalogVirtualGrid
              items={orderableCatalogItems}
              catalogQtyMap={catalogQtyMap}
              inCartLabel={t.inCart}
              promoBadgeLabel={t.promoBadge}
              onAdjust={adjustCatalogQty}
              onUpdateQty={updateCatalogQty}
            />
'''

SHOWING = '''            <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 10px" }}>
              {t.showing} {orderableCatalogItems.length} {t.catalogCount}
            </p>
'''

def main():
    root = Path(__file__).resolve().parents[1]
    path = root / "app" / "order" / "page.tsx"
    lines = path.read_text().splitlines(keepends=True)
    start = next(i for i, l in enumerate(lines) if l.startswith("export default function OrderPage"))
    end = next(i for i, l in enumerate(lines) if l.startswith("function Input("))
    middle = "".join(lines[start:end])

    middle = middle.replace("          catalog = data.products;", "          replaceCatalog(data.products);")

    middle = "".join(
        ln for ln in middle.splitlines(keepends=True) if "[catalogListLimit" not in ln and "catalogListLimit" not in ln
    )

    middle = middle.replace(
        """  const brandFilterOptions = useMemo(() => {
    return getAvailableFeaturedBrands(orderableBaseItems);
  }, [orderableBaseItems]);
""",
        """  const brandSplit = useMemo(
    () => splitBrandFilters(orderableBaseItems),
    [orderableBaseItems]
  );
""",
    )

    old_disp = """  const displayCatalogItems = useMemo(() => {
    const hasFilter =
      Boolean(catalogSearch.trim()) ||
      categoryFilter !== "ALL" ||
      brandFilter !== "ALL" ||
      catalogShowSelectedOnly;
    const cap = hasFilter ? 250 : catalogListLimit;
    return orderableCatalogItems.slice(0, cap);
  }, [orderableCatalogItems, catalogSearch, categoryFilter, brandFilter, catalogShowSelectedOnly, catalogListLimit]);

"""
    middle = middle.replace(old_disp, "")

    middle = middle.replace(
        """  useEffect(() => {
    if (brandFilter !== "ALL" && !brandFilterOptions.includes(brandFilter)) {
      setBrandFilter("ALL");
    }
  }, [brandFilter, brandFilterOptions]);
""",
        """  useEffect(() => {
    if (brandFilter !== "ALL" && !isKnownBrandFilter(brandSplit, brandFilter)) {
      setBrandFilter("ALL");
    }
  }, [brandFilter, brandSplit]);
""",
    )

    middle = middle.replace(
        """  useEffect(() => {
    setCatalogListLimit(80);
  }, [categoryFilter, brandFilter, catalogSearch, catalogShowSelectedOnly]);

""",
        "",
    )

    old_brand_jsx = """              {brandFilterOptions.length > 0 ? (
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
                    {brandFilterOptions.map((brand) => (
                      <button
                        key={brand}
                        type="button"
                        onClick={() => setBrandFilter(brand)}
                        style={categoryButtonStyle(brandFilter === brand)}
                      >
                        {formatBrandLabel(brand)}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
"""
    middle = middle.replace(old_brand_jsx, BRAND_JSX)

    old_tail = """            <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 10px" }}>
              {t.showing} {displayCatalogItems.length}
              {displayCatalogItems.length < orderableCatalogItems.length ? ` / ${orderableCatalogItems.length}` : ""}
            </p>

            <div style={catalogListStyle}>
              {displayCatalogItems.map((item) => {
                const sku = item.sku?.toUpperCase() || "";
                const qty = catalogQtyMap[sku] || "";
                return (
                  <CatalogQtyCard
                    key={item.sku}
                    item={item}
                    qty={qty}
                    inCartLabel={t.inCart}
                    promoBadgeLabel={t.promoBadge}
                    onAdjust={adjustCatalogQty}
                    onUpdateQty={updateCatalogQty}
                  />
                );
              })}
            </div>

            {displayCatalogItems.length < orderableCatalogItems.length &&
            !catalogSearch.trim() &&
            categoryFilter === "ALL" &&
            brandFilter === "ALL" &&
            !catalogShowSelectedOnly ? (
              <button
                type="button"
                onClick={() => setCatalogListLimit((n) => n + 80)}
                style={{ ...secondaryButtonStyle, marginTop: 12 }}
              >
                {t.loadMore} (+80)
              </button>
            ) : null}

            {displayCatalogItems.length === 0 ? (
              <div style={{ ...emptyStyle, marginTop: 10 }}>{catalogShowSelectedOnly ? t.noItems : t.noMatches}</div>
            ) : null}
"""
    middle = middle.replace(old_tail, SHOWING + "\n" + GRID_BLOCK + "\n            {orderableCatalogItems.length === 0 ? (\n              <div style={{ ...emptyStyle, marginTop: 10 }}>{catalogShowSelectedOnly ? t.noItems : t.noMatches}</div>\n            ) : null}\n")

    middle = middle.replace("<Input ", "<OrderInput ")
    middle = middle.replace("</Input>", "</OrderInput>")

    path.write_text(HEADER + middle)

main()

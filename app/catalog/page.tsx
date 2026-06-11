import type { Metadata } from "next";

import CatalogBrowseClient from "./CatalogBrowseClient";

export const metadata: Metadata = {
  title: "SKU Catalog",
  description: "Browse product SKU information sorted by SKU number.",
};

export default function CatalogPage() {
  return <CatalogBrowseClient />;
}

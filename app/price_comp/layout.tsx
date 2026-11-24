import type { Metadata } from "next";
import type { ReactNode } from "react";

import "../admin/admin.css";
import "../comp/comp.css";
import "./price-comp.css";

export const metadata: Metadata = {
  title: "Price Compare | /price_comp",
  description: "Compare last invoice prices across customer accounts and download CSV",
};

export default function PriceCompLayout({ children }: { children: ReactNode }) {
  return <div lang="en">{children}</div>;
}

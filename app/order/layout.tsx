import type { ReactNode } from "react";

import "./order.css";
import "../components/out-of-stock-stamp.css";
import "../components/new-product-badge.css";
import "../components/coming-soon-badge.css";

export default function OrderLayout({ children }: { children: ReactNode }) {
  return children;
}

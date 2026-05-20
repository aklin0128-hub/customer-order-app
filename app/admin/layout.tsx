import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./admin.css";

export const metadata: Metadata = {
  title: "Admin | Rhee Bros Orders",
  description: "Manage customers, products, and orders",
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return children;
}

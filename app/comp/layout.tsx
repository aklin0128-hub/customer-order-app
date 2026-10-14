import type { Metadata } from "next";
import type { ReactNode } from "react";

import "../admin/admin.css";
import "./comp.css";

export const metadata: Metadata = {
  title: "Invoice Compare | /comp",
  description: "Compare invoice prices for the same account and download CSV",
};

export default function CompLayout({ children }: { children: ReactNode }) {
  return <div lang="en">{children}</div>;
}

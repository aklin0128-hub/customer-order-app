import type { Metadata } from "next";

import { ExpAuthProvider } from "./useExpAuth";

import "./exp.css";

export const metadata: Metadata = {
  title: "Inventory expiry lookup",
  description: "Internal SKU expiration lookup for Rheebros warehouse team.",
  robots: { index: false, follow: false },
};

export default function ExpLayout({ children }: { children: React.ReactNode }) {
  return <ExpAuthProvider>{children}</ExpAuthProvider>;
}

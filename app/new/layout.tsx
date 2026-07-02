import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "New & Promotions",
  description: "Browse new products and promotions. Sign in to place your order.",
};

export default function NewShowcaseLayout({ children }: { children: React.ReactNode }) {
  return children;
}

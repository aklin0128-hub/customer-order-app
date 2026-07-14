import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Promotions",
  description: "Browse current promotions. Sign in to place your order.",
};

export default function PromoShowcaseLayout({ children }: { children: React.ReactNode }) {
  return children;
}

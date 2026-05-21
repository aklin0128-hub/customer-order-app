import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "New & Weekly Picks",
  description: "Browse new products and weekly promotions. Sign in to place your order.",
};

export default function NewShowcaseLayout({ children }: { children: React.ReactNode }) {
  return children;
}

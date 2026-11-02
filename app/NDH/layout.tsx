import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "NDH",
  description: "Browse NDH near-date items. Sign in to place your order.",
};

export default function NdhLayout({ children }: { children: React.ReactNode }) {
  return children;
}

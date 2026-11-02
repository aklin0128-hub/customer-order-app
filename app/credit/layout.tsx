import type { Metadata } from "next";
import "./credit.css";

export const metadata: Metadata = {
  title: "Credit / Deposit Slip",
  description: "Parse AR statements and build PNC check deposit slips",
};

export default function CreditLayout({ children }: { children: React.ReactNode }) {
  return children;
}

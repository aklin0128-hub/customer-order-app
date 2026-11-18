import type { Metadata } from "next";
import "./credit.css";

export const metadata: Metadata = {
  title: "Payment / Deposit Slip",
  description: "Parse AR statements and build PNC check deposit slips",
};

export default function PaymentLayout({ children }: { children: React.ReactNode }) {
  return children;
}

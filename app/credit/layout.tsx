import type { Metadata } from "next";
import "./credit-request.css";

export const metadata: Metadata = {
  title: "Sales Credit Request",
  description: "Fill a sales credit request and save it as PDF",
};

export default function CreditLayout({ children }: { children: React.ReactNode }) {
  return children;
}

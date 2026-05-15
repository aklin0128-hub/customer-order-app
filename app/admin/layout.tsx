import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Admin | Rhee Bros Orders",
  description: "Manage customers, products, and orders",
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <style>{`
        @media (max-width: 900px) {
          .admin-shell { flex-direction: column !important; }
          .admin-sidebar {
            width: 100% !important;
            height: auto !important;
            position: relative !important;
            flex-direction: row !important;
            flex-wrap: wrap !important;
            align-items: center !important;
          }
          .admin-sidebar nav {
            flex-direction: row !important;
            flex-wrap: wrap !important;
            width: 100% !important;
          }
          .admin-split { grid-template-columns: 1fr !important; }
        }
      `}</style>
      {children}
    </>
  );
}

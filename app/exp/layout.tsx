import type { Metadata } from "next";

import { ExpAuthProvider } from "./useExpAuth";
import { ExpOfflineBootstrap } from "./ExpOfflineBootstrap";

import "./exp.css";

export const metadata: Metadata = {
  title: "Inventory expiry lookup",
  description: "Internal SKU expiration lookup for Rheebros warehouse team.",
  robots: { index: false, follow: false },
  manifest: "/exp-manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "EXP",
    statusBarStyle: "default",
  },
  icons: {
    apple: "/exp-icon-192.png",
  },
};

export default function ExpLayout({ children }: { children: React.ReactNode }) {
  return (
    <ExpAuthProvider>
      <ExpOfflineBootstrap />
      {children}
    </ExpAuthProvider>
  );
}

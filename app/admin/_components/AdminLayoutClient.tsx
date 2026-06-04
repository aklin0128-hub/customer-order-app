"use client";

import type { ReactNode } from "react";
import { AdminAuthProvider } from "./AdminAuthContext";

export function AdminLayoutClient({ children }: { children: ReactNode }) {
  return <AdminAuthProvider>{children}</AdminAuthProvider>;
}

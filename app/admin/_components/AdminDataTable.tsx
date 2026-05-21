"use client";

import type { ReactNode } from "react";

export function AdminDataTable({
  children,
  maxHeight,
}: {
  children: ReactNode;
  /** e.g. "min(480px, 60vh)" */
  maxHeight?: string;
}) {
  return (
    <div
      className="admin-data-table-wrap"
      style={maxHeight ? { maxHeight } : undefined}
    >
      <table className="admin-data-table">{children}</table>
    </div>
  );
}

"use client";

import { btnSecondary } from "../_components/admin-styles";

export function AdminListPager({
  page,
  totalPages,
  total,
  onPageChange,
  disabled,
}: {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}) {
  if (totalPages <= 1 && total <= 50) return null;

  return (
    <div className="admin-list-pager">
      <span className="admin-list-pager-meta">
        {total} total · page {page} / {totalPages}
      </span>
      <div className="admin-list-pager-btns">
        <button
          type="button"
          style={btnSecondary}
          disabled={disabled || page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          ← Prev
        </button>
        <button
          type="button"
          style={btnSecondary}
          disabled={disabled || page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next →
        </button>
      </div>
    </div>
  );
}

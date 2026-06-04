"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminAuth } from "./AdminAuthContext";

type ListMeta = {
  total: number;
  totalPages: number;
  page: number;
};

type UseAdminListOptions<T> = {
  enabled?: boolean;
  buildParams: (page: number) => URLSearchParams;
  fetchPath: string;
  pickItems: (json: Record<string, unknown>) => T[];
  pickMeta?: (json: Record<string, unknown>) => Partial<ListMeta>;
  debounceMs?: number;
  deps?: unknown[];
  onError?: (message: string) => void;
};

export function useAdminList<T>({
  enabled = true,
  buildParams,
  fetchPath,
  pickItems,
  pickMeta,
  debounceMs = 0,
  deps = [],
  onError,
}: UseAdminListOptions<T>) {
  const { authed, adminHeaders } = useAdminAuth();
  const [items, setItems] = useState<T[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    async (pageToLoad = page) => {
      if (!authed) return;
      setBusy(true);
      try {
        const params = buildParams(pageToLoad);
        const res = await fetch(`${fetchPath}?${params}`, {
          cache: "no-store",
          headers: adminHeaders(),
        });
        const data = (await res.json()) as Record<string, unknown>;
        if (!res.ok) throw new Error(String(data?.error || "Failed to load list."));
        setItems(pickItems(data));
        const meta = pickMeta?.(data);
        setTotal(meta?.total ?? 0);
        setTotalPages(meta?.totalPages ?? 1);
        setPage(meta?.page ?? pageToLoad);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Failed to load list.";
        onError?.(message);
      } finally {
        setBusy(false);
      }
    },
    [authed, adminHeaders, buildParams, fetchPath, onError, page, pickItems, pickMeta]
  );

  useEffect(() => {
    if (!enabled || !authed) return;
    const delay = debounceMs > 0 ? debounceMs : 0;
    const t = setTimeout(() => void load(page), delay);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, authed, page, load, debounceMs, ...deps]);

  return {
    items,
    setItems,
    page,
    setPage,
    total,
    totalPages,
    busy,
    load,
  };
}

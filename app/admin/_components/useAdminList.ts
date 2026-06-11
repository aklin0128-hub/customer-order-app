"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

  const buildParamsRef = useRef(buildParams);
  const pickItemsRef = useRef(pickItems);
  const pickMetaRef = useRef(pickMeta);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    buildParamsRef.current = buildParams;
    pickItemsRef.current = pickItems;
    pickMetaRef.current = pickMeta;
    onErrorRef.current = onError;
  });

  const load = useCallback(
    async (pageToLoad: number, signal?: AbortSignal) => {
      if (!authed) return;
      setBusy(true);
      try {
        const params = buildParamsRef.current(pageToLoad);
        const res = await fetch(`${fetchPath}?${params}`, {
          cache: "no-store",
          headers: adminHeaders(),
          signal,
        });
        const data = (await res.json()) as Record<string, unknown>;
        if (signal?.aborted) return;
        if (!res.ok) throw new Error(String(data?.error || "Failed to load list."));
        setItems(pickItemsRef.current(data));
        const meta = pickMetaRef.current?.(data);
        setTotal(meta?.total ?? 0);
        setTotalPages(meta?.totalPages ?? 1);
        const nextPage = meta?.page ?? pageToLoad;
        setPage((prev) => (prev === nextPage ? prev : nextPage));
      } catch (err: unknown) {
        if (signal?.aborted) return;
        const message = err instanceof Error ? err.message : "Failed to load list.";
        onErrorRef.current?.(message);
      } finally {
        if (!signal?.aborted) setBusy(false);
      }
    },
    [authed, adminHeaders, fetchPath]
  );

  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    if (!enabled || !authed) return;

    const controller = new AbortController();
    const delay = debounceMs > 0 ? debounceMs : 0;
    const t = setTimeout(() => {
      void loadRef.current(page, controller.signal);
    }, delay);

    return () => {
      clearTimeout(t);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, authed, page, debounceMs, ...deps]);

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

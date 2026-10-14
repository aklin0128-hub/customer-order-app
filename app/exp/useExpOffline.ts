"use client";

import { useCallback, useEffect, useState } from "react";

import type { ExpOfflinePack } from "@/lib/expOfflinePack";
import {
  clearExpOfflinePack,
  loadExpOfflinePack,
  saveExpOfflinePack,
} from "./expOfflineStore";

export type ExpOfflineSyncState = {
  pack: ExpOfflinePack | null;
  syncing: boolean;
  lastError: string;
  online: boolean;
};

export function useExpOffline(authed: boolean, expHeaders: (extra?: HeadersInit) => HeadersInit) {
  const [pack, setPack] = useState<ExpOfflinePack | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [lastError, setLastError] = useState("");
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const update = () => setOnline(typeof navigator === "undefined" ? true : navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  useEffect(() => {
    if (!authed) {
      setPack(null);
      return;
    }
    void loadExpOfflinePack().then((saved) => {
      if (saved) setPack(saved);
    });
  }, [authed]);

  const syncOfflinePack = useCallback(async () => {
    if (!authed) return null;
    setSyncing(true);
    setLastError("");
    try {
      const res = await fetch("/api/exp/offline-pack", {
        cache: "no-store",
        headers: expHeaders(),
      });
      const data = await res.json();
      if (!res.ok || !data?.pack) {
        throw new Error(data?.error || "Failed to download offline data.");
      }
      const next = data.pack as ExpOfflinePack;
      await saveExpOfflinePack(next);
      setPack(next);
      return next;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Offline sync failed.";
      setLastError(message);
      return null;
    } finally {
      setSyncing(false);
    }
  }, [authed, expHeaders]);

  const clearOffline = useCallback(async () => {
    await clearExpOfflinePack();
    setPack(null);
    setLastError("");
  }, []);

  return {
    pack,
    syncing,
    lastError,
    online,
    syncOfflinePack,
    clearOffline,
  };
}

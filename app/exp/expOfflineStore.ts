"use client";

import type { ExpOfflinePack } from "@/lib/expOfflinePack";
import { EXP_OFFLINE_PACK_VERSION } from "@/lib/expOfflinePack";

const DB_NAME = "exp-offline";
const DB_VERSION = 1;
const STORE = "packs";
const PACK_KEY = "current";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error || new Error("IndexedDB open failed"));
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
  });
}

function idbRequest<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onerror = () => reject(req.error || new Error("IndexedDB request failed"));
    req.onsuccess = () => resolve(req.result);
  });
}

export async function saveExpOfflinePack(pack: ExpOfflinePack): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE, "readwrite");
    await idbRequest(tx.objectStore(STORE).put(pack, PACK_KEY));
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error("IndexedDB write failed"));
      tx.onabort = () => reject(tx.error || new Error("IndexedDB write aborted"));
    });
  } finally {
    db.close();
  }
}

export async function loadExpOfflinePack(): Promise<ExpOfflinePack | null> {
  try {
    const db = await openDb();
    try {
      const tx = db.transaction(STORE, "readonly");
      const pack = await idbRequest(tx.objectStore(STORE).get(PACK_KEY));
      if (!pack || typeof pack !== "object") return null;
      const typed = pack as ExpOfflinePack;
      if (typed.version !== EXP_OFFLINE_PACK_VERSION) return null;
      if (!Array.isArray(typed.catalog) || !Array.isArray(typed.lots)) return null;
      return typed;
    } finally {
      db.close();
    }
  } catch {
    return null;
  }
}

export async function clearExpOfflinePack(): Promise<void> {
  try {
    const db = await openDb();
    try {
      const tx = db.transaction(STORE, "readwrite");
      await idbRequest(tx.objectStore(STORE).delete(PACK_KEY));
      await new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error || new Error("IndexedDB clear failed"));
        tx.onabort = () => reject(tx.error || new Error("IndexedDB clear aborted"));
      });
    } finally {
      db.close();
    }
  } catch {
    /* ignore */
  }
}

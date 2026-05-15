"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "admin_password";

export function useAdminAuth() {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved) {
      setPassword(saved);
      setAuthed(true);
    }
    setReady(true);
  }, []);

  const login = useCallback(async (inputPassword: string) => {
    const trimmed = inputPassword.trim();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/admin/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: trimmed }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Invalid admin password.");
      }

      sessionStorage.setItem(STORAGE_KEY, trimmed);
      setPassword(trimmed);
      setAuthed(true);
      return true;
    } catch (err: any) {
      setError(err?.message || "Login failed.");
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY);
    setPassword("");
    setAuthed(false);
    setError("");
  }, []);

  const adminHeaders = useCallback(
    (extra?: Record<string, string>) => ({
      "x-admin-password": password,
      ...extra,
    }),
    [password]
  );

  return {
    ready,
    authed,
    password,
    error,
    loading,
    setError,
    login,
    logout,
    adminHeaders,
  };
}

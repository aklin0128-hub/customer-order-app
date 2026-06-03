"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "exp_access_password";

export function useExpAuth() {
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
      const res = await fetch("/api/exp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: trimmed }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Invalid password.");
      }

      sessionStorage.setItem(STORAGE_KEY, trimmed);
      setPassword(trimmed);
      setAuthed(true);
      return true;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed.");
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY);
    setPassword("");
    setAuthed(false);
  }, []);

  const expHeaders = useCallback(
    (extra?: HeadersInit): HeadersInit => ({
      "x-exp-password": password,
      ...extra,
    }),
    [password]
  );

  return { ready, authed, password, error, loading, login, logout, expHeaders };
}

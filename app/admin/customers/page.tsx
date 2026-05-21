"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AdminLogin } from "../_components/AdminLogin";
import { AdminShell } from "../_components/AdminShell";
import { formGrid, inputStyle, labelStyle, splitForm, splitLayout, splitList } from "../_components/admin-styles";
import {
  BtnDanger,
  BtnPrimary,
  BtnRow,
  BtnSecondary,
  EmptyState,
  FilterChips,
  ListItemButton,
  Panel,
  StatGrid,
  Toast,
} from "../_components/admin-utils";
import { downloadCsv } from "../_components/admin-analytics-ui";
import { MARKET_REGIONS, marketRegionLabel } from "@/lib/customerRegion";
import { guessRegionFromText } from "@/lib/regionGuess";
import { useAdminAuth } from "../_components/useAdminAuth";

type Customer = {
  accountNo: string;
  storeName: string;
  password: string;
  active?: boolean;
  email?: string;
  phone?: string;
  note?: string;
  region?: string;
  updatedAt?: string;
  source?: "local" | "redis";
  csvBacked?: boolean;
};

type StatusFilter = "all" | "active" | "inactive";

export default function AdminCustomersPage() {
  const { ready, authed, error, loading, login, logout, adminHeaders } = useAdminAuth();
  const [passwordInput, setPasswordInput] = useState("");

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const [accountNo, setAccountNo] = useState("");
  const [storeName, setStoreName] = useState("");
  const [password, setPassword] = useState("");
  const [active, setActive] = useState(true);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [region, setRegion] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkRegion, setBulkRegion] = useState("");
  const [regionFilter, setRegionFilter] = useState("all");
  const [urlAccountHandled, setUrlAccountHandled] = useState(false);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgTone, setMsgTone] = useState<"success" | "error">("success");

  const notify = (text: string, tone: "success" | "error" = "success") => {
    setMsg(text);
    setMsgTone(tone);
  };

  const loadCustomers = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/customers", {
        cache: "no-store",
        headers: adminHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load customers.");
      setCustomers(Array.isArray(data.customers) ? data.customers : []);
    } catch (err: any) {
      notify(err?.message || "Failed to load customers.", "error");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (authed) loadCustomers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed]);

  useEffect(() => {
    if (urlAccountHandled || !customers.length) return;
    const acct = new URLSearchParams(window.location.search).get("accountNo")?.trim().toUpperCase();
    if (!acct) {
      setUrlAccountHandled(true);
      return;
    }
    const match = customers.find((c) => c.accountNo.toUpperCase() === acct);
    if (match) {
      setAccountNo(match.accountNo);
      setStoreName(match.storeName || "");
      setPassword(match.password || "");
      setActive(match.active !== false);
      setEmail(match.email || "");
      setPhone(match.phone || "");
      setNote(match.note || "");
      setRegion(match.region || "");
    } else {
      setAccountNo(acct);
    }
    setSearch(acct);
    setUrlAccountHandled(true);
  }, [customers, urlAccountHandled]);

  const filteredCustomers = useMemo(() => {
    const q = search.trim().toUpperCase();
    return customers.filter((c) => {
      if (statusFilter === "active" && c.active === false) return false;
      if (statusFilter === "inactive" && c.active !== false) return false;
      if (regionFilter === "unassigned" && c.region) return false;
      if (regionFilter !== "all" && regionFilter !== "unassigned" && c.region !== regionFilter) return false;
      if (!q) return true;
      return (
        c.accountNo?.toUpperCase().includes(q) ||
        c.storeName?.toUpperCase().includes(q) ||
        c.email?.toUpperCase().includes(q) ||
        c.phone?.toUpperCase().includes(q)
      );
    });
  }, [customers, search, statusFilter, regionFilter]);

  const toggleSelect = (acct: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(acct)) next.delete(acct);
      else next.add(acct);
      return next;
    });
  };

  const selectAllVisible = () => {
    setSelected(new Set(filteredCustomers.map((c) => c.accountNo.toUpperCase())));
  };

  const bulkAssignRegion = async () => {
    if (!selected.size) return notify("Select accounts first.", "error");
    setBusy(true);
    try {
      const res = await fetch("/api/admin/customers/bulk-region", {
        method: "POST",
        headers: adminHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          accountNos: Array.from(selected),
          region: bulkRegion,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Bulk update failed.");
      setCustomers(Array.isArray(data.customers) ? data.customers : []);
      setSelected(new Set());
      notify(`Updated region for ${data.updated} account(s).`);
    } catch (err: any) {
      notify(err?.message || "Bulk update failed.", "error");
    } finally {
      setBusy(false);
    }
  };

  const selectCustomer = (c: Customer) => {
    setAccountNo(c.accountNo || "");
    setStoreName(c.storeName || "");
    setPassword(c.password || "");
    setActive(c.active !== false);
    setEmail(c.email || "");
    setPhone(c.phone || "");
    setNote(c.note || "");
    setRegion(c.region || "");
    notify(`Editing ${c.accountNo}`);
  };

  const clearForm = () => {
    setAccountNo("");
    setStoreName("");
    setPassword("");
    setActive(true);
    setEmail("");
    setPhone("");
    setNote("");
    setRegion("");
    setMsg("");
  };

  const saveCustomer = async () => {
    const finalAccount = accountNo.trim().toUpperCase();
    if (!finalAccount) return notify("Please enter account number.", "error");
    if (!storeName.trim()) return notify("Please enter store name.", "error");
    if (!password.trim()) return notify("Please enter customer password.", "error");

    setBusy(true);
    try {
      const res = await fetch("/api/admin/customers", {
        method: "POST",
        headers: adminHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          accountNo: finalAccount,
          storeName,
          password,
          active,
          email,
          phone,
          note,
          region: region || "",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to save customer.");
      notify(`Saved ${finalAccount}`);
      await loadCustomers();
    } catch (err: any) {
      notify(err?.message || "Failed to save customer.", "error");
    } finally {
      setBusy(false);
    }
  };

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.accountNo.toUpperCase() === accountNo.trim().toUpperCase()) || null,
    [customers, accountNo]
  );

  const deleteCustomer = async () => {
    const finalAccount = accountNo.trim().toUpperCase();
    if (!finalAccount) return;

    const csvBacked = selectedCustomer?.csvBacked ?? selectedCustomer?.source === "local";
    const confirmText = csvBacked
      ? `Disable login for ${finalAccount}? The row stays in data/customers.csv but the store cannot sign in.`
      : `Delete customer ${finalAccount}? They will no longer be able to log in.`;
    if (!confirm(confirmText)) return;

    setBusy(true);
    try {
      const res = await fetch(`/api/admin/customers?accountNo=${encodeURIComponent(finalAccount)}`, {
        method: "DELETE",
        headers: adminHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to delete customer.");
      notify(
        data.mode === "disabled"
          ? `Disabled login for ${finalAccount} (still in customers.csv)`
          : `Deleted ${finalAccount}`
      );
      clearForm();
      await loadCustomers();
    } catch (err: any) {
      notify(err?.message || "Failed to delete customer.", "error");
    } finally {
      setBusy(false);
    }
  };

  if (!ready) return null;

  if (!authed) {
    return (
      <AdminLogin
        title="Customers"
        subtitle="Sign in to manage customer login accounts."
        password={passwordInput}
        onPasswordChange={setPasswordInput}
        error={error}
        loading={loading}
        onSubmit={() => login(passwordInput)}
      />
    );
  }

  return (
    <AdminShell
      active="customers"
      title="Customers"
      subtitle="CSV accounts cannot be removed from the file here — Delete disables login via Redis. Redis-only accounts are removed entirely."
      onLogout={logout}
      actions={
        <BtnSecondary onClick={() => { clearForm(); notify("New customer form ready."); }}>
          + New customer
        </BtnSecondary>
      }
    >
      <StatGrid
        items={[
          { label: "Total", value: customers.length },
          { label: "From CSV", value: customers.filter((c) => c.source === "local").length },
          { label: "In Redis", value: customers.filter((c) => c.source === "redis").length },
          { label: "Active", value: customers.filter((c) => c.active !== false).length },
          {
            label: "With region",
            value: customers.filter((c) => c.region).length,
          },
        ]}
      />

      <div style={splitLayout} className="admin-split">
        <Panel title={`Customer list (${filteredCustomers.length})`}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search account, store, email, phone..."
            style={{ ...inputStyle, marginBottom: 8 }}
          />
          <FilterChips
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { id: "all", label: "All" },
              { id: "active", label: "Active" },
              { id: "inactive", label: "Inactive" },
            ]}
          />
          <FilterChips
            value={regionFilter}
            onChange={setRegionFilter}
            options={[
              { id: "all", label: "All regions" },
              ...MARKET_REGIONS.map((r) => ({ id: r.id, label: r.label })),
              { id: "unassigned", label: "Unassigned" },
            ]}
          />
          {selected.size > 0 ? (
            <div className="admin-bulk-bar">
              <span style={{ fontSize: 12, fontWeight: 800 }}>{selected.size} selected</span>
              <select
                value={bulkRegion}
                onChange={(e) => setBulkRegion(e.target.value)}
                style={{ ...inputStyle, width: "auto", margin: 0 }}
              >
                <option value="">Clear region</option>
                {MARKET_REGIONS.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
              <BtnPrimary onClick={() => void bulkAssignRegion()} disabled={busy}>
                Apply region
              </BtnPrimary>
              <BtnSecondary onClick={() => setSelected(new Set())}>Clear</BtnSecondary>
            </div>
          ) : null}
          <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
            <BtnSecondary onClick={selectAllVisible}>Select visible</BtnSecondary>
            <BtnSecondary
              onClick={() =>
                downloadCsv(
                  "customers-export.csv",
                  ["accountNo", "storeName", "region", "email", "phone", "active"],
                  filteredCustomers.map((c) => [
                    c.accountNo,
                    c.storeName,
                    c.region || "",
                    c.email || "",
                    c.phone || "",
                    c.active ? "yes" : "no",
                  ])
                )
              }
            >
              Export visible CSV
            </BtnSecondary>
          </div>
          <div className="admin-split-list">
            {filteredCustomers.map((c) => (
              <ListItemButton
                key={c.accountNo}
                selected={accountNo.toUpperCase() === c.accountNo?.toUpperCase()}
                onClick={() => selectCustomer(c)}
              >
                <input
                  type="checkbox"
                  checked={selected.has(c.accountNo.toUpperCase())}
                  onChange={(e) => {
                    e.stopPropagation();
                    toggleSelect(c.accountNo.toUpperCase());
                  }}
                  onClick={(e) => e.stopPropagation()}
                  style={{ marginRight: 8 }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                  <div>
                    <strong>{c.accountNo}</strong>
                    <div style={{ fontSize: 13, color: "#374151", marginTop: 2 }}>{c.storeName || "—"}</div>
                    {c.region ? (
                      <div style={{ fontSize: 10, fontWeight: 800, color: "#1d4ed8", marginTop: 4 }}>
                        {marketRegionLabel(c.region)}
                      </div>
                    ) : (() => {
                      const guess = guessRegionFromText(c.storeName || "");
                      return guess ? (
                        <div style={{ fontSize: 10, fontWeight: 800, color: "#b45309", marginTop: 4 }}>
                          Suggest: {marketRegionLabel(guess)}
                        </div>
                      ) : null;
                    })()}
                    {c.phone || c.email ? (
                      <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>
                        {[c.phone, c.email].filter(Boolean).join(" · ")}
                      </div>
                    ) : null}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 900,
                        padding: "3px 8px",
                        borderRadius: 999,
                        background: c.source === "redis" ? "#eff6ff" : "#f3f4f6",
                        color: c.source === "redis" ? "#1d4ed8" : "#4b5563",
                      }}
                    >
                      {c.source === "redis" ? "REDIS" : "CSV"}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 900,
                        padding: "3px 8px",
                        borderRadius: 999,
                        background: c.active !== false ? "#ecfdf5" : "#fef2f2",
                        color: c.active !== false ? "#059669" : "#dc2626",
                      }}
                    >
                      {c.active !== false ? "ACTIVE" : "OFF"}
                    </span>
                  </div>
                </div>
              </ListItemButton>
            ))}
            {filteredCustomers.length === 0 ? (
              <EmptyState title="No customers found" detail="Try a different search or add a new account." />
            ) : null}
          </div>
        </Panel>

        <div style={splitForm}>
          <Panel title={accountNo ? `Edit ${accountNo}` : "New customer"}>
            <div style={formGrid}>
              <Field label="Account No" hint="e.g. FL111">
                <input
                  value={accountNo}
                  onChange={(e) => setAccountNo(e.target.value.toUpperCase())}
                  placeholder="FL111"
                  style={inputStyle}
                  disabled={customers.some(
                    (c) => c.accountNo?.toUpperCase() === accountNo.trim().toUpperCase() && accountNo.trim()
                  )}
                />
              </Field>
              <Field label="Store name">
                <input value={storeName} onChange={(e) => setStoreName(e.target.value)} style={inputStyle} />
              </Field>
              <Field label="Password">
                <div style={{ display: "flex", gap: 6 }}>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <BtnSecondary onClick={() => setShowPassword((v) => !v)}>
                    {showPassword ? "Hide" : "Show"}
                  </BtnSecondary>
                </div>
              </Field>
              <Field label="Market region" hint="For city sales reports">
                <select value={region} onChange={(e) => setRegion(e.target.value)} style={inputStyle}>
                  <option value="">— Not set —</option>
                  {MARKET_REGIONS.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Status">
                <select
                  value={active ? "active" : "inactive"}
                  onChange={(e) => setActive(e.target.value === "active")}
                  style={inputStyle}
                >
                  <option value="active">Active — can log in</option>
                  <option value="inactive">Inactive — blocked</option>
                </select>
              </Field>
              <Field label="Email (optional)">
                <input value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
              </Field>
              <Field label="Phone (optional)">
                <input value={phone} onChange={(e) => setPhone(e.target.value)} style={inputStyle} />
              </Field>
              <Field label="Internal note">
                <textarea value={note} onChange={(e) => setNote(e.target.value)} style={{ ...inputStyle, minHeight: 72 }} />
              </Field>
            </div>

            {selectedCustomer?.csvBacked ? (
              <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 10px", lineHeight: 1.45 }}>
                This account is in customers.csv. Use Disable login to block sign-in without editing the CSV file.
              </p>
            ) : null}

            <BtnRow>
              <BtnPrimary onClick={saveCustomer} disabled={busy}>
                {busy ? "Saving..." : "Save customer"}
              </BtnPrimary>
              {accountNo ? (
                <Link href={`/admin/account?accountNo=${encodeURIComponent(accountNo)}`}>
                  <BtnSecondary>Account 360</BtnSecondary>
                </Link>
              ) : null}
              <BtnSecondary onClick={clearForm}>Clear form</BtnSecondary>
              <BtnSecondary onClick={loadCustomers} disabled={busy}>
                Refresh
              </BtnSecondary>
              {accountNo ? (
                <BtnDanger onClick={deleteCustomer} disabled={busy}>
                  {selectedCustomer?.csvBacked || selectedCustomer?.source === "local" ? "Disable login" : "Delete"}
                </BtnDanger>
              ) : null}
            </BtnRow>

            <Toast message={msg} tone={msgTone} />
          </Panel>
        </div>
      </div>
    </AdminShell>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
      {hint ? <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>{hint}</div> : null}
    </div>
  );
}

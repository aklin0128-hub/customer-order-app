"use client";

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
import { useAdminAuth } from "../_components/useAdminAuth";

type Customer = {
  accountNo: string;
  storeName: string;
  password: string;
  active?: boolean;
  email?: string;
  phone?: string;
  note?: string;
  updatedAt?: string;
  source?: "local" | "redis";
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
  const [showPassword, setShowPassword] = useState(false);

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

  const filteredCustomers = useMemo(() => {
    const q = search.trim().toUpperCase();
    return customers.filter((c) => {
      if (statusFilter === "active" && c.active === false) return false;
      if (statusFilter === "inactive" && c.active !== false) return false;
      if (!q) return true;
      return (
        c.accountNo?.toUpperCase().includes(q) ||
        c.storeName?.toUpperCase().includes(q) ||
        c.email?.toUpperCase().includes(q) ||
        c.phone?.toUpperCase().includes(q)
      );
    });
  }, [customers, search, statusFilter]);

  const selectCustomer = (c: Customer) => {
    setAccountNo(c.accountNo || "");
    setStoreName(c.storeName || "");
    setPassword(c.password || "");
    setActive(c.active !== false);
    setEmail(c.email || "");
    setPhone(c.phone || "");
    setNote(c.note || "");
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

  const deleteCustomer = async () => {
    const finalAccount = accountNo.trim().toUpperCase();
    if (!finalAccount) return;
    if (!confirm(`Delete customer ${finalAccount}? They will no longer be able to log in.`)) return;

    setBusy(true);
    try {
      const res = await fetch(`/api/admin/customers?accountNo=${encodeURIComponent(finalAccount)}`, {
        method: "DELETE",
        headers: adminHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to delete customer.");
      notify(`Deleted ${finalAccount}`);
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
      subtitle="Shows accounts from data/customers.csv and Redis. Saving writes to Redis and overrides CSV for that account."
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
          <div style={splitList}>
            {filteredCustomers.map((c) => (
              <ListItemButton
                key={c.accountNo}
                selected={accountNo.toUpperCase() === c.accountNo?.toUpperCase()}
                onClick={() => selectCustomer(c)}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                  <div>
                    <strong>{c.accountNo}</strong>
                    <div style={{ fontSize: 13, color: "#374151", marginTop: 2 }}>{c.storeName || "—"}</div>
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

            <BtnRow>
              <BtnPrimary onClick={saveCustomer} disabled={busy}>
                {busy ? "Saving..." : "Save customer"}
              </BtnPrimary>
              <BtnSecondary onClick={clearForm}>Clear form</BtnSecondary>
              <BtnSecondary onClick={loadCustomers} disabled={busy}>
                Refresh
              </BtnSecondary>
              {accountNo ? <BtnDanger onClick={deleteCustomer} disabled={busy}>Delete</BtnDanger> : null}
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

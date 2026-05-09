"use client";

import { useEffect, useMemo, useState } from "react";

type Customer = {
  accountNo: string;
  storeName: string;
  active: boolean;
  source?: string;
};

const ADMIN_PASSWORD = "536678";

export default function AdminPage() {
  const [adminAuthed, setAdminAuthed] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [adminError, setAdminError] = useState("");

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [accountNo, setAccountNo] = useState("");
  const [storeName, setStoreName] = useState("");
  const [password, setPassword] = useState("");
  const [active, setActive] = useState(true);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAdminLogin = () => {
    setAdminError("");

    if (adminPassword.trim() !== ADMIN_PASSWORD) {
      setAdminError("Invalid admin password.");
      return;
    }

    setAdminAuthed(true);
    setAdminPassword("");
  };

  const loadCustomers = async () => {
    setLoading(true);
    setMsg("");

    try {
      const res = await fetch("/api/admin/customers", { cache: "no-store" });
      const data = await res.json();

      if (!res.ok) throw new Error(data?.error || "Failed to load customers.");

      setCustomers(Array.isArray(data.customers) ? data.customers : []);
    } catch (error: any) {
      setMsg(error?.message || "Failed to load customers.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (adminAuthed) loadCustomers();
  }, [adminAuthed]);

  const filteredCustomers = useMemo(() => {
    const q = search.trim().toUpperCase();
    if (!q) return customers;

    return customers.filter(
      (c) =>
        c.accountNo.toUpperCase().includes(q) ||
        c.storeName.toUpperCase().includes(q)
    );
  }, [customers, search]);

  const resetForm = () => {
    setAccountNo("");
    setStoreName("");
    setPassword("");
    setActive(true);
    setMsg("");
  };

  const selectCustomer = (c: Customer) => {
    setAccountNo(c.accountNo);
    setStoreName(c.storeName);
    setPassword("");
    setActive(c.active);
    setMsg(`Editing ${c.accountNo}. Leave password blank to keep current password.`);
  };

  const saveCustomer = async () => {
    const acct = accountNo.trim().toUpperCase();

    if (!acct) return alert("Please enter account number.");
    if (!storeName.trim()) return alert("Please enter store name.");

    setLoading(true);
    setMsg("");

    try {
      const res = await fetch("/api/admin/update-customer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          accountNo: acct,
          storeName: storeName.trim(),
          password: password.trim(),
          active,
        }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data?.error || "Failed to save customer.");

      setMsg(`Saved ${acct} successfully.`);
      resetForm();
      await loadCustomers();
    } catch (error: any) {
      setMsg(error?.message || "Failed to save customer.");
    } finally {
      setLoading(false);
    }
  };

  if (!adminAuthed) {
    return (
      <main style={loginPageStyle}>
        <section style={loginCardStyle}>
          <div style={logoStyle}>A</div>

          <h1 style={loginTitleStyle}>Admin Login</h1>
          <p style={loginSubtitleStyle}>
            Enter admin password to manage customer accounts.
          </p>

          <input
            type="password"
            value={adminPassword}
            onChange={(e) => {
              setAdminPassword(e.target.value);
              setAdminError("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdminLogin();
            }}
            placeholder="Admin password"
            style={inputStyle}
          />

          {adminError ? <div style={errorStyle}>{adminError}</div> : null}

          <button type="button" onClick={handleAdminLogin} style={primaryButtonStyle}>
            Login
          </button>
        </section>
      </main>
    );
  }

  return (
    <main style={mainStyle}>
      <div style={containerStyle}>
        <section style={headerCardStyle}>
          <div>
            <h1 style={titleStyle}>Admin Account Manager</h1>
            <p style={subtitleStyle}>
              Add customers, edit accounts, reset passwords, and activate/deactivate accounts.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setAdminAuthed(false)}
            style={secondaryButtonStyle}
          >
            Log Out
          </button>
        </section>

        <section style={statsGridStyle}>
          <div style={statCardStyle}>
            <div style={statNumberStyle}>{customers.length}</div>
            <div style={statLabelStyle}>Total Customers</div>
          </div>

          <div style={statCardStyle}>
            <div style={statNumberStyle}>
              {customers.filter((c) => c.active).length}
            </div>
            <div style={statLabelStyle}>Active</div>
          </div>

          <div style={statCardStyle}>
            <div style={statNumberStyle}>
              {customers.filter((c) => c.source === "Redis").length}
            </div>
            <div style={statLabelStyle}>Redis Override</div>
          </div>
        </section>

        <section style={cardStyle}>
          <h2 style={sectionTitleStyle}>
            {accountNo ? `Edit Customer: ${accountNo}` : "Add / Update Customer"}
          </h2>

          <div style={formGridStyle}>
            <div>
              <label style={labelStyle}>Account No</label>
              <input
                value={accountNo}
                onChange={(e) => setAccountNo(e.target.value.toUpperCase())}
                placeholder="FL123"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Store Name</label>
              <input
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder="Kim Lee"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>Password</label>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Leave blank to keep current password"
                style={inputStyle}
              />
            </div>

            <label style={checkboxStyle}>
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
              />
              Active Account
            </label>
          </div>

          <div style={buttonRowStyle}>
            <button
              type="button"
              onClick={saveCustomer}
              disabled={loading}
              style={primaryButtonStyle}
            >
              {loading ? "Saving..." : "Save Customer"}
            </button>

            <button type="button" onClick={resetForm} style={secondaryButtonStyle}>
              Clear
            </button>

            <button type="button" onClick={loadCustomers} style={secondaryButtonStyle}>
              Refresh
            </button>
          </div>

          {msg ? (
            <div
              style={{
                ...messageStyle,
                color: msg.toLowerCase().includes("failed") || msg.toLowerCase().includes("error")
                  ? "#b91c1c"
                  : "#15803d",
              }}
            >
              {msg}
            </div>
          ) : null}
        </section>

        <section style={cardStyle}>
          <h2 style={sectionTitleStyle}>Customers ({filteredCustomers.length})</h2>

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search account or store name..."
            style={{ ...inputStyle, marginTop: 12, marginBottom: 12 }}
          />

          <div style={customerListStyle}>
            {filteredCustomers.map((c) => (
              <button
                key={`${c.accountNo}-${c.source}`}
                type="button"
                onClick={() => selectCustomer(c)}
                style={customerCardStyle}
              >
                <div>
                  <div style={customerTitleStyle}>
                    {c.accountNo} · {c.storeName}
                  </div>

                  <div style={customerMetaStyle}>
                    Source: {c.source || "-"} · Click to edit
                  </div>
                </div>

                <span
                  style={{
                    ...badgeStyle,
                    background: c.active ? "#ecfdf5" : "#fef2f2",
                    color: c.active ? "#059669" : "#dc2626",
                    border: c.active ? "1px solid #a7f3d0" : "1px solid #fecaca",
                  }}
                >
                  {c.active ? "ACTIVE" : "INACTIVE"}
                </span>
              </button>
            ))}

            {filteredCustomers.length === 0 ? (
              <div style={emptyStyle}>No customers found.</div>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}

const loginPageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "linear-gradient(180deg, #f8fafc 0%, #eef4ff 100%)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 18,
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
};

const loginCardStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 420,
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 22,
  padding: 22,
  boxShadow: "0 18px 40px rgba(37,99,235,0.12)",
};

const logoStyle: React.CSSProperties = {
  width: 58,
  height: 58,
  borderRadius: 18,
  background: "#2563eb",
  color: "#ffffff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 24,
  fontWeight: 900,
  margin: "0 auto 14px",
};

const loginTitleStyle: React.CSSProperties = {
  margin: 0,
  textAlign: "center",
  fontSize: 26,
  fontWeight: 900,
  color: "#111827",
};

const loginSubtitleStyle: React.CSSProperties = {
  margin: "8px 0 18px",
  textAlign: "center",
  fontSize: 13,
  color: "#6b7280",
};

const mainStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#f8fafc",
  padding: "18px 12px 30px",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
};

const containerStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 860,
  margin: "0 auto",
  display: "flex",
  flexDirection: "column",
  gap: 14,
};

const headerCardStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 18,
  padding: 18,
  boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  flexWrap: "wrap",
};

const cardStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 18,
  padding: 18,
  boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 26,
  fontWeight: 900,
  color: "#111827",
};

const subtitleStyle: React.CSSProperties = {
  margin: "6px 0 0",
  fontSize: 13,
  color: "#6b7280",
};

const statsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
  gap: 10,
};

const statCardStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  padding: 14,
};

const statNumberStyle: React.CSSProperties = {
  fontSize: 24,
  fontWeight: 900,
  color: "#2563eb",
};

const statLabelStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#6b7280",
  fontWeight: 800,
  marginTop: 2,
};

const sectionTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 18,
  fontWeight: 900,
  color: "#111827",
};

const formGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 12,
  marginTop: 14,
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 800,
  color: "#374151",
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "11px 12px",
  borderRadius: 12,
  border: "1px solid #d1d5db",
  fontSize: 14,
  boxSizing: "border-box",
  outline: "none",
  background: "#ffffff",
};

const checkboxStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  fontSize: 13,
  fontWeight: 800,
  color: "#374151",
  paddingTop: 24,
};

const buttonRowStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  marginTop: 14,
};

const primaryButtonStyle: React.CSSProperties = {
  border: "none",
  background: "#2563eb",
  color: "#ffffff",
  borderRadius: 12,
  padding: "11px 15px",
  fontSize: 14,
  fontWeight: 900,
  cursor: "pointer",
};

const secondaryButtonStyle: React.CSSProperties = {
  border: "1px solid #d1d5db",
  background: "#ffffff",
  color: "#111827",
  borderRadius: 12,
  padding: "11px 15px",
  fontSize: 14,
  fontWeight: 800,
  cursor: "pointer",
};

const errorStyle: React.CSSProperties = {
  marginTop: 10,
  marginBottom: 10,
  fontSize: 13,
  fontWeight: 800,
  color: "#b91c1c",
  textAlign: "center",
};

const messageStyle: React.CSSProperties = {
  marginTop: 12,
  fontSize: 13,
  fontWeight: 800,
};

const customerListStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  maxHeight: 520,
  overflowY: "auto",
};

const customerCardStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid #e5e7eb",
  background: "#ffffff",
  borderRadius: 14,
  padding: 13,
  textAlign: "left",
  cursor: "pointer",
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
};

const customerTitleStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 900,
  color: "#111827",
};

const customerMetaStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#6b7280",
  marginTop: 3,
};

const badgeStyle: React.CSSProperties = {
  padding: "4px 9px",
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 900,
  whiteSpace: "nowrap",
};

const emptyStyle: React.CSSProperties = {
  padding: 16,
  textAlign: "center",
  color: "#6b7280",
  background: "#f9fafb",
  borderRadius: 12,
};
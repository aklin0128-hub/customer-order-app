"use client";

import { useMemo, useState } from "react";

type Customer = {
  accountNo: string;
  storeName: string;
  password: string;
  active?: boolean;
  email?: string;
  phone?: string;
  note?: string;
  updatedAt?: string;
};

const ADMIN_PASSWORD = "536678";

export default function AdminCustomersPage() {
  const [adminAuthed, setAdminAuthed] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [adminError, setAdminError] = useState("");

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");

  const [accountNo, setAccountNo] = useState("");
  const [storeName, setStoreName] = useState("");
  const [password, setPassword] = useState("");
  const [active, setActive] = useState(true);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");

  const handleAdminLogin = async () => {
    setAdminError("");

    if (adminPassword.trim() !== ADMIN_PASSWORD) {
      setAdminError("Invalid admin password.");
      return;
    }

    setAdminAuthed(true);
    await loadCustomers(adminPassword.trim());
  };

  const loadCustomers = async (passwordValue = adminPassword.trim()) => {
    setLoading(true);
    setMsg("");

    try {
      const res = await fetch("/api/admin/customers", {
        cache: "no-store",
        headers: {
          "x-admin-password": passwordValue,
        },
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data?.error || "Failed to load customers.");

      setCustomers(Array.isArray(data.customers) ? data.customers : []);
    } catch (error: any) {
      setMsg(error?.message || "Failed to load customers.");
    } finally {
      setLoading(false);
    }
  };

  const filteredCustomers = useMemo(() => {
    const q = search.trim().toUpperCase();

    if (!q) return customers;

    return customers.filter((c) => {
      return (
        c.accountNo?.toUpperCase().includes(q) ||
        c.storeName?.toUpperCase().includes(q) ||
        c.email?.toUpperCase().includes(q) ||
        c.phone?.toUpperCase().includes(q)
      );
    });
  }, [customers, search]);

  const selectCustomer = (c: Customer) => {
    setAccountNo(c.accountNo || "");
    setStoreName(c.storeName || "");
    setPassword(c.password || "");
    setActive(c.active !== false);
    setEmail(c.email || "");
    setPhone(c.phone || "");
    setNote(c.note || "");
    setMsg(`Editing ${c.accountNo}`);
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

    if (!finalAccount) return alert("Please enter account number.");
    if (!storeName.trim()) return alert("Please enter store name.");
    if (!password.trim()) return alert("Please enter customer password.");

    setLoading(true);
    setMsg("");

    try {
      const res = await fetch("/api/admin/customers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": adminPassword.trim(),
        },
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

      setMsg(`Saved ${finalAccount}`);
      await loadCustomers();
    } catch (error: any) {
      setMsg(error?.message || "Failed to save customer.");
    } finally {
      setLoading(false);
    }
  };

  const deleteCustomer = async (targetAccount: string) => {
    const finalAccount = targetAccount.trim().toUpperCase();

    if (!finalAccount) return;

    if (!confirm(`Delete customer ${finalAccount}?`)) return;

    setLoading(true);
    setMsg("");

    try {
      const res = await fetch(`/api/admin/customers?accountNo=${encodeURIComponent(finalAccount)}`, {
        method: "DELETE",
        headers: {
          "x-admin-password": adminPassword.trim(),
        },
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data?.error || "Failed to delete customer.");

      setMsg(`Deleted ${finalAccount}`);
      clearForm();
      await loadCustomers();
    } catch (error: any) {
      setMsg(error?.message || "Failed to delete customer.");
    } finally {
      setLoading(false);
    }
  };

  if (!adminAuthed) {
    return (
      <main style={loginPageStyle}>
        <section style={loginCardStyle}>
          <div style={logoStyle}>CUS</div>

          <h1 style={loginTitleStyle}>Customer Admin Login</h1>
          <p style={loginSubtitleStyle}>Enter admin password to manage customer login accounts.</p>

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
        <section style={headerStyle}>
          <div>
            <h1 style={titleStyle}>Customer Account Manager</h1>
            <p style={subtitleStyle}>Create, edit, activate/deactivate, and delete customer login accounts.</p>
          </div>

          <button
            type="button"
            onClick={() => {
              setAdminAuthed(false);
              setAdminPassword("");
            }}
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
            <div style={statNumberStyle}>{customers.filter((c) => c.active !== false).length}</div>
            <div style={statLabelStyle}>Active</div>
          </div>

          <div style={statCardStyle}>
            <div style={statNumberStyle}>{customers.filter((c) => c.active === false).length}</div>
            <div style={statLabelStyle}>Inactive</div>
          </div>
        </section>

        <section style={cardStyle}>
          <h2 style={sectionTitleStyle}>{accountNo ? `Edit Customer: ${accountNo}` : "Add / Update Customer"}</h2>

          <div style={formGridStyle}>
            <Input label="Account No" value={accountNo} onChange={(v) => setAccountNo(v.toUpperCase())} placeholder="FL111" />
            <Input label="Store Name" value={storeName} onChange={setStoreName} placeholder="Kim Lee" />
            <Input label="Password" value={password} onChange={setPassword} placeholder="1118" />
            <Input label="Email" value={email} onChange={setEmail} placeholder="Optional" />
            <Input label="Phone" value={phone} onChange={setPhone} placeholder="Optional" />

            <div>
              <label style={labelStyle}>Status</label>
              <select value={active ? "active" : "inactive"} onChange={(e) => setActive(e.target.value === "active")} style={inputStyle}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>Note</label>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional internal note" style={{ ...inputStyle, minHeight: 76 }} />
            </div>
          </div>

          <div style={buttonRowStyle}>
            <button type="button" onClick={saveCustomer} disabled={loading} style={primaryButtonStyle}>
              {loading ? "Saving..." : "Save Customer"}
            </button>

            <button type="button" onClick={clearForm} style={secondaryButtonStyle}>
              Clear
            </button>

            <button type="button" onClick={() => loadCustomers()} style={secondaryButtonStyle}>
              Refresh
            </button>

            {accountNo ? (
              <button type="button" onClick={() => deleteCustomer(accountNo)} style={dangerButtonStyle}>
                Delete
              </button>
            ) : null}
          </div>

          {msg ? (
            <div
              style={{
                marginTop: 12,
                fontSize: 13,
                fontWeight: 800,
                color:
                  msg.toLowerCase().includes("failed") ||
                  msg.toLowerCase().includes("unauthorized") ||
                  msg.toLowerCase().includes("invalid")
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
            placeholder="Search account, store, email, phone..."
            style={{ ...inputStyle, marginTop: 12, marginBottom: 12 }}
          />

          <div style={listStyle}>
            {filteredCustomers.map((c) => (
              <button key={c.accountNo} type="button" onClick={() => selectCustomer(c)} style={customerCardStyle}>
                <div>
                  <div style={customerTitleStyle}>{c.accountNo} · {c.storeName || "-"}</div>
                  <div style={customerMetaStyle}>Password: {c.password || "-"}</div>
                  <div style={customerMetaStyle}>Email: {c.email || "-"} · Phone: {c.phone || "-"}</div>
                  {c.note ? <div style={customerNoteStyle}>{c.note}</div> : null}
                </div>

                <span style={getStatusBadgeStyle(c.active !== false)}>{c.active !== false ? "ACTIVE" : "INACTIVE"}</span>
              </button>
            ))}

            {filteredCustomers.length === 0 ? <div style={emptyStyle}>No customers found.</div> : null}
          </div>
        </section>
      </div>
    </main>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={inputStyle} />
    </div>
  );
}

function getStatusBadgeStyle(active: boolean): React.CSSProperties {
  return {
    padding: "4px 9px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 900,
    whiteSpace: "nowrap",
    background: active ? "#ecfdf5" : "#fef2f2",
    color: active ? "#059669" : "#dc2626",
    border: active ? "1px solid #a7f3d0" : "1px solid #fecaca",
  };
}

const loginPageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "linear-gradient(180deg, #f8fafc 0%, #eef4ff 100%)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 18,
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
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
  width: 64,
  height: 64,
  borderRadius: 18,
  background: "#2563eb",
  color: "#ffffff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 18,
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
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
};

const containerStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 980,
  margin: "0 auto",
  display: "flex",
  flexDirection: "column",
  gap: 14,
};

const headerStyle: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e5e7eb",
  borderRadius: 18,
  padding: 18,
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
  gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
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

const buttonRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
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

const dangerButtonStyle: React.CSSProperties = {
  border: "1px solid #fecaca",
  background: "#fef2f2",
  color: "#b91c1c",
  borderRadius: 12,
  padding: "11px 15px",
  fontSize: 14,
  fontWeight: 900,
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

const listStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  maxHeight: 620,
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

const customerNoteStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#374151",
  marginTop: 6,
  background: "#f9fafb",
  borderRadius: 10,
  padding: 8,
};

const emptyStyle: React.CSSProperties = {
  padding: 16,
  textAlign: "center",
  color: "#6b7280",
  background: "#f9fafb",
  borderRadius: 12,
};

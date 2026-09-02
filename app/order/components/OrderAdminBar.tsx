"use client";

type AdminBarCopy = {
  adminLogin: string;
  adminPassword: string;
  adminLoginSubmit: string;
  adminLogout: string;
  adminRemember: string;
  adminEditingHint: string;
};

export function OrderAdminBar({
  t,
  loggedIn,
  open,
  onToggle,
  password,
  onPasswordChange,
  remember,
  onRememberChange,
  loading,
  error,
  onLogin,
  onLogout,
}: {
  t: AdminBarCopy;
  loggedIn: boolean;
  open: boolean;
  onToggle: () => void;
  password: string;
  onPasswordChange: (value: string) => void;
  remember: boolean;
  onRememberChange: (value: boolean) => void;
  loading: boolean;
  error: string;
  onLogin: () => void;
  onLogout: () => void;
}) {
  return (
    <div className={`order-admin-bar${loggedIn ? " is-on" : ""}`}>
      <div className="order-admin-bar-row">
        {loggedIn ? (
          <>
            <span className="order-admin-bar-badge">{t.adminLogin}</span>
            <span className="order-admin-bar-hint">{t.adminEditingHint}</span>
            <button type="button" className="order-admin-bar-btn" onClick={onLogout}>
              {t.adminLogout}
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className={`order-admin-bar-btn${open ? " is-open" : ""}`}
              onClick={onToggle}
              aria-expanded={open}
            >
              {t.adminLogin}
            </button>
            {open ? (
              <form
                className="order-admin-bar-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  onLogin();
                }}
              >
                <input
                  type="password"
                  value={password}
                  onChange={(e) => onPasswordChange(e.target.value)}
                  placeholder={t.adminPassword}
                  autoComplete="current-password"
                  className="order-admin-bar-input"
                  aria-label={t.adminPassword}
                />
                <label className="order-admin-bar-remember">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => onRememberChange(e.target.checked)}
                  />
                  {t.adminRemember}
                </label>
                <button type="submit" className="order-admin-bar-submit" disabled={loading || !password.trim()}>
                  {t.adminLoginSubmit}
                </button>
              </form>
            ) : null}
          </>
        )}
      </div>
      {error ? <div className="order-admin-bar-error">{error}</div> : null}
    </div>
  );
}

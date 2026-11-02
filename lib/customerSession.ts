const REMEMBER_KEY = "customer_access_remember";
const LOGGED_IN_KEY = "customer_logged_in";
const ACCOUNT_KEY = "customer_account_no";
const STORE_KEY = "customer_store_name";
const EMAIL_KEY = "customer_order_email";

export type CustomerSession = {
  accountNo: string;
  storeName: string;
  orderEmail: string;
};

function readFrom(store: Storage): CustomerSession | null {
  try {
    if (store.getItem(LOGGED_IN_KEY) !== "true") return null;
    const accountNo = store.getItem(ACCOUNT_KEY) || "";
    if (!accountNo) return null;
    return {
      accountNo,
      storeName: store.getItem(STORE_KEY) || "",
      orderEmail: store.getItem(EMAIL_KEY) || "",
    };
  } catch {
    return null;
  }
}

function writeTo(store: Storage, session: CustomerSession) {
  store.setItem(LOGGED_IN_KEY, "true");
  store.setItem(ACCOUNT_KEY, session.accountNo);
  store.setItem(STORE_KEY, session.storeName);
  store.setItem(EMAIL_KEY, session.orderEmail);
}

function removeFrom(store: Storage) {
  store.removeItem(LOGGED_IN_KEY);
  store.removeItem(ACCOUNT_KEY);
  store.removeItem(STORE_KEY);
  store.removeItem(EMAIL_KEY);
}

/** Active customer session: sessionStorage first, then remembered localStorage. */
export function readCustomerSession(): CustomerSession | null {
  try {
    const fromSession = readFrom(sessionStorage);
    if (fromSession) return fromSession;

    if (localStorage.getItem(REMEMBER_KEY) !== "1") return null;
    const remembered = readFrom(localStorage);
    if (!remembered) return null;

    // Hydrate the current tab so the rest of the app can keep using sessionStorage.
    writeTo(sessionStorage, remembered);
    return remembered;
  } catch {
    return null;
  }
}

export function saveCustomerSession(session: CustomerSession, rememberMe: boolean) {
  try {
    removeFrom(sessionStorage);
    removeFrom(localStorage);
    localStorage.removeItem(REMEMBER_KEY);

    writeTo(sessionStorage, session);
    localStorage.setItem("last_account_no", session.accountNo);

    if (rememberMe) {
      writeTo(localStorage, session);
      localStorage.setItem(REMEMBER_KEY, "1");
    } else {
      localStorage.setItem(REMEMBER_KEY, "0");
    }
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearCustomerSession() {
  try {
    removeFrom(sessionStorage);
    removeFrom(localStorage);
    localStorage.removeItem(REMEMBER_KEY);
  } catch {
    /* ignore */
  }
}

/** Keep order email in sync after profile fetch. */
export function updateCustomerOrderEmail(orderEmail: string) {
  try {
    sessionStorage.setItem(EMAIL_KEY, orderEmail);
    if (localStorage.getItem(REMEMBER_KEY) === "1") {
      localStorage.setItem(EMAIL_KEY, orderEmail);
    }
  } catch {
    /* ignore */
  }
}

import { auth, API_BASE } from './firebase';

/**
 * 取得當前用戶的 Firebase ID Token 並附加到請求 Header
 * 所有需要身份驗證的 API 呼叫都透過此函式
 */
async function authFetch(url, options = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  const token = await user.getIdToken();
  return fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
}

// ============================================================
// Client API
// ============================================================

export async function saveCredentials(payload) {
  const res = await authFetch("/user/credentials", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function setActiveStatus(isActive) {
  const res = await authFetch("/user/active-status", {
    method: "POST",
    body: JSON.stringify({ is_active: isActive }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ============================================================
// Admin API
// ============================================================

export async function adminGetAllUsers() {
  const res = await authFetch("/admin/users");
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function adminSetUserActive(uid, isActive) {
  const res = await authFetch("/admin/users/active", {
    method: "POST",
    body: JSON.stringify({ uid, is_active: isActive }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function adminSetUserPaid(uid, isPaid) {
  const res = await authFetch("/admin/users/paid", {
    method: "POST",
    body: JSON.stringify({ uid, is_paid: isPaid }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function adminGetWatchlist() {
  const res = await authFetch("/admin/watchlist");
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function adminUpdateWatchlist(symbols) {
  const res = await authFetch("/admin/watchlist", {
    method: "POST",
    body: JSON.stringify({ symbols }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function adminGetStrategy() {
  const res = await authFetch("/admin/strategy");
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function adminUpdateStrategy(script) {
  const res = await authFetch("/admin/strategy", {
    method: "POST",
    body: JSON.stringify({ script }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

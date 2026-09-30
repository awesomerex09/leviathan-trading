/**
 * adminDb.js
 * Admin 直接寫入 Firestore（不需要後端伺服器）
 * 用途：Watchlist 和 Strategy 的讀寫，Admin 已有 Firebase 身份，可以直接操作
 * 這樣不管後端伺服器有沒有啟動，Admin 功能都正常
 */
import { db, auth, ADMIN_UID } from './firebase';
import { doc, getDoc, setDoc, collection, getDocs, serverTimestamp } from 'firebase/firestore';

function assertAdmin() {
  const user = auth.currentUser;
  if (!user || user.uid !== ADMIN_UID) {
    throw new Error('Unauthorized: Admin only');
  }
}

// ── Watchlist ──────────────────────────────────────────────

export async function adminDbGetWatchlist() {
  assertAdmin();
  const snap = await getDoc(doc(db, 'watchlist', 'config'));
  if (!snap.exists()) return { symbols: [] };
  return { symbols: snap.data().symbols || [] };
}

export async function adminDbUpdateWatchlist(symbols) {
  assertAdmin();
  await setDoc(doc(db, 'watchlist', 'config'), {
    symbols,
    updated_at: serverTimestamp(),
  });
  return { success: true };
}

// ── Strategy ───────────────────────────────────────────────

export async function adminDbGetStrategy() {
  assertAdmin();
  const snap = await getDoc(doc(db, 'strategy', 'v6'));
  if (!snap.exists()) return { script: '' };
  return { script: snap.data().script || '' };
}

export async function adminDbUpdateStrategy(script) {
  assertAdmin();
  await setDoc(doc(db, 'strategy', 'v6'), {
    script,
    updated_at: serverTimestamp(),
  });
  return { success: true };
}

// ── Users (summary, fallback when backend offline) ─────────

export async function adminDbGetAllUsers() {
  assertAdmin();
  const snap = await getDocs(collection(db, 'users'));
  return snap.docs.map(d => ({ uid: d.id, ...d.data(), orders: [] }));
}

export async function adminDbSetUserActive(uid, isActive) {
  assertAdmin();
  await setDoc(doc(db, 'users', uid), { isActive }, { merge: true });
  return { success: true };
}

export async function adminDbSetUserPaid(uid, isPaid) {
  assertAdmin();
  await setDoc(doc(db, 'users', uid), { isPaid }, { merge: true });
  return { success: true };
}

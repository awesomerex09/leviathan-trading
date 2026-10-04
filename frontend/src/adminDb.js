/**
 * adminDb.js
 * Admin 直接讀寫 Firestore（不需要後端伺服器）
 * Admin 用 Firebase 身份直接操作所有集合
 */
import { db, auth, ADMIN_UID } from './firebase';
import {
  doc, getDoc, setDoc, collection, getDocs,
  serverTimestamp, query, orderBy, limit,
} from 'firebase/firestore';

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

// ── Users ──────────────────────────────────────────────────

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

// ── Signals（LVIS 策略訊號紀錄）──────────────────────────

export async function adminDbGetSignals(limitCount = 50) {
  assertAdmin();
  try {
    const q = query(
      collection(db, 'signals'),
      orderBy('timestamp', 'desc'),
      limit(limitCount),
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch {
    // 若 index 未建立，fallback 不排序
    const snap = await getDocs(collection(db, 'signals'));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''))
      .slice(0, limitCount);
  }
}

// ── Sim Orders（模擬委託紀錄）────────────────────────────

export async function adminDbGetSimOrders(limitCount = 50) {
  assertAdmin();
  try {
    const q = query(
      collection(db, 'sim_orders'),
      orderBy('timestamp', 'desc'),
      limit(limitCount),
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch {
    const snap = await getDocs(collection(db, 'sim_orders'));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''))
      .slice(0, limitCount);
  }
}

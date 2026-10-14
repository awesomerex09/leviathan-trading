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

// ── Strategy script（文字說明，僅供參考）─────────────────

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

// ── Strategy params（即時生效！Python 後端執行時自動讀取）────

export const STRATEGY_PARAM_SCHEMA = [
  { key: 'ema_fast',        label: 'EMA 快線週期',            type: 'int',   default: 20,    min: 5,    max: 200, desc: '趨勢判斷快線，越小反應越快' },
  { key: 'ema_slow',        label: 'EMA 慢線週期',            type: 'int',   default: 60,    min: 10,   max: 500, desc: '趨勢判斷慢線' },
  { key: 'atr_len',         label: 'ATR 週期',                type: 'int',   default: 14,    min: 5,    max: 50,  desc: '計算波動度的 ATR 窗口' },
  { key: 'pivot_side',      label: 'Pivot 確認 K 棒數',       type: 'int',   default: 11,    min: 3,    max: 30,  desc: '左右各幾根確認樞軸低點' },
  { key: 'vol_factor',      label: '高量過濾倍率',             type: 'float', default: 1.1,   min: 1.0,  max: 3.0, desc: '成交量高於均量幾倍才算支撐' },
  { key: 'threshold_high',  label: '結構入場距離上限',         type: 'float', default: 0.08,  min: 0.02, max: 0.20, desc: '距支撐幾 % 以內可入場（0.08 = 8%）' },
  { key: 'threshold_low',   label: '結構入場距離下限',         type: 'float', default: -0.02, min: -0.10, max: 0, desc: '防止在支撐下方入場' },
  { key: 'risk_pct',        label: '每筆風險比例',             type: 'float', default: 0.20,  min: 0.01, max: 0.50, desc: '每筆交易最多虧損幾 % 資金' },
  { key: 'pyramiding',      label: '最大加碼次數',             type: 'int',   default: 4,     min: 1,    max: 6,  desc: '最多加碼幾次（1 = 不加碼）' },
  { key: 'cooling_period',  label: '出場冷卻 K 棒',           type: 'int',   default: 20,    min: 0,    max: 100, desc: '出場後幾根 K 棒內不再入場' },
  { key: 'donchian_period', label: 'Donchian 止損週期',       type: 'int',   default: 60,    min: 10,   max: 200, desc: '止損以幾根 K 棒最低點為準' },
  { key: 'commission',      label: '手續費率',                 type: 'float', default: 0.005, min: 0,    max: 0.05, desc: '單邊手續費 0.005 = 0.5%' },
  { key: 'regime_window',   label: '動態槓桿回溯窗口',         type: 'int',   default: 60,    min: 10,   max: 200, desc: '計算相對回撤用的 K 棒數' },
  { key: 'initial_capital', label: '初始資金（回測用）',       type: 'int',   default: 1000000, min: 10000, max: 100000000, desc: '模擬資金，不影響實盤' },
];

export async function adminDbGetStrategyParams() {
  assertAdmin();
  const snap = await getDoc(doc(db, 'strategy', 'params'));
  if (!snap.exists()) {
    // 回傳預設值
    return Object.fromEntries(STRATEGY_PARAM_SCHEMA.map(p => [p.key, p.default]));
  }
  const data = snap.data();
  // 確保每個參數都有值（用 schema default 填補缺漏）
  const merged = Object.fromEntries(STRATEGY_PARAM_SCHEMA.map(p => [p.key, data[p.key] ?? p.default]));
  return merged;
}

export async function adminDbUpdateStrategyParams(params) {
  assertAdmin();
  await setDoc(doc(db, 'strategy', 'params'), {
    ...params,
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

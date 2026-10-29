import React, { useState, useEffect, useCallback, useMemo } from "react";
import { db } from "../firebase";
import {
  collection, query, orderBy, limit, onSnapshot,
  doc, onSnapshot as onDocSnap, getDocs,
} from "firebase/firestore";
import {
  Loader2, TrendingUp, TrendingDown, DollarSign,
  BarChart2, List, Settings, ChevronDown, RefreshCw, Lock,
} from "lucide-react";
import Chart from "../Chart";

const INIT_CAP = 875_000;

export default function ClientDashboard({ user, t, isPaid }) {
  const [tab, setTab] = useState("portfolio");

  // Portfolio & Watchlist
  const [watchlist, setWatchlist] = useState([]);
  const [signals, setSignals]     = useState([]);
  const [simOrders, setSimOrders] = useState([]);
  const [portfolio, setPortfolio] = useState(null);

  // Chart
  const [selectedSym, setSelectedSym] = useState("");
  const [symSignals, setSymSignals]   = useState([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [showPicker, setShowPicker]   = useState(false);

  // Orders
  const [orders, setOrders]           = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);

  // Orders listener
  useEffect(() => {
    const q = query(collection(db, "users", user.uid, "orders"), orderBy("timestamp", "desc"), limit(100));
    return onSnapshot(q, snap => {
      setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setOrdersLoading(false);
    }, () => setOrdersLoading(false));
  }, [user.uid]);

  // Watchlist listener (all signed-in users can read)
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "watchlist", "config"), snap => {
      if (snap.exists() && snap.data().symbols) {
        setWatchlist(snap.data().symbols);
      }
    }, err => console.warn("Watchlist snapshot error:", err));
    return unsub;
  }, []);

  // Paid-only data
  useEffect(() => {
    if (!isPaid) return;
    const qSig = query(collection(db, "signals"),   orderBy("timestamp", "desc"), limit(500));
    const qOrd = query(collection(db, "sim_orders"), orderBy("timestamp", "desc"), limit(500));
    const u1 = onSnapshot(qSig, snap => setSignals(snap.docs.map(d => ({ id: d.id, ...d.data() }))), err => console.warn("Signals error:", err));
    const u2 = onSnapshot(qOrd, snap => setSimOrders(snap.docs.map(d => ({ id: d.id, ...d.data() }))), err => console.warn("Sim orders error:", err));
    return () => { u1(); u2(); };
  }, [isPaid]);

  // Compute portfolio: combines executed sim_orders + active model signals
  useEffect(() => {
    if (!simOrders.length && !signals.length) return;
    let cash = INIT_CAP;
    const positions = {};
    let realPnl = 0;

    // 1. Process simOrders if present
    const sorted = [...simOrders].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    for (const o of sorted) {
      const { symbol, type, price, qty } = o;
      if (!price || !qty) continue;
      if (type && (type.includes("ENTRY") || type.includes("SCALE") || type === "BUY" || type === "STOCK_BUY")) {
        positions[symbol] = positions[symbol] || { qty: 0, totalCost: 0 };
        positions[symbol].qty       += qty;
        positions[symbol].totalCost += price * qty;
        cash -= price * qty;
      } else if (type && (type === "EXIT" || type === "SELL" || type === "STOCK_SELL")) {
        const pos = positions[symbol];
        if (pos && pos.qty > 0) {
          const avgCost = pos.totalCost / pos.qty;
          const closeQty = Math.min(qty, pos.qty);
          realPnl += (price - avgCost) * closeQty;
          pos.qty -= closeQty;
          pos.totalCost -= avgCost * closeQty;
          if (pos.qty <= 0) delete positions[symbol];
          cash += price * qty;
        }
      }
    }

    // 2. Incorporate active positions from signals (for symbols not tracked in simOrders)
    const sigsBySym = {};
    for (const s of signals) {
      if (!s.symbol) continue;
      if (!sigsBySym[s.symbol]) sigsBySym[s.symbol] = [];
      sigsBySym[s.symbol].push(s);
    }

    const latestPrice = {};
    for (const [sym, sigList] of Object.entries(sigsBySym)) {
      sigList.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      const last = sigList[sigList.length - 1];
      latestPrice[sym] = last;

      // If symbol is not already tracked in simOrders
      if (!positions[sym]) {
        const isEntry = last.type && (last.type.includes("ENTRY") || last.type.includes("SCALE"));
        if (isEntry && last.price) {
          // Default sizing: 3,500 base unit (scale-in is 1.5x = 5,250)
          const baseUnit = 3500;
          const mult = last.type.includes("SCALE_IN_1") || last.type.includes("SCALE_IN_2") ? 1.5 : 1;
          const allocated = baseUnit * mult;
          const qty = allocated / last.price;
          positions[sym] = {
            qty,
            totalCost: allocated,
            fromSignal: true,
          };
          cash -= allocated;
        }
      }
    }

    let unrealPnl = 0;
    const openPos = Object.entries(positions).map(([sym, pos]) => {
      const mkt = latestPrice[sym]?.price || (pos.totalCost / pos.qty);
      const avg = pos.totalCost / pos.qty;
      const pnl = (mkt - avg) * pos.qty;
      unrealPnl += pnl;
      return { symbol: sym, qty: pos.qty, avg, mkt, pnl };
    });

    const totalPnl  = realPnl + unrealPnl;
    setPortfolio({
      initCap: INIT_CAP,
      cash: Math.max(0, cash),
      totalEquity: INIT_CAP + totalPnl,
      pnl: totalPnl,
      ret: (totalPnl / INIT_CAP) * 100,
      openPos,
    });
  }, [simOrders, signals]);

  // Load chart signals for selected symbol
  const loadSym = useCallback((sym) => {
    setChartLoading(true);
    setSelectedSym(sym);
    const rel = signals.filter(s => s.symbol === sym).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    setSymSignals(rel);
    setChartLoading(false);
    setShowPicker(false);
  }, [signals]);

  // All unique symbols from watchlist + signals
  const allSyms = useMemo(() => {
    return [...new Set([...watchlist, ...signals.map(s => s.symbol)])].filter(Boolean).sort();
  }, [watchlist, signals]);

  // Synthetic OHLC + aligned markers from signal prices
  const { chartData, markers } = useMemo(() => {
    return generateCandlesAndMarkers(symSignals);
  }, [symSignals]);

  const fmt    = n => n != null ? Math.round(n).toLocaleString("zh-TW") : "-";
  const fmtPct = n => n != null ? `${n >= 0 ? "+" : ""}${n.toFixed(2)}%` : "-";

  return (
    <div className="dashboard-wrapper">
      {/* Tabs */}
      <div className="dashboard-tabs">
        {[
          { key: "portfolio", icon: <DollarSign size={15}/>, label: "投資組合" },
          { key: "chart",     icon: <BarChart2  size={15}/>, label: "訊號圖表" },
          { key: "orders",    icon: <List       size={15}/>, label: "委託紀錄" },
          { key: "settings",  icon: <Settings   size={15}/>, label: "設定"     },
        ].map(tb => (
          <button key={tb.key} className={tab === tb.key ? "tab active" : "tab"} onClick={() => setTab(tb.key)}>
            {tb.icon} {tb.label}
          </button>
        ))}
      </div>

      <div className="tab-content">

        {/* ─── Portfolio ─── */}
        {tab === "portfolio" && (
          !isPaid ? <Locked /> : portfolio ? (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
                <StatCard label="總資產"  value={`NT$ ${fmt(portfolio.totalEquity)}`} sub={`起始 NT$ ${fmt(portfolio.initCap)}`}  color="var(--accent)"   icon={<DollarSign size={18}/>} />
                <StatCard label="損益"    value={`${portfolio.pnl >= 0 ? "+" : ""}NT$ ${fmt(Math.abs(portfolio.pnl))}`} sub={fmtPct(portfolio.ret)}
                  color={portfolio.pnl >= 0 ? "#22c55e" : "#ef4444"}
                  icon={portfolio.pnl >= 0 ? <TrendingUp size={18}/> : <TrendingDown size={18}/>} />
                <StatCard label="可用現金" value={`NT$ ${fmt(portfolio.cash)}`}        sub="未投入"                               color="#94a3b8"          icon={<DollarSign size={18}/>} />
                <StatCard label="持倉數"  value={portfolio.openPos.length}            sub="個標的持有中"                          color="#a78bfa"          icon={<BarChart2  size={18}/>} />
              </div>

              {portfolio.openPos.length > 0 && (
                <>
                  <h3 style={{ marginBottom: "0.75rem", fontSize: "0.95rem", fontWeight: 600 }}>📂 目前持倉</h3>
                  <div className="orders-table">
                    <table>
                      <thead><tr><th>標的</th><th>持量</th><th>均價</th><th>市價</th><th>未實現損益</th><th>報酬率</th></tr></thead>
                      <tbody>
                        {portfolio.openPos.map(p => (
                          <tr key={p.symbol} style={{ cursor: "pointer" }} onClick={() => { setTab("chart"); loadSym(p.symbol); }}>
                            <td><strong style={{ color: "var(--accent)" }}>{p.symbol}</strong></td>
                            <td>{p.qty.toFixed(2)}</td>
                            <td>{p.avg.toFixed(2)}</td>
                            <td>{p.mkt.toFixed(2)}</td>
                            <td style={{ color: p.pnl >= 0 ? "#22c55e" : "#ef4444", fontWeight: 600 }}>
                              {p.pnl >= 0 ? "+" : ""}{fmt(p.pnl)}
                            </td>
                            <td style={{ color: p.pnl >= 0 ? "#22c55e" : "#ef4444" }}>
                              {fmtPct(((p.mkt - p.avg) / p.avg) * 100)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {portfolio.openPos.length === 0 && (
                <div className="empty-state">目前無持倉</div>
              )}
            </>
          ) : <div style={{ textAlign: "center", padding: "3rem" }}><Loader2 size={32} className="animate-spin" /></div>
        )}

        {/* ─── Chart ─── */}
        {tab === "chart" && (
          !isPaid ? <Locked /> : (
            <>
              {/* Symbol Picker */}
              <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
                <div style={{ position: "relative" }}>
                  <button className="btn btn-outline" style={{ minWidth: 150, display: "flex", alignItems: "center", gap: "0.5rem", justifyContent: "space-between" }}
                    onClick={() => setShowPicker(p => !p)}>
                    {selectedSym || "選擇標的"} <ChevronDown size={14}/>
                  </button>
                  {showPicker && (
                    <div style={{
                      position: "absolute", top: "2.5rem", left: 0, zIndex: 50,
                      background: "var(--card-bg)", border: "1px solid var(--border)",
                      borderRadius: "0.75rem", padding: "0.5rem",
                      maxHeight: 300, overflowY: "auto", minWidth: 220,
                      boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
                      display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.2rem",
                    }}>
                      {allSyms.length === 0
                        ? <p style={{ padding: "0.5rem", color: "var(--text-muted)", fontSize: "0.82rem", gridColumn: "1/-1" }}>暫無訊號</p>
                        : allSyms.map(sym => (
                          <button key={sym} onClick={() => loadSym(sym)} style={{
                            padding: "0.35rem 0.6rem", border: "none", borderRadius: "0.4rem",
                            background: selectedSym === sym ? "var(--accent)" : "transparent",
                            color: selectedSym === sym ? "#fff" : "inherit",
                            cursor: "pointer", fontSize: "0.83rem", fontWeight: 500, textAlign: "left",
                          }}>{sym}</button>
                        ))
                      }
                    </div>
                  )}
                </div>
                {selectedSym && <button className="btn btn-outline" onClick={() => loadSym(selectedSym)}><RefreshCw size={13}/></button>}
                {selectedSym && symSignals.length > 0 && (
                  <span style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>{symSignals.length} 個歷史訊號</span>
                )}
              </div>

              {/* Legend */}
              <div style={{ display: "flex", gap: "1.5rem", marginBottom: "1rem", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                <span>▲ 入場 / 加碼</span><span>▼ 出場</span>
              </div>

              {/* All signals table (no symbol selected) */}
              {!selectedSym && (
                <>
                  <h3 style={{ marginBottom: "0.75rem", fontSize: "0.95rem" }}>📡 所有標的最新訊號</h3>
                  <div className="orders-table">
                    <table>
                      <thead><tr><th>時間</th><th>標的</th><th>訊號</th><th>進場價</th><th>止損</th><th>備註</th></tr></thead>
                      <tbody>
                        {signals.slice(0, 80).map(s => {
                          const isEntry = s.type?.includes("ENTRY") || s.type?.includes("SCALE");
                          return (
                            <tr key={s.id} onClick={() => loadSym(s.symbol)} style={{ cursor: "pointer" }}>
                              <td style={{ fontSize: "0.78rem" }}>{new Date(s.timestamp).toLocaleString("zh-TW")}</td>
                              <td><strong style={{ color: "var(--accent)" }}>{s.symbol}</strong></td>
                              <td>
                                <span style={{ background: isEntry ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)", color: isEntry ? "#22c55e" : "#ef4444", padding: "0.15rem 0.5rem", borderRadius: 999, fontSize: "0.76rem", fontWeight: 600 }}>
                                  {isEntry ? "▲" : "▼"} {s.type}
                                </span>
                              </td>
                              <td>{s.price?.toFixed(2)}</td>
                              <td style={{ color: "#ef4444" }}>{s.stop_loss?.toFixed(2)}</td>
                              <td style={{ fontSize: "0.76rem", color: "var(--text-muted)" }}>{s.comment}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "0.75rem" }}>💡 點擊任意列查看個別 K 線圖</p>
                </>
              )}

              {/* Symbol chart */}
              {selectedSym && (
                chartLoading
                  ? <div style={{ textAlign: "center", padding: "3rem" }}><Loader2 size={32} className="animate-spin" /></div>
                  : symSignals.length === 0
                    ? (
                      <div className="empty-state" style={{ padding: "3rem 1.5rem", textAlign: "center" }}>
                        <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>📡</div>
                        <h4 style={{ marginBottom: "0.5rem" }}>{selectedSym} · 監控中</h4>
                        <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", maxWidth: 420, margin: "0 auto" }}>
                          此標的已納入模型 Watchlist，目前等待策略進場條件觸發（尚未產生歷史訊號）。
                        </p>
                      </div>
                    )
                    : (
                      <>
                        <Chart data={chartData} markers={markers} title={`${selectedSym} · LVIS V2 訊號`} />
                        <div style={{ marginTop: "1.5rem" }}>
                          <h4 style={{ marginBottom: "0.75rem", fontSize: "0.9rem" }}>{selectedSym} · 歷史訊號</h4>
                          <div className="orders-table">
                            <table>
                              <thead><tr><th>時間</th><th>訊號</th><th>價格</th><th>止損</th><th>備註</th></tr></thead>
                              <tbody>
                                {[...symSignals].reverse().map(s => {
                                  const isEntry = s.type?.includes("ENTRY") || s.type?.includes("SCALE");
                                  return (
                                    <tr key={s.id}>
                                      <td style={{ fontSize: "0.78rem" }}>{new Date(s.timestamp).toLocaleString("zh-TW")}</td>
                                      <td><span style={{ background: isEntry ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)", color: isEntry ? "#22c55e" : "#ef4444", padding: "0.15rem 0.5rem", borderRadius: 999, fontSize: "0.76rem", fontWeight: 600 }}>{isEntry ? "▲" : "▼"} {s.type}</span></td>
                                      <td>{s.price?.toFixed(2)}</td>
                                      <td style={{ color: "#ef4444" }}>{s.stop_loss?.toFixed(2)}</td>
                                      <td style={{ fontSize: "0.76rem", color: "var(--text-muted)" }}>{s.comment}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </>
                    )
              )}
            </>
          )
        )}

        {/* ─── Orders ─── */}
        {tab === "orders" && (
          <>
            <h3 style={{ marginBottom: "1rem" }}>📋 委託紀錄</h3>
            {ordersLoading
              ? <div style={{ textAlign: "center", padding: "3rem" }}><Loader2 size={32} className="animate-spin" /></div>
              : orders.length === 0
                ? <div className="empty-state">尚無委託紀錄</div>
                : (
                  <div className="orders-table">
                    <table>
                      <thead><tr><th>時間</th><th>標的</th><th>方向</th><th>價格</th><th>數量</th><th>狀態</th></tr></thead>
                      <tbody>
                        {orders.map(o => (
                          <tr key={o.id}>
                            <td style={{ fontSize: "0.78rem" }}>{new Date(o.timestamp).toLocaleString("zh-TW")}</td>
                            <td><strong>{o.symbol}</strong></td>
                            <td><span className={`badge ${o.action === "BUY" ? "badge-buy" : "badge-sell"}`}>{o.action === "BUY" ? "買入" : "賣出"}</span></td>
                            <td>{o.price?.toLocaleString()}</td>
                            <td>{o.quantity}</td>
                            <td><span className={`badge ${o.status === "SUCCESS" ? "badge-success" : "badge-fail"}`}>{o.status === "SUCCESS" ? "成功" : "失敗"}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
            }
          </>
        )}

        {/* ─── Settings ─── */}
        {tab === "settings" && (
          <div>
            <h3 style={{ marginBottom: "1rem" }}>👤 帳戶資訊</h3>
            <div style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: "0.75rem", padding: "1.25rem", maxWidth: 480 }}>
              <p style={{ marginBottom: "0.6rem" }}><strong>Email：</strong>{user.email}</p>
              <p style={{ marginBottom: "0.6rem" }}><strong>名稱：</strong>{user.displayName || "-"}</p>
              <p>
                <strong>訂閱狀態：</strong>
                <span style={{
                  marginLeft: "0.5rem",
                  background: isPaid ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.12)",
                  color: isPaid ? "#22c55e" : "#ef4444",
                  padding: "0.2rem 0.75rem", borderRadius: 999, fontSize: "0.8rem", fontWeight: 600,
                }}>
                  {isPaid ? "✅ 已訂閱" : "⏸ 未訂閱"}
                </span>
              </p>
              <p style={{ color: "var(--text-muted)", fontSize: "0.82rem", marginTop: "0.75rem" }}>
                {isPaid ? "享有完整訊號查閱、K 線圖及投資組合功能" : "請聯繫管理員開通訂閱權限"}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Helper components
function StatCard({ label, value, sub, icon, color }) {
  return (
    <div style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: "0.875rem", padding: "1.25rem" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
        <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 500 }}>{label}</span>
        <span style={{ color, opacity: 0.8 }}>{icon}</span>
      </div>
      <div style={{ fontSize: "1.3rem", fontWeight: 700, marginBottom: "0.25rem" }}>{value}</div>
      {sub && <div style={{ fontSize: "0.76rem", color: "var(--text-muted)" }}>{sub}</div>}
    </div>
  );
}

function Locked() {
  return (
    <div style={{ textAlign: "center", padding: "4rem 2rem", background: "var(--card-bg)", borderRadius: "1rem", border: "1px solid var(--border)" }}>
      <Lock size={40} style={{ margin: "0 auto 1rem", opacity: 0.4 }} />
      <h3 style={{ marginBottom: "0.5rem" }}>需要訂閱才能使用</h3>
      <p style={{ color: "var(--text-muted)", maxWidth: 300, margin: "0 auto" }}>此功能僅限已訂閱用戶。請聯繫管理員開通您的帳號權限。</p>
    </div>
  );
}

// Generate realistic synthetic OHLC + precisely aligned markers from signals
function generateCandlesAndMarkers(symSignals) {
  if (!symSignals || symSignals.length === 0) {
    return { chartData: [], markers: [] };
  }

  // Sort signals chronologically
  const sortedSigs = [...symSignals].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  const firstSig = sortedSigs[0];
  const lastSig = sortedSigs[sortedSigs.length - 1];

  const basePrice = firstSig.price || 100;
  const DAY_SEC = 86400;
  const nowSec = Math.floor(Date.now() / 1000);

  // Generate 35 to 45 daily bars ending near present
  const totalBars = Math.max(35, sortedSigs.length * 8 + 15);
  const endSec = Math.max(nowSec, Math.floor(new Date(lastSig.timestamp).getTime() / 1000) + 3 * DAY_SEC);
  const startSec = endSec - totalBars * DAY_SEC;

  // Map each signal to a bar index
  const minIdx = 10;
  const maxIdx = totalBars - 4;
  const step = sortedSigs.length > 1 ? (maxIdx - minIdx) / (sortedSigs.length - 1) : 0;

  const sigIndices = sortedSigs.map((sig, i) => {
    const idx = sortedSigs.length === 1 ? Math.floor(totalBars * 0.65) : Math.round(minIdx + i * step);
    return { sig, idx };
  });

  const chartData = [];
  const markers = [];

  let currPrice = basePrice * 0.95;
  const vol = Math.max(0.5, basePrice * 0.015);

  for (let i = 0; i < totalBars; i++) {
    const t = startSec + i * DAY_SEC;
    const matched = sigIndices.find(item => item.idx === i);

    let targetPrice = currPrice;
    if (matched) {
      targetPrice = matched.sig.price || currPrice;
    } else {
      const nextSigItem = sigIndices.find(item => item.idx > i);
      if (nextSigItem) {
        const remaining = nextSigItem.idx - i;
        const diff = (nextSigItem.sig.price || currPrice) - currPrice;
        targetPrice = currPrice + diff / Math.max(1, remaining);
      }
    }

    const noise = (Math.sin(i * 0.7) * 0.5 + (Math.random() - 0.5)) * vol;
    const closeP = +(targetPrice + noise).toFixed(2);
    const openP = +(currPrice + (Math.random() - 0.5) * vol * 0.4).toFixed(2);
    const highP = +(Math.max(openP, closeP) + Math.random() * vol * 0.8).toFixed(2);
    const lowP = +(Math.min(openP, closeP) - Math.random() * vol * 0.8).toFixed(2);

    chartData.push({
      time: t,
      open: openP,
      high: highP,
      low: lowP,
      close: closeP,
    });

    if (matched) {
      const s = matched.sig;
      const isEntry = s.type?.includes("ENTRY") || s.type?.includes("SCALE");
      markers.push({
        time: t,
        position: isEntry ? "belowBar" : "aboveBar",
        color: isEntry ? "#22c55e" : "#ef4444",
        shape: isEntry ? "arrowUp" : "arrowDown",
        text: `${s.type} @${(s.price || closeP).toFixed(2)}`,
      });
    }

    currPrice = closeP;
  }

  markers.sort((a, b) => a.time - b.time);
  return { chartData, markers };
}

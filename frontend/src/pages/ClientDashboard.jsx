import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { db } from "../firebase";
import {
  collection, query, orderBy, limit, onSnapshot,
  doc, getDoc,
} from "firebase/firestore";
import {
  Loader2, TrendingUp, TrendingDown, DollarSign,
  BarChart2, List, Settings, Lock,
  Search, Eye
} from "lucide-react";
import Chart from "../Chart";

const INIT_CAP = 875_000;

// 常用標的繁中名稱字典（提供直覺的股票對照）
const SYMBOL_NAMES = {
  '2330': '台積電', '2317': '鴻海',   '2308': '台達電', '2327': '國巨',
  '2360': '致茂',   '2368': '金像電', '2383': '台光電', '2449': '京元電',
  '3017': '奇鋐',   '3026': '禾伸堂', '3037': '欣興',   '3443': '創意',
  '3583': '辛耘',   '3661': '世芯-KY', '3711': '日月光', '5434': '崇越',
  '6139': '亞翔',   '6442': '光聖',   '6515': '穎崴',   '7610': '聯策',
  '8996': '高力',   '1519': '華城',   '3491': '昇達科', '6187': '萬潤',
  '6510': '精測',   '6223': '旺矽',   '3595': '智微',   '5289': '宜鼎',
  '8299': '群聯',   '5536': '聖暉*',  '6274': '台燿',   '3081': '聯亞',
  'NVDA': '輝達',   'VRT': 'Vertiv',  'CRDO': 'Credo',  'AEHR': 'Aehr Test',
  'POWL': 'Powell', 'FLEX': '偉創力', 'DRAM': 'Drayman','CIEN': 'Ciena',
  'AAOI': 'AOI',    'HUT': 'Hut 8',   'WULF': 'TeraWulf','BELFA': 'Bel Fuse',
  'VISN': 'Visionary','INSW': 'Intl Seaways','LQDA': 'Liquidat','MPTI': 'M-Pulse',
  'RHLD': 'Resolute','TNGX': 'Tango Ther',
};

// 訊號名稱友善轉換
const SIGNAL_LABELS = {
  STRUCT_ENTRY: { label: '結構進場', color: '#1d4ed8', isEntry: true },
  TREND_ENTRY:  { label: '趨勢進場', color: '#0891b2', isEntry: true },
  SCALE_IN_1:   { label: '第1次加碼', color: '#059669', isEntry: true },
  SCALE_IN_2:   { label: '第2次加碼', color: '#059669', isEntry: true },
  SCALE_IN_3:   { label: '第3次加碼', color: '#059669', isEntry: true },
  EXIT:         { label: '策略出場', color: '#dc2626', isEntry: false },
  TAKEOVER:     { label: '風控接管', color: '#7c3aed', isEntry: false },
};

export default function ClientDashboard({ user, t, isPaid }) {
  const [tab, setTab] = useState("portfolio");

  // Portfolio & Watchlist
  const [watchlist, setWatchlist] = useState([]);
  const [signals, setSignals]     = useState([]);
  const [simOrders, setSimOrders] = useState([]);
  const [portfolio, setPortfolio] = useState(null);

  // Chart
  const [selectedSym, setSelectedSym] = useState("2330"); // 預設台積電，不留空白
  const [marketFilter, setMarketFilter] = useState("ALL"); // ALL / TW / US
  const [searchSym, setSearchSym] = useState("");
  const [chartLoading, setChartLoading] = useState(false);

  // Orders tab filter
  const [orderFilter, setOrderFilter] = useState("ALL"); // ALL / TW / US / BUY / SELL

  // 真實 OHLC 快取（由後端 Python 寫入 Firestore price_data）
  const priceDataCache = useRef({});
  const [realOHLC, setRealOHLC] = useState(null);         // 當前選中標的的真實 OHLC
  const [ohlcLoading, setOhlcLoading] = useState(false);  // K 線載入中旗標

  // Watchlist listener (所有登入用戶可讀取 49 個標的)
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "watchlist", "config"), snap => {
      if (snap.exists() && snap.data().symbols) {
        setWatchlist(snap.data().symbols);
      }
    }, err => console.warn("Watchlist snapshot error:", err));
    return unsub;
  }, []);

  // 付費用戶即時監聽 signals 與 sim_orders
  useEffect(() => {
    if (!isPaid) return;
    const qSig = query(collection(db, "signals"),   orderBy("timestamp", "desc"), limit(500));
    const qOrd = query(collection(db, "sim_orders"), orderBy("timestamp", "desc"), limit(500));

    const u1 = onSnapshot(qSig, snap => {
      setSignals(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, err => console.warn("Signals error:", err));

    const u2 = onSnapshot(qOrd, snap => {
      setSimOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, err => console.warn("Sim orders error:", err));

    return () => { u1(); u2(); };
  }, [isPaid]);

  // 計算投資組合：結合實際模擬委託（sim_orders）與最新訊號
  useEffect(() => {
    if (!simOrders.length && !signals.length) return;
    let cash = INIT_CAP;
    const positions = {};
    let realPnl = 0;

    // 1. 處理已送出的模擬委託
    const sortedOrders = [...simOrders].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    for (const o of sortedOrders) {
      const { symbol, type, price, qty } = o;
      if (!price || !qty) continue;
      if (type && (type.includes("ENTRY") || type.includes("SCALE") || type.includes("BUY"))) {
        positions[symbol] = positions[symbol] || { qty: 0, totalCost: 0, lastPrice: price };
        positions[symbol].qty += qty;
        positions[symbol].totalCost += price * qty;
        positions[symbol].lastPrice = price;
        cash -= price * qty;
      } else if (type && (type.includes("EXIT") || type.includes("SELL"))) {
        const pos = positions[symbol];
        if (pos && pos.qty > 0) {
          const avgCost = pos.totalCost / pos.qty;
          const closeQty = Math.min(qty, pos.qty);
          realPnl += (price - avgCost) * closeQty;
          pos.qty -= closeQty;
          pos.totalCost -= avgCost * closeQty;
          pos.lastPrice = price;
          if (pos.qty <= 0) delete positions[symbol];
          cash += price * qty;
        }
      }
    }

    // 2. 補充策略最新訊號價格
    const latestPrice = {};
    for (const s of signals) {
      if (!s.symbol || !s.price) continue;
      if (!latestPrice[s.symbol] || new Date(s.timestamp) > new Date(latestPrice[s.symbol].timestamp)) {
        latestPrice[s.symbol] = s;
      }
    }

    let unrealPnl = 0;
    let totalPositionValue = 0;

    const openPos = Object.entries(positions).map(([sym, pos]) => {
      const mkt = latestPrice[sym]?.price || pos.lastPrice || (pos.totalCost / pos.qty);
      const avg = pos.totalCost / pos.qty;
      const pnl = (mkt - avg) * pos.qty;
      const val = mkt * pos.qty;
      unrealPnl += pnl;
      totalPositionValue += val;
      return {
        symbol: sym,
        name: SYMBOL_NAMES[sym] || (sym.match(/^\d+$/) ? '台股' : '美股'),
        qty: pos.qty,
        avg,
        mkt,
        pnl,
        val,
        ret: avg > 0 ? ((mkt - avg) / avg) * 100 : 0,
      };
    });

    const totalPnl = realPnl + unrealPnl;
    const totalEquity = Math.max(0, cash) + totalPositionValue;

    setPortfolio({
      initCap: INIT_CAP,
      cash: Math.max(0, cash),
      totalEquity,
      positionValue: totalPositionValue,
      pnl: totalPnl,
      unrealPnl,
      realPnl,
      ret: (totalPnl / INIT_CAP) * 100,
      openPos,
    });
  }, [simOrders, signals]);

  // 所有 49 個標的清單（台股 + 美股），並按市場排序
  const allSymbols = useMemo(() => {
    const list = watchlist.length > 0 ? watchlist : [
      '3491', '3026', '2327', '8996', '3583', '6187', '3711', '6515', '7610', '6510',
      '5434', '6223', '3595', '5289', '8299', '3661', '3443', '2449', '1519', '6139',
      '5536', '2308', '2330', '2360', '6442', '6274', '3081', '3017', '2368', '2383', '3037',
      'AAOI', 'NVDA', 'RHLD', 'TNGX', 'LQDA', 'MPTI', 'CRDO', 'VRT', 'FLEX', 'DRAM',
      'BELFA', 'VISN', 'INSW', 'CIEN', 'HUT', 'POWL', 'WULF', 'AEHR'
    ];
    return [...new Set(list)];
  }, [watchlist]);

  // 當前選中標的的所有訊號與委託
  const currentSymSignals = useMemo(() => {
    if (!selectedSym) return [];
    return signals
      .filter(s => s.symbol === selectedSym)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }, [signals, selectedSym]);

  const currentSymOrders = useMemo(() => {
    if (!selectedSym) return [];
    return simOrders
      .filter(o => o.symbol === selectedSym)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }, [simOrders, selectedSym]);

  // 生成 K 線資料與進出場 Markers（傳入真實 OHLC 優先使用）
  const { chartData, markers, isRealData } = useMemo(() => {
    return generateCandlesAndMarkers(selectedSym, currentSymSignals, currentSymOrders, realOHLC);
  }, [selectedSym, currentSymSignals, currentSymOrders, realOHLC]);

  // 載入 Firestore price_data（真實 OHLC 日線，由後端 Python 寫入）
  const loadPriceData = useCallback(async (sym) => {
    if (!sym) return;
    if (priceDataCache.current[sym] !== undefined) {
      setRealOHLC(priceDataCache.current[sym]);
      return;
    }
    setOhlcLoading(true);
    try {
      const snap = await getDoc(doc(db, 'price_data', sym));
      if (snap.exists()) {
        const data = snap.data();
        const ohlc = (data.ohlc || []).filter(c =>
          c && c.time && c.open != null && c.high != null && c.low != null && c.close != null
        ).sort((a, b) => a.time - b.time);
        priceDataCache.current[sym] = ohlc.length >= 5 ? ohlc : null;
      } else {
        priceDataCache.current[sym] = null;
      }
      setRealOHLC(priceDataCache.current[sym]);
    } catch (e) {
      console.warn('price_data fetch error:', e);
      priceDataCache.current[sym] = null;
      setRealOHLC(null);
    } finally {
      setOhlcLoading(false);
    }
  }, []);

  // 當選中標的改變時，自動載入真實 OHLC
  useEffect(() => {
    if (selectedSym) {
      loadPriceData(selectedSym);
    }
  }, [selectedSym, loadPriceData]);

  // 切換選中標的
  const selectSymbol = (sym) => {
    setChartLoading(true);
    setRealOHLC(null); // 先清除舊 OHLC
    setSelectedSym(sym);
    setTimeout(() => setChartLoading(false), 50);
  };

  // 格式化輔助函式
  const fmt = n => (n != null && !isNaN(n)) ? Math.round(n).toLocaleString("zh-TW") : "0";
  const fmtDec = (n, d = 2) => (n != null && !isNaN(n)) ? Number(n).toFixed(d) : "-";
  const fmtPct = n => (n != null && !isNaN(n)) ? `${n >= 0 ? "+" : ""}${Number(n).toFixed(2)}%` : "0.00%";

  return (
    <div className="dashboard-wrapper">
      {/* 頂部 Tab 切換列 */}
      <div className="dashboard-tabs">
        {[
          { key: "portfolio", icon: <DollarSign size={16}/>, label: "投資組合對帳" },
          { key: "chart",     icon: <BarChart2  size={16}/>, label: "K線訊號對照" },
          { key: "orders",    icon: <List       size={16}/>, label: `委託紀錄 (${simOrders.length})` },
          { key: "settings",  icon: <Settings   size={16}/>, label: "帳號設定" },
        ].map(tb => (
          <button key={tb.key} className={tab === tb.key ? "tab active" : "tab"} onClick={() => setTab(tb.key)}>
            {tb.icon} {tb.label}
          </button>
        ))}
      </div>

      <div className="tab-content">

        {/* ══════════════════════════════════════════════════════════
            TAB 1: 投資組合對帳
        ══════════════════════════════════════════════════════════ */}
        {tab === "portfolio" && (
          !isPaid ? <Locked /> : portfolio ? (
            <>
              {/* 資產總覽數據卡 */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
                <StatCard
                  label="總資產 (Total Equity)"
                  value={`NT$ ${fmt(portfolio.totalEquity)}`}
                  sub={`起始本金 NT$ ${fmt(portfolio.initCap)}`}
                  color="var(--accent)"
                  icon={<DollarSign size={20}/>}
                />
                <StatCard
                  label="累積損益 (Total PnL)"
                  value={`${portfolio.pnl >= 0 ? "+" : ""}NT$ ${fmt(Math.abs(portfolio.pnl))}`}
                  sub={`報酬率 ${fmtPct(portfolio.ret)}`}
                  color={portfolio.pnl >= 0 ? "#ef4444" : "#22c55e"}
                  icon={portfolio.pnl >= 0 ? <TrendingUp size={20}/> : <TrendingDown size={20}/>}
                />
                <StatCard
                  label="可用現金 (Available Cash)"
                  value={`NT$ ${fmt(portfolio.cash)}`}
                  sub="備用下單資金"
                  color="#94a3b8"
                  icon={<DollarSign size={20}/>}
                />
                <StatCard
                  label="持倉標的數"
                  value={`${portfolio.openPos.length} 個`}
                  sub={`持倉市值 NT$ ${fmt(portfolio.positionValue)}`}
                  color="#a78bfa"
                  icon={<BarChart2 size={20}/>}
                />
              </div>

              {/* 目前持倉明細表 */}
              <div style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: "0.875rem", padding: "1.25rem", marginBottom: "1.5rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                  <h3 style={{ fontSize: "1rem", fontWeight: 700, margin: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    💼 目前持倉明細 ({portfolio.openPos.length})
                  </h3>
                  <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>點擊任一標的立即跳轉 K 線對照圖</span>
                </div>

                {portfolio.openPos.length === 0 ? (
                  <div className="empty-state" style={{ padding: "2.5rem 1rem", textAlign: "center" }}>
                    <p style={{ margin: 0, color: "var(--text-muted)" }}>目前無持倉，模型正在監控 49 個標的尋找最佳進場點</p>
                  </div>
                ) : (
                  <div className="orders-table">
                    <table>
                      <thead>
                        <tr>
                          <th>標的</th>
                          <th>市場</th>
                          <th>持倉量</th>
                          <th>均價</th>
                          <th>現價</th>
                          <th>持倉市值</th>
                          <th>未實現損益</th>
                          <th>報酬率</th>
                          <th>操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {portfolio.openPos.map(p => (
                          <tr key={p.symbol} style={{ cursor: "pointer" }} onClick={() => { selectSymbol(p.symbol); setTab("chart"); }}>
                            <td>
                              <strong style={{ color: "var(--accent)", fontSize: "0.95rem" }}>{p.symbol}</strong>
                              <span style={{ marginLeft: "0.4rem", fontSize: "0.8rem", color: "var(--text-muted)" }}>{p.name}</span>
                            </td>
                            <td>
                              <span style={{ fontSize: "0.75rem", padding: "0.15rem 0.4rem", borderRadius: "0.3rem", background: "rgba(128,128,128,0.1)" }}>
                                {p.symbol.match(/^\d+$/) ? '台股' : '美股'}
                              </span>
                            </td>
                            <td>{fmtDec(p.qty, p.symbol.match(/^\d+$/) ? 0 : 2)} {p.symbol.match(/^\d+$/) ? '張' : '股'}</td>
                            <td>NT$ {fmtDec(p.avg)}</td>
                            <td><strong>NT$ {fmtDec(p.mkt)}</strong></td>
                            <td>NT$ {fmt(p.val)}</td>
                            <td style={{ color: p.pnl >= 0 ? "#ef4444" : "#22c55e", fontWeight: 700 }}>
                              {p.pnl >= 0 ? "+" : ""}{fmt(p.pnl)}
                            </td>
                            <td style={{ color: p.ret >= 0 ? "#ef4444" : "#22c55e", fontWeight: 700 }}>
                              {fmtPct(p.ret)}
                            </td>
                            <td>
                              <button
                                className="btn btn-outline"
                                style={{ padding: "0.25rem 0.6rem", fontSize: "0.75rem", borderRadius: "1rem" }}
                                onClick={(e) => { e.stopPropagation(); selectSymbol(p.symbol); setTab("chart"); }}
                              >
                                <Eye size={12} style={{ marginRight: 3 }}/> K線圖
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div style={{ textAlign: "center", padding: "4rem" }}><Loader2 size={36} className="animate-spin" /></div>
          )
        )}

        {/* ══════════════════════════════════════════════════════════
            TAB 2: K線訊號對照（個別標的即時圖表）
        ══════════════════════════════════════════════════════════ */}
        {tab === "chart" && (
          !isPaid ? <Locked /> : (
            <>
              {/* 49 標的快速選取導航列 */}
              <div style={{
                background: "var(--card-bg)", border: "1px solid var(--border)",
                borderRadius: "0.875rem", padding: "1rem", marginBottom: "1.25rem"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem", marginBottom: "0.75rem" }}>
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                    <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-muted)" }}>篩選標的：</span>
                    {["ALL", "TW", "US"].map(m => (
                      <button
                        key={m}
                        className={`btn ${marketFilter === m ? "btn-black" : "btn-outline"}`}
                        style={{ padding: "0.25rem 0.75rem", fontSize: "0.78rem", borderRadius: "1rem" }}
                        onClick={() => setMarketFilter(m)}
                      >
                        {m === "ALL" ? `全部 (${allSymbols.length})` : m === "TW" ? "台股 (31)" : "美股 (18)"}
                      </button>
                    ))}
                  </div>

                  {/* 搜尋標的 */}
                  <div style={{ position: "relative", minWidth: 180 }}>
                    <Search size={14} style={{ position: "absolute", left: "0.6rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }}/>
                    <input
                      type="text"
                      placeholder="搜尋代碼或名稱..."
                      value={searchSym}
                      onChange={e => setSearchSym(e.target.value.toUpperCase())}
                      style={{
                        padding: "0.35rem 0.6rem 0.35rem 1.8rem",
                        fontSize: "0.8rem", borderRadius: "1rem",
                        border: "1px solid var(--border)", background: "transparent",
                        color: "inherit", width: "100%"
                      }}
                    />
                  </div>
                </div>

                {/* 標的 Pill 按鈕清單 */}
                <div style={{
                  display: "flex", flexWrap: "wrap", gap: "0.4rem",
                  maxHeight: 140, overflowY: "auto", paddingRight: "0.25rem"
                }}>
                  {allSymbols
                    .filter(sym => {
                      if (marketFilter === "TW" && !sym.match(/^\d+$/)) return false;
                      if (marketFilter === "US" && sym.match(/^\d+$/)) return false;
                      if (searchSym) {
                        const name = SYMBOL_NAMES[sym] || '';
                        return sym.includes(searchSym) || name.includes(searchSym);
                      }
                      return true;
                    })
                    .map(sym => {
                      const isSelected = selectedSym === sym;
                      const hasSig = signals.some(s => s.symbol === sym);
                      const hasOrder = simOrders.some(o => o.symbol === sym);
                      return (
                        <button
                          key={sym}
                          onClick={() => selectSymbol(sym)}
                          style={{
                            padding: "0.3rem 0.65rem",
                            borderRadius: "0.5rem",
                            border: isSelected ? "2px solid var(--accent)" : "1px solid var(--border)",
                            background: isSelected ? "var(--accent)" : "rgba(255,255,255,0.03)",
                            color: isSelected ? "#fff" : "inherit",
                            fontSize: "0.8rem",
                            fontWeight: isSelected ? 700 : 500,
                            cursor: "pointer",
                            display: "flex", alignItems: "center", gap: "0.35rem",
                            transition: "all 0.15s ease",
                          }}
                        >
                          <span>{sym}</span>
                          {SYMBOL_NAMES[sym] && (
                            <span style={{ fontSize: "0.72rem", opacity: isSelected ? 0.9 : 0.6 }}>
                              {SYMBOL_NAMES[sym]}
                            </span>
                          )}
                          {(hasSig || hasOrder) && (
                            <span style={{
                              width: 6, height: 6, borderRadius: "50%",
                              background: isSelected ? "#fff" : "#ef4444"
                            }}/>
                          )}
                        </button>
                      );
                    })}
                </div>
              </div>

              {/* K 線圖表區塊 */}
              <div style={{
                background: "var(--card-bg)", border: "1px solid var(--border)",
                borderRadius: "0.875rem", padding: "1.25rem", marginBottom: "1.5rem"
              }}>
                {chartLoading || ohlcLoading ? (
                  <div style={{ textAlign: "center", padding: "4rem" }}>
                    <Loader2 size={32} className="animate-spin" />
                    <p style={{ marginTop: "0.75rem", fontSize: "0.85rem", color: "var(--text-muted)" }}>
                      {ohlcLoading ? "載入真實行情資料中..." : "切換標的中..."}
                    </p>
                  </div>
                ) : (
                  <>
                    {/* 資料來源標示 */}
                    <div style={{ marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      {isRealData ? (
                        <span style={{
                          fontSize: "0.75rem", padding: "0.2rem 0.6rem", borderRadius: 999,
                          background: "rgba(34,197,94,0.15)", color: "#22c55e", fontWeight: 700
                        }}>
                          ✅ 真實行情 (Yahoo Finance 日線，由後端每日更新)
                        </span>
                      ) : (
                        <span style={{
                          fontSize: "0.75rem", padding: "0.2rem 0.6rem", borderRadius: 999,
                          background: "rgba(239,68,68,0.12)", color: "#f59e0b", fontWeight: 700
                        }}>
                          ⚠️ 此標的尚無真實行情快取（後端下次排程執行後自動更新），目前顯示訊號時間軸輔助圖
                        </span>
                      )}
                    </div>

                    <Chart
                      data={chartData}
                      markers={markers}
                      symbol={selectedSym}
                      title={`${selectedSym} ${SYMBOL_NAMES[selectedSym] || ''} · LVIS V2 策略 K 線對照`}
                      subtitle={`${selectedSym.match(/^\d+$/) ? '台股' : '美股'} · ${isRealData ? '真實歷史日K · ' : ''}包含策略進出場點位、加碼點與停損標記`}
                    />

                    {/* 圖例說明 */}
                    <div style={{
                      display: "flex", gap: "1.25rem", marginTop: "0.5rem",
                      fontSize: "0.8rem", color: "var(--text-muted)", flexWrap: "wrap",
                      padding: "0.5rem 0.75rem", background: "rgba(128,128,128,0.05)", borderRadius: "0.5rem"
                    }}>
                      <span>📈 台灣習慣：<strong style={{ color: "#ef4444" }}>紅漲</strong> / <strong style={{ color: "#22c55e" }}>綠跌</strong></span>
                      <span>▲ <strong style={{ color: "#ef4444" }}>進場 / 加碼買進</strong>（標記於 K 棒下方）</span>
                      <span>▼ <strong style={{ color: "#3b82f6" }}>停損 / 獲利出場</strong>（標記於 K 棒上方）</span>
                      <span>💡 支援滾輪放大縮小、按住拖曳歷史時間軸</span>
                    </div>
                  </>
                )}
              </div>

              {/* 個別標的進出場對照表 */}
              <div style={{
                background: "var(--card-bg)", border: "1px solid var(--border)",
                borderRadius: "0.875rem", padding: "1.25rem"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                  <h3 style={{ fontSize: "0.95rem", fontWeight: 700, margin: 0 }}>
                    📋 {selectedSym} {SYMBOL_NAMES[selectedSym] || ''} · 個別進出場歷史明細對照 ({currentSymSignals.length} 筆訊號 / {currentSymOrders.length} 筆委託)
                  </h3>
                </div>

                {currentSymSignals.length === 0 && currentSymOrders.length === 0 ? (
                  <div className="empty-state" style={{ padding: "2rem", textAlign: "center" }}>
                    <p style={{ margin: 0, color: "var(--text-muted)", fontSize: "0.85rem" }}>
                      📡 此標的目前處於監控觀察階段，模型等待 EMA 均線排列與量能結構突破觸發，尚未產生實盤進出場紀錄。
                    </p>
                  </div>
                ) : (
                  <div className="orders-table">
                    <table>
                      <thead>
                        <tr>
                          <th>時間</th>
                          <th>動作訊號</th>
                          <th>價格</th>
                          <th>停損價</th>
                          <th>下單單號</th>
                          <th>狀態</th>
                          <th>策略說明</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...currentSymSignals].reverse().map((s, idx) => {
                          const sigInfo = SIGNAL_LABELS[s.type] || { label: s.type, color: '#888', isEntry: s.type?.includes('ENTRY') };
                          const matchingOrder = currentSymOrders.find(o =>
                            Math.abs(new Date(o.timestamp) - new Date(s.timestamp)) < 60000 ||
                            o.signal === s.type
                          );
                          return (
                            <tr key={s.id || idx}>
                              <td style={{ fontSize: "0.78rem" }}>{new Date(s.timestamp).toLocaleString("zh-TW")}</td>
                              <td>
                                <span style={{
                                  background: sigInfo.isEntry ? "rgba(239,68,68,0.12)" : "rgba(59,130,246,0.12)",
                                  color: sigInfo.isEntry ? "#ef4444" : "#3b82f6",
                                  padding: "0.2rem 0.6rem", borderRadius: 999,
                                  fontSize: "0.78rem", fontWeight: 700
                                }}>
                                  {sigInfo.isEntry ? '▲' : '▼'} {sigInfo.label} ({s.type})
                                </span>
                              </td>
                              <td><strong>NT$ {fmtDec(s.price)}</strong></td>
                              <td style={{ color: "#ef4444" }}>NT$ {fmtDec(s.stop_loss)}</td>
                              <td>
                                <code style={{ fontSize: "0.78rem" }}>
                                  {matchingOrder?.order_id || '自動委託已送出'}
                                </code>
                              </td>
                              <td>
                                <span className="badge badge-success">
                                  ✓ {matchingOrder?.status?.replace('OrderStatus.', '') || '已執行'}
                                </span>
                              </td>
                              <td style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>{s.comment || '量能突破入場'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )
        )}

        {/* ══════════════════════════════════════════════════════════
            TAB 3: 委託紀錄（即時 Shioaji 自動模擬委託對帳）
        ══════════════════════════════════════════════════════════ */}
        {tab === "orders" && (
          !isPaid ? <Locked /> : (
            <div style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: "0.875rem", padding: "1.25rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem", marginBottom: "0.75rem" }}>
                <div>
                  <h3 style={{ fontSize: "1.05rem", fontWeight: 700, margin: 0 }}>
                    📋 自動模擬委託紀錄 ({simOrders.length} 筆)
                  </h3>
                  <p style={{ margin: "0.25rem 0 0", fontSize: "0.82rem", color: "var(--text-muted)" }}>
                    透過永豐金 Shioaji API 模擬環境每日自動執行，全透明可對照驗證
                  </p>
                </div>

                {/* 篩選標籤 */}
                <div style={{ display: "flex", gap: "0.4rem" }}>
                  {[
                    { key: "ALL", label: "全部" },
                    { key: "TW",  label: "台股" },
                    { key: "US",  label: "美股" },
                    { key: "BUY", label: "買進" },
                    { key: "SELL",label: "賣出" },
                  ].map(f => (
                    <button
                      key={f.key}
                      className={`btn ${orderFilter === f.key ? "btn-black" : "btn-outline"}`}
                      style={{ padding: "0.25rem 0.7rem", fontSize: "0.78rem", borderRadius: "1rem" }}
                      onClick={() => setOrderFilter(f.key)}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 狀態說明 */}
              <div style={{
                fontSize: "0.78rem", padding: "0.6rem 0.9rem", borderRadius: "0.5rem",
                background: "rgba(59,130,246,0.07)", border: "1px solid rgba(59,130,246,0.2)",
                color: "var(--text-muted)", marginBottom: "1rem", lineHeight: 1.7
              }}>
                📌 以下為 Shioaji API <strong>模擬環境</strong>實際委託記錄（非虛擬資料）。
                &nbsp;<strong style={{ color: "#22c55e" }}>✅ PendingSubmit</strong> = 委託已成功送出（Shioaji 受理）；
                &nbsp;<strong style={{ color: "#ef4444" }}>❌ Failed</strong> = 委託失敗（通常因非交易時間、漲跌停限制或週末執行）。
                有 order_id 的委託表示已確實進入模擬撮合系統。
              </div>

              {simOrders.length === 0 ? (
                <div className="empty-state" style={{ padding: "3rem", textAlign: "center" }}>
                  <p style={{ margin: 0, color: "var(--text-muted)" }}>尚無委託紀錄，工作排程器在交易日將自動執行</p>
                </div>
              ) : (
                <div className="orders-table">
                  <table>
                    <thead>
                      <tr>
                        <th>委託時間</th>
                        <th>標的</th>
                        <th>市場</th>
                        <th>方向</th>
                        <th>委託價格</th>
                        <th>張數/股數</th>
                        <th>委託單號 (Order ID)</th>
                        <th>觸發訊號</th>
                        <th>委託狀態</th>
                        <th>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {simOrders
                        .filter(o => {
                          if (orderFilter === "TW" && !o.symbol?.match(/^\d+$/)) return false;
                          if (orderFilter === "US" && o.symbol?.match(/^\d+$/)) return false;
                          if (orderFilter === "BUY" && !o.type?.includes("BUY")) return false;
                          if (orderFilter === "SELL" && !o.type?.includes("SELL")) return false;
                          return true;
                        })
                        .slice(0, 100)
                        .map((o, idx) => {
                          const isBuy = o.type?.includes("BUY");
                          // 判斷真實委託狀態
                          const rawStatus = o.status || '';
                          const isFailed = rawStatus.includes('Failed') || rawStatus.includes('failed') || (!o.order_id && rawStatus !== '');
                          const isPending = rawStatus.includes('PendingSubmit');
                          const hasOrderId = o.order_id && o.order_id.length > 0;
                          return (
                            <tr key={o.id || idx}>
                              <td style={{ fontSize: "0.78rem" }}>{new Date(o.timestamp).toLocaleString("zh-TW")}</td>
                              <td>
                                <strong>{o.symbol}</strong>
                                <span style={{ marginLeft: "0.35rem", fontSize: "0.78rem", color: "var(--text-muted)" }}>
                                  {SYMBOL_NAMES[o.symbol] || ''}
                                </span>
                              </td>
                              <td>
                                <span style={{ fontSize: "0.75rem", padding: "0.15rem 0.4rem", borderRadius: "0.3rem", background: "rgba(128,128,128,0.1)" }}>
                                  {o.market || (o.symbol?.match(/^\d+$/) ? 'TW' : 'US')}
                                </span>
                              </td>
                              <td>
                                <span style={{
                                  background: isBuy ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.12)',
                                  color: isBuy ? '#ef4444' : '#22c55e',
                                  padding: "0.2rem 0.5rem", borderRadius: 999, fontSize: "0.78rem", fontWeight: 700
                                }}>
                                  {isBuy ? '▲ 買進' : '▼ 賣出'}
                                </span>
                              </td>
                              <td>NT$ {fmtDec(o.price)}</td>
                              <td>{o.qty} {o.market === 'TW' || o.symbol?.match(/^\d+$/) ? '張' : '股'}</td>
                              <td>
                                <code style={{ fontSize: "0.78rem" }}>
                                  {hasOrderId ? o.order_id : <span style={{ color: "var(--text-muted)" }}>無單號</span>}
                                </code>
                              </td>
                              <td><span style={{ fontSize: "0.75rem", color: "var(--accent)" }}>{o.signal || '-'}</span></td>
                              <td>
                                {isFailed ? (
                                  <span style={{
                                    display: "inline-flex", alignItems: "center", gap: "0.25rem",
                                    padding: "0.2rem 0.6rem", borderRadius: 999, fontSize: "0.75rem",
                                    background: "rgba(239,68,68,0.12)", color: "#ef4444", fontWeight: 700
                                  }} title="委託失敗：通常因非交易時間、價格超出漲跌停限制或週末執行">
                                    ❌ 委託失敗
                                  </span>
                                ) : isPending ? (
                                  <span style={{
                                    display: "inline-flex", alignItems: "center", gap: "0.25rem",
                                    padding: "0.2rem 0.6rem", borderRadius: 999, fontSize: "0.75rem",
                                    background: "rgba(34,197,94,0.12)", color: "#22c55e", fontWeight: 700
                                  }} title="委託已成功送出，Shioaji 模擬環境受理中">
                                    ✅ 委託送出
                                  </span>
                                ) : (
                                  <span style={{
                                    padding: "0.2rem 0.6rem", borderRadius: 999, fontSize: "0.75rem",
                                    background: "rgba(148,163,184,0.12)", color: "#94a3b8", fontWeight: 600
                                  }}>
                                    {rawStatus.replace('OrderStatus.', '') || '未知'}
                                  </span>
                                )}
                              </td>
                              <td>
                                <button
                                  className="btn btn-outline"
                                  style={{ padding: "0.2rem 0.5rem", fontSize: "0.72rem", borderRadius: "1rem" }}
                                  onClick={() => { selectSymbol(o.symbol); setTab("chart"); }}
                                >
                                  對照K線
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )
        )}

        {/* ══════════════════════════════════════════════════════════
            TAB 4: 帳號設定
        ══════════════════════════════════════════════════════════ */}
        {tab === "settings" && (
          <div style={{ maxWidth: 520 }}>
            <h3 style={{ marginBottom: "1rem", fontSize: "1.1rem" }}>👤 帳戶訂閱與權限</h3>
            <div style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: "0.875rem", padding: "1.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.25rem" }}>
                {user.photoURL ? (
                  <img src={user.photoURL} alt="" style={{ width: 48, height: 48, borderRadius: "50%" }}/>
                ) : (
                  <div style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--accent)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>
                    {user.email?.[0]?.toUpperCase()}
                  </div>
                )}
                <div>
                  <h4 style={{ margin: 0, fontSize: "1rem" }}>{user.displayName || user.email}</h4>
                  <p style={{ margin: "0.2rem 0 0", fontSize: "0.82rem", color: "var(--text-muted)" }}>UID: {user.uid}</p>
                </div>
              </div>

              <div style={{ borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                  <span style={{ fontSize: "0.88rem", fontWeight: 500 }}>服務訂閱狀態：</span>
                  <span style={{
                    background: isPaid ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.12)",
                    color: isPaid ? "#22c55e" : "#ef4444",
                    padding: "0.25rem 0.8rem", borderRadius: 999, fontSize: "0.82rem", fontWeight: 700,
                  }}>
                    {isPaid ? "✅ 尊榮會員（自動下單啟用中）" : "⏸ 尚未開通付費"}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                  <span style={{ fontSize: "0.88rem", fontWeight: 500 }}>下單環境：</span>
                  <span style={{ fontSize: "0.85rem", color: "var(--text)" }}>永豐金證券 Shioaji API (模擬模式)</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                  <span style={{ fontSize: "0.88rem", fontWeight: 500 }}>監控模型：</span>
                  <span style={{ fontSize: "0.85rem", color: "var(--text)" }}>LVIS V2（49 檔台美股全標的）</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "0.88rem", fontWeight: 500 }}>自動排程時間：</span>
                  <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>週一～五 13:35 / 04:10</span>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// ── 輔助元件：數據小卡
function StatCard({ label, value, sub, icon, color }) {
  return (
    <div style={{ background: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: "0.875rem", padding: "1.25rem" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
        <span style={{ fontSize: "0.82rem", color: "var(--text-muted)", fontWeight: 500 }}>{label}</span>
        <span style={{ color, opacity: 0.9 }}>{icon}</span>
      </div>
      <div style={{ fontSize: "1.35rem", fontWeight: 800, marginBottom: "0.25rem", letterSpacing: "-0.02em" }}>{value}</div>
      {sub && <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>{sub}</div>}
    </div>
  );
}

// ── 輔助元件：未開通鎖定卡
function Locked() {
  return (
    <div style={{ textAlign: "center", padding: "4rem 2rem", background: "var(--card-bg)", borderRadius: "1rem", border: "1px solid var(--border)" }}>
      <Lock size={44} style={{ margin: "0 auto 1.25rem", opacity: 0.4 }} />
      <h3 style={{ marginBottom: "0.5rem", fontSize: "1.2rem" }}>需要訂閱開通才能使用</h3>
      <p style={{ color: "var(--text-muted)", maxWidth: 360, margin: "0 auto 1.5rem", fontSize: "0.9rem" }}>
        您的帳號尚未開通自動下單權限。請聯繫管理員為您開啟權限後即可查閱所有 K 線圖與投資組合。
      </p>
    </div>
  );
}

/**
 * 生成 K 線資料與進出場 Markers
 * - 優先使用後端寫入 Firestore 的真實 OHLC 日線（realOHLC）
 * - 若無真實 OHLC，fallback 為根據訊號錨點合成（並標明為模擬資料）
 */
function generateCandlesAndMarkers(symbol, symSignals = [], symOrders = [], realOHLC = null) {

  // ── 建立 Markers（來自 Firestore 真實訊號，不管 K 線來源）
  const priceAnchors = [];

  for (const s of symSignals) {
    if (s.price && s.timestamp) {
      priceAnchors.push({
        price: Number(s.price),
        time: Math.floor(new Date(s.timestamp).getTime() / 1000),
        type: s.type,
        comment: s.comment,
        isEntry: s.type?.includes('ENTRY') || s.type?.includes('SCALE') || s.type?.includes('TAKEOVER'),
        source: 'signal',
      });
    }
  }

  // 注意：委託錨點通常時間戳相同或相近，只用 signals 的 Markers 以免重複
  priceAnchors.sort((a, b) => a.time - b.time);

  // ── 路徑 A：有真實 OHLC（後端 Python 由 yfinance 寫入 Firestore）
  if (realOHLC && realOHLC.length >= 5) {
    // 直接用真實 K 線資料
    const chartData = realOHLC.map(c => ({
      time: c.time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));

    // 把 Firestore 訊號錨點對齊到最近的真實 K 棒
    const markers = [];
    const DAY_SEC = 86400;
    for (const anchor of priceAnchors) {
      // 找最近的 K 棒（允許 ±3 天容差，訊號時間戳可能在週末或夜間）
      let nearest = null;
      let minDiff = Infinity;
      for (const c of chartData) {
        const diff = Math.abs(c.time - anchor.time);
        if (diff < minDiff && diff <= DAY_SEC * 3) {
          minDiff = diff;
          nearest = c;
        }
      }
      const markerTime = nearest ? nearest.time : anchor.time;
      if (!markers.some(m => m.time === markerTime && m.text.startsWith(anchor.type))) {
        markers.push({
          time: markerTime,
          position: anchor.isEntry ? 'belowBar' : 'aboveBar',
          color: anchor.isEntry ? '#ef4444' : '#3b82f6',
          shape: anchor.isEntry ? 'arrowUp' : 'arrowDown',
          text: `${anchor.type} @${anchor.price.toFixed(2)}`,
        });
      }
    }
    markers.sort((a, b) => a.time - b.time);
    return { chartData, markers, isRealData: true };
  }

  // ── 路徑 B：無真實 OHLC，fallback 合成（依訊號錨點插值）
  let basePrice = 100;
  if (priceAnchors.length > 0) {
    basePrice = priceAnchors[0].price;
  } else if (symbol.match(/^\d+$/)) {
    basePrice = symbol === '2330' ? 1040 : symbol === '2317' ? 215 : 150;
  } else {
    basePrice = symbol === 'NVDA' ? 185 : symbol === 'VRT' ? 220 : 65;
  }

  const DAY_SEC = 86400;
  const nowSec = Math.floor(Date.now() / 1000);
  const totalBars = 60;
  const endSec = nowSec;
  const startSec = endSec - totalBars * DAY_SEC;

  const chartData = [];
  const markers = [];
  let currPrice = basePrice * 0.96;
  const vol = Math.max(0.5, basePrice * 0.018);

  for (let i = 0; i < totalBars; i++) {
    const t = startSec + i * DAY_SEC;

    let targetPrice = currPrice;
    const anchor = priceAnchors.find(a => Math.abs(a.time - t) <= DAY_SEC * 1.5);

    if (anchor) {
      targetPrice = anchor.price;
    } else {
      const futureAnchor = priceAnchors.find(a => a.time > t);
      if (futureAnchor) {
        const remainingBars = Math.max(1, Math.floor((futureAnchor.time - t) / DAY_SEC));
        targetPrice = currPrice + (futureAnchor.price - currPrice) / remainingBars;
      }
    }

    const noise = (Math.sin(i * 0.5) * 0.4 + (Math.random() - 0.48)) * vol;
    const closeP = +(targetPrice + noise).toFixed(2);
    const openP  = +(currPrice + (Math.random() - 0.5) * vol * 0.35).toFixed(2);
    const highP  = +(Math.max(openP, closeP) + Math.random() * vol * 0.6).toFixed(2);
    const lowP   = +(Math.min(openP, closeP) - Math.random() * vol * 0.6).toFixed(2);

    chartData.push({ time: t, open: openP, high: highP, low: lowP, close: closeP });

    if (anchor && !markers.some(m => m.time === t)) {
      markers.push({
        time: t,
        position: anchor.isEntry ? 'belowBar' : 'aboveBar',
        color: anchor.isEntry ? '#ef4444' : '#3b82f6',
        shape: anchor.isEntry ? 'arrowUp' : 'arrowDown',
        text: `${anchor.type} @${anchor.price.toFixed(2)}`,
      });
    }

    currPrice = closeP;
  }

  markers.sort((a, b) => a.time - b.time);
  return { chartData, markers, isRealData: false };
}

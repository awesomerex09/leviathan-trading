import React, { useState, useEffect, useCallback } from 'react';
import { Users, ListChecks, SlidersHorizontal, Activity, Loader2, RefreshCw, Check, ChevronDown, ChevronUp, Info } from 'lucide-react';
import {
  adminDbGetAllUsers,
  adminDbSetUserActive,
  adminDbSetUserPaid,
  adminDbGetWatchlist,
  adminDbUpdateWatchlist,
  adminDbGetStrategyParams,
  adminDbUpdateStrategyParams,
  adminDbGetSignals,
  adminDbGetSimOrders,
  STRATEGY_PARAM_SCHEMA,
} from '../adminDb';


// 訊號類型對應樣式
const SIGNAL_STYLES = {
  STRUCT_ENTRY:  { emoji: '🏛️', color: '#1d4ed8', label: '結構入場' },
  TREND_ENTRY:   { emoji: '🌊', color: '#0891b2', label: '趨勢入場' },
  SCALE_IN_1:    { emoji: '🔼', color: '#059669', label: '加碼 1' },
  SCALE_IN_2:    { emoji: '🔼', color: '#059669', label: '加碼 2' },
  SCALE_IN_3:    { emoji: '🔼', color: '#059669', label: '加碼 3' },
  EXIT:          { emoji: '🛑', color: '#dc2626', label: '出場' },
  TAKEOVER:      { emoji: '🛡️', color: '#7c3aed', label: '接管' },
};

const AdminDashboard = ({ user, t }) => {
  const [tab, setTab] = useState('users');

  // Users
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [expandedUser, setExpandedUser] = useState(null);

  // Watchlist
  const [watchlist, setWatchlist] = useState([]);
  const [watchlistInput, setWatchlistInput] = useState('');
  const [watchlistLoading, setWatchlistLoading] = useState(false);
  const [watchlistStatus, setWatchlistStatus] = useState('');

  // Strategy Params
  const [params, setParams] = useState({});
  const [paramsLoading, setParamsLoading] = useState(false);
  const [paramsStatus, setParamsStatus] = useState('');
  const [tooltip, setTooltip] = useState(null);

  // Signals
  const [signals, setSignals] = useState([]);
  const [simOrders, setSimOrders] = useState([]);
  const [signalsLoading, setSignalsLoading] = useState(false);

  const fetchUsers = useCallback(async () => {
    setUsersLoading(true);
    try { setUsers(await adminDbGetAllUsers()); } catch (e) { console.error(e); } finally { setUsersLoading(false); }
  }, []);

  const fetchWatchlist = useCallback(async () => {
    setWatchlistLoading(true);
    try {
      const data = await adminDbGetWatchlist();
      setWatchlist(data.symbols || []);
      setWatchlistInput((data.symbols || []).join('\n'));
    } catch (e) { console.error(e); } finally { setWatchlistLoading(false); }
  }, []);

  const fetchParams = useCallback(async () => {
    setParamsLoading(true);
    try { setParams(await adminDbGetStrategyParams()); }
    catch (e) { console.error(e); } finally { setParamsLoading(false); }
  }, []);

  const fetchSignals = useCallback(async () => {
    setSignalsLoading(true);
    try {
      const [sigs, orders] = await Promise.all([
        adminDbGetSignals(50),
        adminDbGetSimOrders(20),
      ]);
      setSignals(sigs);
      setSimOrders(orders);
    } catch (e) { console.error(e); } finally { setSignalsLoading(false); }
  }, []);

  useEffect(() => {
    if (tab === 'users') fetchUsers();
    if (tab === 'watchlist') fetchWatchlist();
    if (tab === 'strategy') fetchParams();
    if (tab === 'signals') fetchSignals();
  }, [tab, fetchUsers, fetchWatchlist, fetchParams, fetchSignals]);

  const toggleUserActive = async (uid, current) => {
    try { await adminDbSetUserActive(uid, !current); fetchUsers(); } catch (e) { console.error(e); }
  };

  const toggleUserPaid = async (uid, current) => {
    try { await adminDbSetUserPaid(uid, !current); fetchUsers(); } catch (e) { console.error(e); }
  };

  const saveWatchlist = async () => {
    const symbols = watchlistInput.split('\n').map(s => s.trim().toUpperCase()).filter(Boolean);
    setWatchlistStatus('saving');
    try { await adminDbUpdateWatchlist(symbols); setWatchlist(symbols); setWatchlistStatus('success'); }
    catch (e) { console.error(e); setWatchlistStatus('error'); }
  };

  const saveParams = async () => {
    setParamsStatus('saving');
    try {
      await adminDbUpdateStrategyParams(params);
      setParamsStatus('success');
      setTimeout(() => setParamsStatus(''), 3000);
    } catch (e) { console.error(e); setParamsStatus('error'); }
  };

  const resetParams = () => {
    const defaults = Object.fromEntries(STRATEGY_PARAM_SCHEMA.map(p => [p.key, p.default]));
    setParams(defaults);
    setParamsStatus('');
  };

  const updateParam = (key, rawVal, schema) => {
    let v = schema.type === 'int' ? parseInt(rawVal, 10) : parseFloat(rawVal);
    if (isNaN(v)) return;
    v = Math.min(schema.max, Math.max(schema.min, v));
    setParams(prev => ({ ...prev, [key]: v }));
    setParamsStatus('');
  };

  const fmtTime = (ts) => {
    if (!ts) return '—';
    try { return new Date(ts).toLocaleString('zh-TW'); } catch { return ts; }
  };

  return (
    <div className="dashboard-wrapper">
      <div className="admin-header">
        <h2>{t.admin_title}</h2>
        <p style={{ color: 'var(--text-muted)', marginTop: '0.25rem', fontSize: '0.9rem' }}>{t.admin_logged_as}{user.email}</p>
      </div>

      <div className="dashboard-tabs">
        <button className={tab === 'users' ? 'tab active' : 'tab'} onClick={() => setTab('users')}>
          <Users size={16} /> {t.admin_tab_users}
        </button>
        <button className={tab === 'watchlist' ? 'tab active' : 'tab'} onClick={() => setTab('watchlist')}>
          <ListChecks size={16} /> {t.admin_tab_watchlist}
        </button>
        <button className={tab === 'strategy' ? 'tab active' : 'tab'} onClick={() => setTab('strategy')}>
          <SlidersHorizontal size={16} /> 策略參數
        </button>
        <button className={tab === 'signals' ? 'tab active' : 'tab'} onClick={() => setTab('signals')}>
          <Activity size={16} /> 訊號紀錄
        </button>
      </div>

      <div className="tab-content">

        {/* ── Users ── */}
        {tab === 'users' && (
          <div>
            <div className="section-header">
              <h3>{t.admin_users_count}（{users.length}）</h3>
              <button className="btn btn-outline" onClick={fetchUsers} disabled={usersLoading}>
                <RefreshCw size={16} /> {t.admin_refresh}
              </button>
            </div>

            {usersLoading
              ? <div style={{ textAlign: 'center', padding: '3rem' }}><Loader2 size={32} className="animate-spin" /></div>
              : users.length === 0
                ? <div className="empty-state">{t.admin_orders_empty}</div>
                : (
                  <div className="users-list">
                    {users.map(u => (
                      <div key={u.uid} className={`user-card ${u.isActive ? 'user-active' : ''}`}>
                        <div className="user-card-header" onClick={() => setExpandedUser(expandedUser === u.uid ? null : u.uid)}>
                          <div>
                            <strong>{u.email || u.uid}</strong>
                            <div className="user-badges">
                              <span className={`badge ${u.isPaid ? 'badge-success' : 'badge-fail'}`}>
                                {u.isPaid ? t.admin_paid : t.admin_unpaid}
                              </span>
                              <span className={`badge ${u.isActive ? 'badge-buy' : ''}`}
                                style={!u.isActive ? { background: '#f5f5f5', color: '#888' } : {}}>
                                {u.isActive ? t.admin_active : t.admin_paused}
                              </span>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                            <button className={`btn ${u.isPaid ? 'btn-outline' : 'btn-black'}`}
                              style={{ padding: '0.4rem 1rem', fontSize: '0.8rem', borderRadius: '2rem' }}
                              onClick={e => { e.stopPropagation(); toggleUserPaid(u.uid, u.isPaid); }}>
                              {u.isPaid ? t.admin_cancel_paid : t.admin_open_paid}
                            </button>
                            <button className={`btn ${u.isActive ? 'btn-outline' : 'btn-black'}`}
                              style={{ padding: '0.4rem 1rem', fontSize: '0.8rem', borderRadius: '2rem' }}
                              onClick={e => { e.stopPropagation(); toggleUserActive(u.uid, u.isActive); }}>
                              {u.isActive ? t.admin_stop : t.admin_go}
                            </button>
                            {expandedUser === u.uid ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                          </div>
                        </div>
                        {expandedUser === u.uid && (
                          <div className="user-card-detail">
                            <div className="detail-section">
                              <h4>{t.admin_orders_title}</h4>
                              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                UID: <code style={{ fontSize: '0.8rem' }}>{u.uid}</code>
                              </p>
                              {(u.orders || []).length === 0
                                ? <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.5rem' }}>{t.admin_orders_empty}</p>
                                : (
                                  <div className="orders-table mini" style={{ marginTop: '0.75rem' }}>
                                    <table>
                                      <thead><tr><th>時間</th><th>標的</th><th>動作</th><th>價格</th><th>狀態</th></tr></thead>
                                      <tbody>
                                        {(u.orders || []).slice(0, 5).map((o, i) => (
                                          <tr key={i}>
                                            <td>{new Date(o.timestamp).toLocaleString('zh-TW')}</td>
                                            <td>{o.symbol}</td>
                                            <td><span className={`badge ${o.action === 'BUY' ? 'badge-buy' : 'badge-sell'}`}>{o.action === 'BUY' ? t.action_buy : t.action_sell}</span></td>
                                            <td>{o.price?.toLocaleString()}</td>
                                            <td><span className={`badge ${o.status === 'SUCCESS' ? 'badge-success' : 'badge-fail'}`}>{o.status === 'SUCCESS' ? '✓' : '✗'}</span></td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )
            }
          </div>
        )}

        {/* ── Watchlist ── */}
        {tab === 'watchlist' && (
          <div>
            <div className="section-header">
              <div>
                <h3>{t.admin_watchlist_title}</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>{t.admin_watchlist_sub}</p>
              </div>
              <button className="btn btn-black" onClick={saveWatchlist} disabled={watchlistLoading || watchlistStatus === 'saving'}>
                {watchlistStatus === 'saving'
                  ? <Loader2 size={16} className="animate-spin" />
                  : watchlistStatus === 'success' ? <Check size={16} />
                    : t.admin_save}
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
              <div>
                <textarea className="form-control code-editor" rows={24}
                  value={watchlistInput}
                  onChange={e => { setWatchlistInput(e.target.value); setWatchlistStatus(''); }}
                  placeholder={"每行一個代碼\n例如：\nTXF\nNVDA\n2330"}
                  style={{ fontFamily: 'monospace', fontSize: '0.9rem', lineHeight: '1.8' }} />
              </div>
              <div>
                <h4 style={{ marginBottom: '1rem' }}>{t.admin_watchlist_count}（{watchlist.length}）</h4>
                <div className="watchlist-tags">
                  {watchlist.map(s => <span key={s} className="symbol-tag">{s}</span>)}
                </div>
                {watchlistStatus === 'success' && <p style={{ color: '#16a34a', marginTop: '1rem' }}>{t.admin_watchlist_success}</p>}
                {watchlistStatus === 'error' && <p style={{ color: '#e11d48', marginTop: '1rem' }}>{t.admin_watchlist_error}</p>}
              </div>
            </div>
          </div>
        )}

        {/* ── Strategy Params ── */}
        {tab === 'strategy' && (
          <div>
            <div className="section-header">
              <div>
                <h3>⚙️ LVIS V2 策略參數</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                  修改後點儲存，下次 Python 後端執行時自動生效・<strong style={{ color: '#16a34a' }}>即時修改，不需重啟伺服器</strong>
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button className="btn btn-outline" onClick={resetParams}>還原預設</button>
                <button className="btn btn-black" onClick={saveParams} disabled={paramsLoading || paramsStatus === 'saving'}>
                  {paramsStatus === 'saving' ? <Loader2 size={16} className="animate-spin" />
                    : paramsStatus === 'success' ? <><Check size={16} /> 已儲存</>
                    : '儲存參數'}
                </button>
              </div>
            </div>

            {paramsStatus === 'error' && <p style={{ color: '#e11d48', marginBottom: '1rem' }}>儲存失敗，請重試</p>}

            {paramsLoading
              ? <div style={{ textAlign: 'center', padding: '3rem' }}><Loader2 size={32} className="animate-spin" /></div>
              : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.25rem', marginTop: '0.5rem' }}>
                  {STRATEGY_PARAM_SCHEMA.map(schema => {
                    const val = params[schema.key] ?? schema.default;
                    return (
                      <div key={schema.key} style={{
                        background: 'var(--card-bg)',
                        border: '1px solid var(--border)',
                        borderRadius: '0.75rem',
                        padding: '1.1rem 1.25rem',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.6rem' }}>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>{schema.label}</div>
                            <code style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{schema.key}</code>
                          </div>
                          <div style={{ position: 'relative' }}
                            onMouseEnter={() => setTooltip(schema.key)}
                            onMouseLeave={() => setTooltip(null)}>
                            <Info size={15} style={{ color: 'var(--text-muted)', cursor: 'pointer' }} />
                            {tooltip === schema.key && (
                              <div style={{
                                position: 'absolute', right: 0, top: '1.5rem', zIndex: 10,
                                background: '#1e293b', color: '#f1f5f9', borderRadius: '0.5rem',
                                padding: '0.5rem 0.75rem', fontSize: '0.8rem', width: '200px',
                                boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                              }}>{schema.desc}</div>
                            )}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <input
                            type="range"
                            min={schema.min} max={schema.max}
                            step={schema.type === 'float' ? (schema.max - schema.min) / 100 : 1}
                            value={val}
                            onChange={e => updateParam(schema.key, e.target.value, schema)}
                            style={{ flex: 1, accentColor: 'var(--accent)' }}
                          />
                          <input
                            type="number"
                            min={schema.min} max={schema.max}
                            step={schema.type === 'float' ? 0.001 : 1}
                            value={val}
                            onChange={e => updateParam(schema.key, e.target.value, schema)}
                            style={{
                              width: '80px', textAlign: 'right', fontFamily: 'monospace',
                              fontSize: '0.9rem', fontWeight: 600,
                              background: 'transparent', border: '1px solid var(--border)',
                              borderRadius: '0.4rem', padding: '0.25rem 0.5rem', color: 'inherit',
                            }}
                          />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                          <span>{schema.min}</span>
                          <span style={{ color: val !== schema.default ? '#f59e0b' : 'var(--text-muted)' }}>
                            {val !== schema.default ? '已修改（預設: ' + schema.default + '）' : '預設值'}
                          </span>
                          <span>{schema.max}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            }
          </div>
        )}

        {/* ── Signals 訊號紀錄 ── */}
        {tab === 'signals' && (
          <div>
            <div className="section-header">
              <div>
                <h3>⚡ LVIS V2 訊號紀錄</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                  由後端 Python 策略引擎產生，即時同步至此
                </p>
              </div>
              <button className="btn btn-outline" onClick={fetchSignals} disabled={signalsLoading}>
                <RefreshCw size={16} /> 重新整理
              </button>
            </div>

            {signalsLoading
              ? <div style={{ textAlign: 'center', padding: '3rem' }}><Loader2 size={32} className="animate-spin" /></div>
              : (
                <>
                  {/* 模擬委託 */}
                  {simOrders.length > 0 && (
                    <div style={{ marginBottom: '2rem' }}>
                      <h4 style={{ marginBottom: '1rem', fontSize: '1rem' }}>🔬 模擬委託紀錄（Shioaji sim_orders）</h4>
                      <div className="orders-table">
                        <table>
                          <thead>
                            <tr>
                              <th>時間</th><th>標的</th><th>類型</th><th>價格</th><th>數量</th><th>狀態</th>
                            </tr>
                          </thead>
                          <tbody>
                            {simOrders.map(o => (
                              <tr key={o.id}>
                                <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{fmtTime(o.timestamp)}</td>
                                <td><strong>{o.symbol}</strong></td>
                                <td><span className="badge badge-buy" style={{ fontSize: '0.75rem' }}>{o.type}</span></td>
                                <td>{o.price?.toLocaleString()}</td>
                                <td>{o.qty}</td>
                                <td>
                                  <span className="badge" style={{
                                    background: o.simulation ? '#fef3c7' : '#d1fae5',
                                    color: o.simulation ? '#92400e' : '#065f46',
                                    fontSize: '0.75rem',
                                  }}>
                                    {o.simulation ? '模擬' : '實單'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* 策略訊號 */}
                  <h4 style={{ marginBottom: '1rem', fontSize: '1rem' }}>
                    📊 策略訊號（最新 {signals.length} 筆）
                  </h4>
                  {signals.length === 0
                    ? (
                      <div className="empty-state">
                        <p>尚無訊號紀錄</p>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                          執行 <code>python run_simulation.py</code> 後，訊號會自動出現在這裡
                        </p>
                      </div>
                    )
                    : (
                      <div className="orders-table">
                        <table>
                          <thead>
                            <tr>
                              <th>時間</th><th>標的</th><th>訊號類型</th><th>進場價</th><th>數量</th><th>止損</th><th>備註</th>
                            </tr>
                          </thead>
                          <tbody>
                            {signals.map(sig => {
                              const style = SIGNAL_STYLES[sig.type] || { emoji: '📊', color: '#666', label: sig.type };
                              return (
                                <tr key={sig.id}>
                                  <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{fmtTime(sig.timestamp)}</td>
                                  <td><strong style={{ fontFamily: 'monospace' }}>{sig.symbol}</strong></td>
                                  <td>
                                    <span className="badge" style={{
                                      background: style.color + '18',
                                      color: style.color,
                                      border: `1px solid ${style.color}40`,
                                      fontSize: '0.78rem',
                                      padding: '0.2rem 0.6rem',
                                    }}>
                                      {style.emoji} {style.label}
                                    </span>
                                  </td>
                                  <td style={{ fontFamily: 'monospace' }}>{sig.price?.toLocaleString()}</td>
                                  <td style={{ fontFamily: 'monospace' }}>{sig.qty?.toFixed ? sig.qty.toFixed(4) : sig.qty}</td>
                                  <td style={{ fontFamily: 'monospace', color: '#dc2626' }}>{sig.stop_loss?.toLocaleString()}</td>
                                  <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sig.comment || sig.source || '—'}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )
                  }
                </>
              )
            }
          </div>
        )}

      </div>
    </div>
  );
};

export default AdminDashboard;

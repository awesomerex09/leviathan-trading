import React, { useState, useEffect, useCallback } from 'react';
import { Users, ListChecks, Code2, Loader2, RefreshCw, Check, ChevronDown, ChevronUp } from 'lucide-react';
import {
  adminDbGetAllUsers,
  adminDbSetUserActive,
  adminDbSetUserPaid,
  adminDbGetWatchlist,
  adminDbUpdateWatchlist,
  adminDbGetStrategy,
  adminDbUpdateStrategy,
} from '../adminDb';

const AdminDashboard = ({ user, t }) => {
  const [tab, setTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [expandedUser, setExpandedUser] = useState(null);
  const [watchlist, setWatchlist] = useState([]);
  const [watchlistInput, setWatchlistInput] = useState('');
  const [watchlistLoading, setWatchlistLoading] = useState(false);
  const [watchlistStatus, setWatchlistStatus] = useState('');
  const [script, setScript] = useState('');
  const [scriptLoading, setScriptLoading] = useState(false);
  const [scriptStatus, setScriptStatus] = useState('');

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

  const fetchStrategy = useCallback(async () => {
    setScriptLoading(true);
    try { const data = await adminDbGetStrategy(); setScript(data.script || ''); }
    catch (e) { console.error(e); } finally { setScriptLoading(false); }
  }, []);

  useEffect(() => {
    if (tab === 'users') fetchUsers();
    if (tab === 'watchlist') fetchWatchlist();
    if (tab === 'strategy') fetchStrategy();
  }, [tab, fetchUsers, fetchWatchlist, fetchStrategy]);

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

  const saveStrategy = async () => {
    setScriptStatus('saving');
    try { await adminDbUpdateStrategy(script); setScriptStatus('success'); }
    catch (e) { console.error(e); setScriptStatus('error'); }
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
          <Code2 size={16} /> {t.admin_tab_strategy}
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
                  placeholder="每行一個代碼&#10;例如：&#10;TXF&#10;NVDA&#10;2330"
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

        {/* ── Strategy ── */}
        {tab === 'strategy' && (
          <div>
            <div className="section-header">
              <div>
                <h3>{t.admin_strategy_title}</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>{t.admin_strategy_sub}</p>
              </div>
              <button className="btn btn-black" onClick={saveStrategy} disabled={scriptLoading || scriptStatus === 'saving'}>
                {scriptStatus === 'saving'
                  ? <Loader2 size={16} className="animate-spin" />
                  : scriptStatus === 'success' ? <Check size={16} />
                    : t.admin_save_script}
              </button>
            </div>
            <div className="strategy-notice">
              <strong>📌 策略腳本說明</strong>
              <p>
                此處儲存的腳本由後端 Python 伺服器（Mac mini）直接解析並執行下單邏輯，
                <strong>不透過 TradingView PineScript</strong>。
                TradingView 只負責產生進出場訊號（Webhook），實際下單邏輯完全由本系統的
                <code>core_trader.py</code> 控制，確保 0 延遲、0 依賴外部平台。
              </p>
            </div>
            {scriptStatus === 'success' && <p style={{ color: '#16a34a', marginBottom: '1rem' }}>{t.admin_script_success}</p>}
            {scriptStatus === 'error' && <p style={{ color: '#e11d48', marginBottom: '1rem' }}>{t.admin_script_error}</p>}
            <textarea className="form-control code-editor" rows={32}
              value={script}
              onChange={e => { setScript(e.target.value); setScriptStatus(''); }}
              placeholder={t.admin_strategy_placeholder}
              style={{ fontFamily: '"Fira Code", monospace', fontSize: '0.82rem', lineHeight: '1.6' }} />
          </div>
        )}

      </div>
    </div>
  );
};

export default AdminDashboard;

import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, orderBy, limit, onSnapshot, doc, onSnapshot as onDocSnapshot } from 'firebase/firestore';
import { Loader2, Play, Pause, LineChart, List, Settings } from 'lucide-react';
import Chart from '../Chart';
import { saveCredentials, setActiveStatus } from '../api';

const ClientDashboard = ({ user, t }) => {
  const [tab, setTab] = useState('orders');
  const [isActive, setIsActive] = useState(false);
  const [activeLoading, setActiveLoading] = useState(false);
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [chartData, setChartData] = useState([]);
  const [chartMarkers, setChartMarkers] = useState([]);
  const [credForm, setCredForm] = useState({ api_key: '', secret_key: '', ca_path: '', ca_password: '', person_id: '' });
  const [credStatus, setCredStatus] = useState({ type: '', message: '' });
  const [credLoading, setCredLoading] = useState(false);

  // Listen to user doc for isActive
  useEffect(() => {
    const userRef = doc(db, 'users', user.uid);
    const unsub = onDocSnapshot(userRef, (snap) => {
      if (snap.exists()) {
        setIsActive(snap.data().isActive || false);
      }
    });
    return unsub;
  }, [user.uid]);

  // Listen to orders subcollection
  useEffect(() => {
    const q = query(
      collection(db, 'users', user.uid, 'orders'),
      orderBy('timestamp', 'desc'),
      limit(50)
    );
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setOrders(data);
      setOrdersLoading(false);
      const markers = data
        .filter(o => o.status === 'SUCCESS')
        .map(o => ({
          time: Math.floor(new Date(o.timestamp).getTime() / 1000),
          position: o.action === 'BUY' ? 'belowBar' : 'aboveBar',
          color: o.action === 'BUY' ? '#e11d48' : '#16a34a',
          shape: o.action === 'BUY' ? 'arrowUp' : 'arrowDown',
          text: `${o.action} ${o.symbol} @${o.price}`,
        }));
      setChartMarkers(markers);
    }, () => {
      // If permission denied (user not in Firestore yet), just show empty
      setOrdersLoading(false);
    });
    return unsub;
  }, [user.uid]);

  // Generate mock K-line data
  useEffect(() => {
    if (tab === 'chart' && chartData.length === 0) {
      const data = [];
      let price = 22000;
      let time = Math.floor(Date.now() / 1000) - 200 * 60;
      for (let i = 0; i < 200; i++) {
        const o = price + (Math.random() - 0.5) * 20;
        const c = o + (Math.random() - 0.5) * 40;
        data.push({ time: time + i * 60, open: o, high: Math.max(o, c) + Math.random() * 15, low: Math.min(o, c) - Math.random() * 15, close: c });
        price = c;
      }
      setChartData(data);
    }
  }, [tab, chartData.length]);

  const handleToggleActive = async () => {
    setActiveLoading(true);
    try {
      await setActiveStatus(!isActive);
    } catch (e) {
      console.error(e);
    } finally {
      setActiveLoading(false);
    }
  };

  const handleSaveCredentials = async (e) => {
    e.preventDefault();
    setCredLoading(true);
    setCredStatus({ type: '', message: '' });
    try {
      await saveCredentials(credForm);
      setCredStatus({ type: 'success', message: t.settings_success });
      setCredForm({ api_key: '', secret_key: '', ca_path: '', ca_password: '', person_id: '' });
    } catch (err) {
      setCredStatus({ type: 'error', message: `${t.settings_fail}${err.message}` });
    } finally {
      setCredLoading(false);
    }
  };

  return (
    <div className="dashboard-wrapper">
      {/* Status Banner */}
      <div className={`status-banner ${isActive ? 'status-banner-active' : ''}`}>
        <div>
          <h2>{t.dash_auto_title}</h2>
          <p>{isActive ? t.dash_auto_on : t.dash_auto_off}</p>
        </div>
        <button className={`toggle-btn ${isActive ? 'toggle-btn-stop' : 'toggle-btn-start'}`}
          onClick={handleToggleActive} disabled={activeLoading}>
          {activeLoading
            ? <Loader2 size={18} className="animate-spin" />
            : isActive
              ? <><Pause size={18} /> {t.dash_pause}</>
              : <><Play size={18} /> {t.dash_start}</>
          }
        </button>
      </div>

      {/* Tabs */}
      <div className="dashboard-tabs">
        <button className={tab === 'orders' ? 'tab active' : 'tab'} onClick={() => setTab('orders')}>
          <List size={16} /> {t.dash_tab_orders}
        </button>
        <button className={tab === 'chart' ? 'tab active' : 'tab'} onClick={() => setTab('chart')}>
          <LineChart size={16} /> {t.dash_tab_chart}
        </button>
        <button className={tab === 'settings' ? 'tab active' : 'tab'} onClick={() => setTab('settings')}>
          <Settings size={16} /> {t.dash_tab_settings}
        </button>
      </div>

      <div className="tab-content">
        {tab === 'orders' && (
          <div>
            <h3 style={{ marginBottom: '1rem' }}>{t.orders_title}</h3>
            {ordersLoading
              ? <div style={{ textAlign: 'center', padding: '3rem' }}><Loader2 size={32} className="animate-spin" /></div>
              : orders.length === 0
                ? <div className="empty-state">{t.orders_empty}</div>
                : (
                  <div className="orders-table">
                    <table>
                      <thead>
                        <tr>
                          <th>{t.orders_time}</th><th>{t.orders_symbol}</th>
                          <th>{t.orders_action}</th><th>{t.orders_price}</th>
                          <th>{t.orders_qty}</th><th>{t.orders_status}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orders.map(o => (
                          <tr key={o.id}>
                            <td>{new Date(o.timestamp).toLocaleString(t === 'zh' ? 'zh-TW' : 'en-US')}</td>
                            <td><strong>{o.symbol}</strong></td>
                            <td><span className={`badge ${o.action === 'BUY' ? 'badge-buy' : 'badge-sell'}`}>{o.action === 'BUY' ? t.action_buy : t.action_sell}</span></td>
                            <td>{o.price?.toLocaleString()}</td>
                            <td>{o.quantity}</td>
                            <td><span className={`badge ${o.status === 'SUCCESS' ? 'badge-success' : 'badge-fail'}`}>{o.status === 'SUCCESS' ? t.status_success : t.status_fail}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
            }
          </div>
        )}

        {tab === 'chart' && (
          <Chart data={chartData} markers={chartMarkers} title={t.chart_title} />
        )}

        {tab === 'settings' && (
          <div className="settings-grid">
            <div>
              <h3 style={{ marginBottom: '1.5rem' }}>{t.settings_title}</h3>
              <form onSubmit={handleSaveCredentials}>
                {[
                  { label: t.settings_api_key, key: 'api_key', type: 'text', placeholder: '請輸入永豐 API Key' },
                  { label: t.settings_secret, key: 'secret_key', type: 'password', placeholder: '••••••••••' },
                  { label: t.settings_person_id, key: 'person_id', type: 'text', placeholder: 'A123456789' },
                  { label: t.settings_ca_path, key: 'ca_path', type: 'text', placeholder: 'C:\\憑證.pfx 或 /Users/admin/憑證.pfx' },
                  { label: t.settings_ca_password, key: 'ca_password', type: 'password', placeholder: '••••••••' },
                ].map(({ label, key, type, placeholder }) => (
                  <div className="form-group" key={key}>
                    <label>{label}</label>
                    <input type={type} className="form-control" placeholder={placeholder}
                      value={credForm[key]} onChange={e => setCredForm({ ...credForm, [key]: e.target.value })} required />
                  </div>
                ))}
                {credStatus.message && (
                  <div className={`status-message status-${credStatus.type}`}>{credStatus.message}</div>
                )}
                <button type="submit" className="btn btn-full btn-black" disabled={credLoading} style={{ marginTop: '1.5rem' }}>
                  {credLoading ? <Loader2 size={18} className="animate-spin" /> : t.settings_save}
                </button>
              </form>
            </div>
            <div className="help-panel">
              <h3>{t.help_title}</h3>
              <ol>
                <li><strong>{t.help_1_title}</strong><p>{t.help_1_body} <a href="https://sinotrade.github.io/" target="_blank" rel="noreferrer">Shioaji API</a></p></li>
                <li><strong>{t.help_2_title}</strong><p>{t.help_2_body}</p></li>
                <li><strong>{t.help_3_title}</strong><p>{t.help_3_body}</p></li>
                <li><strong>{t.help_4_title}</strong><p>{t.help_4_body}</p></li>
              </ol>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClientDashboard;

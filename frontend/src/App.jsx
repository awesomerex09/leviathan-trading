import React, { useState, useEffect } from 'react';
import { auth, ADMIN_UID } from './firebase';
import { signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from 'firebase/auth';
import { Loader2, LogOut, BarChart2, ShieldCheck, TrendingUp, Server, Globe } from 'lucide-react';
import ClientDashboard from './pages/ClientDashboard';
import AdminDashboard from './pages/AdminDashboard';
import { detectLanguage, getTranslations } from './i18n';
import './index.css';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [view, setView] = useState('home');
  const [loginError, setLoginError] = useState('');
  const [lang, setLang] = useState(detectLanguage);
  const t = getTranslations(lang);

  const toggleLang = () => {
    const next = lang === 'zh' ? 'en' : 'zh';
    setLang(next);
    localStorage.setItem('lvis_lang', next);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleGoogleLogin = async () => {
    setAuthLoading(true);
    setLoginError('');
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Login failed:', error);
      setLoginError(t.login_failed);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  const scrollToLogin = () => {
    setView('home');
    setTimeout(() => {
      document.getElementById('login-form')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  // ── Loading screen ──
  if (loading) {
    return (
      <div className="loading-screen">
        <img src="/favicon.svg" alt="Leviathan" className="loading-logo" />
        <p>{t.loading}</p>
      </div>
    );
  }

  // ── Logged in ──
  if (user) {
    const isAdmin = user.uid === ADMIN_UID;
    return (
      <div className="app-shell">
        <nav className="navbar">
          <div className="nav-left">
            <div className="logo">
              <img src="/favicon.svg" alt="Leviathan Logo" />
              LEVIATHAN<sup style={{ fontSize: '0.6em', marginLeft: '2px' }}>®</sup>
            </div>
            {isAdmin && (
              <span className="admin-badge">ADMIN</span>
            )}
          </div>
          <div className="nav-actions">
            <button className="lang-toggle" onClick={toggleLang} title="Switch Language">
              <Globe size={15} />
              {lang === 'zh' ? 'EN' : '中文'}
            </button>
            <span className="user-email">{user.email}</span>
            <button onClick={handleLogout} className="btn btn-outline" style={{ gap: '0.5rem' }}>
              <LogOut size={16} /> {t.nav_logout}
            </button>
          </div>
        </nav>
        <main className="main-content">
          {isAdmin
            ? <AdminDashboard user={user} t={t} />
            : <ClientDashboard user={user} t={t} />
          }
        </main>
      </div>
    );
  }

  // ── Landing Page ──
  return (
    <>
      <nav className="navbar">
        <div className="nav-left">
          <div className="logo" onClick={() => setView('home')} style={{ cursor: 'pointer' }}>
            <img src="/favicon.svg" alt="Leviathan Logo" />
            LEVIATHAN<sup style={{ fontSize: '0.6em', marginLeft: '2px' }}>®</sup>
          </div>
          <div className="nav-links">
            <span onClick={() => setView('home')}>{t.nav_insights}</span>
            <span onClick={() => setView('pricing')}>{t.nav_pricing}</span>
          </div>
        </div>
        <div className="nav-actions">
          <button className="lang-toggle" onClick={toggleLang}>
            <Globe size={15} />
            {lang === 'zh' ? 'EN' : '中文'}
          </button>
          <button className="btn btn-black" onClick={scrollToLogin}>{t.nav_try_now}</button>
        </div>
      </nav>

      {view === 'pricing' ? (
        <div className="hero-section" style={{ marginTop: '10vh' }}>
          <h1 style={{ whiteSpace: 'pre-line' }}>{t.pricing_title}</h1>
          <p style={{ marginBottom: '2rem' }}>{t.pricing_sub}</p>
          <div className="glass-card pricing-card">
            <h2>{t.pricing_plan}</h2>
            <div className="price">$79<span>{t.pricing_month}</span></div>
            <ul className="features-list">
              <li>{t.pricing_feature1}</li>
              <li>{t.pricing_feature2}</li>
              <li>{t.pricing_feature3}</li>
              <li>{t.pricing_feature4}</li>
            </ul>
            <a href="https://whop.com/leviathan-6c7d/leviathan-signals/" target="_blank" rel="noreferrer"
              className="btn btn-full btn-black" style={{ marginTop: '1.5rem' }}>
              {t.pricing_cta}
            </a>
          </div>
        </div>
      ) : (
        <>
          <div className="hero-section">
            <h1 style={{ whiteSpace: 'pre-line' }}>{t.hero_title}</h1>
            <p style={{ whiteSpace: 'pre-line' }}>{t.hero_sub}</p>
            <div className="hero-btns">
              <button className="btn btn-black" onClick={scrollToLogin}>{t.hero_cta}</button>
              <button className="btn btn-outline" onClick={() => setView('pricing')}>{t.hero_pricing}</button>
            </div>
          </div>

          <div className="features-grid">
            {[
              { icon: <TrendingUp size={28} />, title: t.feature_strategy_title, desc: t.feature_strategy_desc },
              { icon: <BarChart2 size={28} />, title: t.feature_chart_title, desc: t.feature_chart_desc },
              { icon: <ShieldCheck size={28} />, title: t.feature_security_title, desc: t.feature_security_desc },
              { icon: <Server size={28} />, title: t.feature_multi_title, desc: t.feature_multi_desc },
            ].map((f, i) => (
              <div className="feature-card" key={i}>
                {f.icon}
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>

          <div className="app-container" id="login-form">
            <div className="glass-card">
              <div className="header">
                <h2>{t.login_title}</h2>
                <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem', fontSize: '0.9rem' }}>{t.login_sub}</p>
              </div>
              {loginError && (
                <div className="status-message status-error" style={{ marginBottom: '1.5rem' }}>{loginError}</div>
              )}
              <button
                type="button"
                className="btn btn-outline btn-full google-btn"
                onClick={handleGoogleLogin}
                disabled={authLoading}
              >
                {authLoading
                  ? <Loader2 size={18} className="animate-spin" />
                  : <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" style={{ width: '20px' }} />
                }
                {t.login_google}
              </button>
            </div>
          </div>
          <div style={{ height: '10vh' }}></div>
        </>
      )}
    </>
  );
}

export default App;

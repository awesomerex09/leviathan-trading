/**
 * i18n.js - 多語言支援
 * 自動偵測用戶的瀏覽器語言或地區，華人地區預設中文
 */

const translations = {
  zh: {
    // Navigation
    nav_insights: "洞察",
    nav_pricing: "訂閱方案",
    nav_try_now: "立即開始",
    nav_logout: "登出",

    // Hero
    hero_title: "精準投資，\n始於遠見。",
    hero_sub: "自動化量化交易，精準執行。\n為現代投資者打造的全方位系統。",
    hero_cta: "開始使用 ↗",
    hero_pricing: "查看方案",

    // Features
    feature_strategy_title: "LVIS V2 量化策略",
    feature_strategy_desc: "結構突破與趨勢延伸，動態加碼與熔斷機制完整整合。",
    feature_chart_title: "即時對帳分析",
    feature_chart_desc: "K 線圖疊加真實下單標記，一鍵比對回測與實盤差異。",
    feature_security_title: "AES-256 加密保護",
    feature_security_desc: "所有 API 金鑰與憑證均加密存放，資料永不離開伺服器。",
    feature_multi_title: "多帳戶同步下單",
    feature_multi_desc: "多執行緒並發執行，最小化所有訂閱者之間的下單時間差。",

    // Pricing
    pricing_title: "專業級量化交易。",
    pricing_sub: "訂閱 Leviathan Signals，解鎖自動化交易引擎完整存取權。",
    pricing_plan: "Leviathan Signals",
    pricing_month: "/月",
    pricing_feature1: "✓ 完整自動化 API 存取",
    pricing_feature2: "✓ 多帳戶同步下單執行",
    pricing_feature3: "✓ 即時 K 線對帳儀表板",
    pricing_feature4: "✓ 24/7 伺服器監控",
    pricing_cta: "立即訂閱 →",

    // Login
    login_title: "登入您的帳戶",
    login_sub: "登入後即可存取您的交易儀表板",
    login_google: "使用 Google 帳號繼續",
    login_failed: "登入失敗，請重試。",

    // Loading
    loading: "初始化中...",

    // Client Dashboard
    dash_auto_title: "自動下單狀態",
    dash_auto_on: "🟢 自動下單已啟用",
    dash_auto_off: "🔴 自動下單已暫停",
    dash_pause: "暫停下單",
    dash_start: "開始下單",
    dash_tab_orders: "下單紀錄",
    dash_tab_chart: "K 線對帳",
    dash_tab_settings: "API 憑證設定",
    orders_title: "下單紀錄（最近 50 筆）",
    orders_empty: "目前尚無下單紀錄",
    orders_time: "時間",
    orders_symbol: "標的",
    orders_action: "動作",
    orders_price: "價格",
    orders_qty: "數量",
    orders_status: "狀態",
    action_buy: "買入",
    action_sell: "賣出",
    status_success: "成功",
    status_fail: "失敗",
    chart_title: "台指期 TXF - 實盤對帳分析",
    settings_title: "設定永豐 API 憑證",
    settings_api_key: "API Key（金鑰）",
    settings_secret: "Secret Key（私鑰）",
    settings_person_id: "身分證字號",
    settings_ca_path: "憑證路徑（CA Path）",
    settings_ca_password: "憑證密碼（CA Password）",
    settings_save: "儲存並加密",
    settings_saving: "儲存中...",
    settings_success: "✅ 憑證已安全加密並儲存！",
    settings_fail: "❌ 儲存失敗：",
    help_title: "操作教學",
    help_1_title: "取得 API 金鑰",
    help_1_body: "前往 Shioaji API 官網，登入後於開發者後台申請 API 開通，審核後取得 API Key 與 Secret Key。",
    help_2_title: "申請交易憑證",
    help_2_body: "至永豐金「理財網」或「大戶投」APP，在憑證中心申請並匯出 .pfx 憑證檔案。",
    help_3_title: "憑證路徑填寫",
    help_3_body: "將 .pfx 存放至伺服器（Mac mini）固定路徑，填入該絕對路徑。",
    help_4_title: "安全保證",
    help_4_body: "所有敏感資料均透過 AES-256 加密，伺服器端解密執行，絕不以明文儲存或傳輸。",

    // Admin Dashboard
    admin_title: "🛡️ Leviathan 管理後台",
    admin_logged_as: "系統管理員：",
    admin_tab_users: "客戶管理",
    admin_tab_watchlist: "投資標的清單",
    admin_tab_strategy: "策略腳本編輯",
    admin_users_count: "所有訂閱用戶",
    admin_refresh: "刷新",
    admin_paid: "付費中",
    admin_unpaid: "未付費",
    admin_active: "自動下單中",
    admin_paused: "已暫停",
    admin_cancel_paid: "取消付費",
    admin_open_paid: "開通付費",
    admin_stop: "⏸ 暫停",
    admin_go: "▶ 啟動",
    admin_orders_title: "最近下單紀錄",
    admin_orders_empty: "尚無下單紀錄",
    admin_watchlist_title: "投資標的觀察清單",
    admin_watchlist_sub: "每行輸入一個標的代碼，儲存後即時同步至伺服器",
    admin_save: "儲存清單",
    admin_watchlist_count: "目前清單",
    admin_watchlist_success: "✅ 清單已更新！",
    admin_watchlist_error: "❌ 更新失敗，請確認伺服器連線。",
    admin_strategy_title: "LVIS V2 量化策略腳本編輯器",
    admin_strategy_sub: "修改後點擊儲存，腳本將同步至 Firestore 並可由伺服器讀取",
    admin_save_script: "儲存腳本",
    admin_script_success: "✅ 策略腳本已成功儲存！",
    admin_script_error: "❌ 儲存失敗，請確認伺服器連線。",
    admin_strategy_placeholder: "在此貼上 PineScript 策略腳本...",
  },

  en: {
    nav_insights: "Insights",
    nav_pricing: "Pricing",
    nav_try_now: "Try Now",
    nav_logout: "Logout",

    hero_title: "Bold Ideas That\nStart With Vision.",
    hero_sub: "Automated quantitative trading. Precision execution.\nBuilt for the modern investor.",
    hero_cta: "Get In Touch ↗",
    hero_pricing: "View Pricing",

    feature_strategy_title: "LVIS V2 Strategy",
    feature_strategy_desc: "Structural breakout & trend continuation with dynamic pyramiding and circuit breaker.",
    feature_chart_title: "Live Trade Overlay",
    feature_chart_desc: "K-line charts with real execution markers. Compare backtest vs live performance instantly.",
    feature_security_title: "AES-256 Security",
    feature_security_desc: "All API keys and credentials encrypted at rest. Your data never leaves the server.",
    feature_multi_title: "Multi-Account Execution",
    feature_multi_desc: "Concurrent multi-thread execution with minimal latency difference across all subscribers.",

    pricing_title: "Professional Grade\nQuantitative Trading.",
    pricing_sub: "Subscribe to Leviathan Signals and gain access to our automated trading engine.",
    pricing_plan: "Leviathan Signals",
    pricing_month: "/month",
    pricing_feature1: "✓ Full Automation API Access",
    pricing_feature2: "✓ Multi-Account Concurrent Execution",
    pricing_feature3: "✓ Real-time Trade Overlay Dashboard",
    pricing_feature4: "✓ 24/7 Server Monitoring",
    pricing_cta: "Subscribe Now →",

    login_title: "Access Your Account",
    login_sub: "Sign in to access your trading dashboard",
    login_google: "Continue with Google",
    login_failed: "Login failed. Please try again.",

    loading: "Initializing...",

    dash_auto_title: "Auto Trading Status",
    dash_auto_on: "🟢 Auto trading is ACTIVE",
    dash_auto_off: "🔴 Auto trading is PAUSED",
    dash_pause: "Pause Trading",
    dash_start: "Start Trading",
    dash_tab_orders: "Order History",
    dash_tab_chart: "Trade Overlay",
    dash_tab_settings: "API Credentials",
    orders_title: "Order History (Last 50)",
    orders_empty: "No orders yet.",
    orders_time: "Time",
    orders_symbol: "Symbol",
    orders_action: "Action",
    orders_price: "Price",
    orders_qty: "Qty",
    orders_status: "Status",
    action_buy: "BUY",
    action_sell: "SELL",
    status_success: "Success",
    status_fail: "Failed",
    chart_title: "TXF Futures - Live Trade Overlay",
    settings_title: "Configure Shioaji API Credentials",
    settings_api_key: "API Key",
    settings_secret: "Secret Key",
    settings_person_id: "National ID (Person ID)",
    settings_ca_path: "Certificate Path (CA Path)",
    settings_ca_password: "Certificate Password (CA Password)",
    settings_save: "Save & Encrypt",
    settings_saving: "Saving...",
    settings_success: "✅ Credentials saved and encrypted!",
    settings_fail: "❌ Save failed: ",
    help_title: "Setup Guide",
    help_1_title: "Get API Keys",
    help_1_body: "Visit the Shioaji API website, log in, and apply for API access in the developer portal. You'll receive an API Key and Secret Key.",
    help_2_title: "Apply for Trading Certificate",
    help_2_body: "Go to SinoTrade's online platform or the 'DaHu' APP. Apply and export a .pfx certificate file from the Certificate Center.",
    help_3_title: "Enter Certificate Path",
    help_3_body: "Store the .pfx file on your server (Mac mini) at a fixed path, then enter its absolute path here.",
    help_4_title: "Security Guarantee",
    help_4_body: "All sensitive data is protected with AES-256 encryption. Decryption only happens server-side during trade execution.",

    admin_title: "🛡️ Leviathan Admin Panel",
    admin_logged_as: "Administrator: ",
    admin_tab_users: "User Management",
    admin_tab_watchlist: "Watchlist",
    admin_tab_strategy: "Strategy Editor",
    admin_users_count: "All Subscribers",
    admin_refresh: "Refresh",
    admin_paid: "Paid",
    admin_unpaid: "Unpaid",
    admin_active: "Active",
    admin_paused: "Paused",
    admin_cancel_paid: "Revoke Paid",
    admin_open_paid: "Grant Paid",
    admin_stop: "⏸ Pause",
    admin_go: "▶ Activate",
    admin_orders_title: "Recent Orders",
    admin_orders_empty: "No orders yet.",
    admin_watchlist_title: "Investment Watchlist",
    admin_watchlist_sub: "Enter one symbol per line. Save to sync immediately to the server.",
    admin_save: "Save List",
    admin_watchlist_count: "Current list",
    admin_watchlist_success: "✅ Watchlist updated!",
    admin_watchlist_error: "❌ Update failed. Check server connection.",
    admin_strategy_title: "LVIS V2 Strategy Script Editor",
    admin_strategy_sub: "Edit and save the script to sync it to Firestore for the trading server to use.",
    admin_save_script: "Save Script",
    admin_script_success: "✅ Strategy script saved successfully!",
    admin_script_error: "❌ Save failed. Check server connection.",
    admin_strategy_placeholder: "Paste PineScript strategy here...",
  }
};

// 華人地區語言代碼
const CHINESE_LOCALES = ['zh', 'zh-TW', 'zh-CN', 'zh-HK', 'zh-SG', 'zh-MO'];

function detectLanguage() {
  const saved = localStorage.getItem('lvis_lang');
  if (saved && (saved === 'zh' || saved === 'en')) return saved;

  const browserLang = navigator.language || navigator.languages?.[0] || 'en';
  const isZh = CHINESE_LOCALES.some(l => browserLang.startsWith(l) || browserLang === l);
  return isZh ? 'zh' : 'en';
}

export function getTranslations(lang) {
  return translations[lang] || translations.en;
}

export { detectLanguage };
export default translations;

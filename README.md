# Leviathan - 自動化量化交易 SaaS 系統

> **量化模型代號：LVIS V2（Leviathan Intelligent Volume Strategy）**
> 本系統以 PineScript v6 策略為核心，透過 TradingView Webhook 驅動後端多帳戶自動下單，並提供完整的客戶端與管理端 Web 儀表板。

## 🌐 線上網址

**前端（GitHub Pages）**：https://awesomerex09.github.io/leviathan-trading/

---

## 專案目錄結構

```
auto/
├── README.md                     ← 本文件
├── v6.txt                        ← LVIS V2 PineScript 策略原始碼（機密）
├── list.txt                      ← 投資標的觀察清單（49 個標的，機密）
├── .github/workflows/deploy.yml  ← GitHub Actions 自動部署設定
│
├── frontend/                     ← 前端 React SPA
│   ├── public/favicon.svg        ← Leviathan 品牌 Logo
│   └── src/
│       ├── App.jsx               ← 主路由（Landing / Client / Admin）
│       ├── i18n.js               ← 中英文多語言支援（自動偵測華人地區）
│       ├── api.js                ← 集中式安全 API 客戶端（自動附加 Firebase Token）
│       ├── firebase.js           ← Firebase Client SDK 初始化
│       ├── Chart.jsx             ← TradingView Lightweight Charts K線元件
│       ├── index.css             ← 全局樣式
│       └── pages/
│           ├── ClientDashboard.jsx ← 客戶儀表板（下單紀錄/K線/憑證設定）
│           └── AdminDashboard.jsx  ← 管理員後台（客戶管理/Watchlist/策略腳本）
│
└── server/                       ← Python 後端（部署於 Mac mini - 常駐運行）
    ├── serviceAccountKey.json    ← Firebase Admin 金鑰（機密，不上傳 Git）
    ├── .env.example              ← 環境變數範本（複製為 .env 並填入實際值）
    ├── requirements.txt          ← Python 套件清單
    ├── main.py                   ← FastAPI 主程式，Webhook 接收端
    ├── core_trader.py            ← 多執行緒多帳戶下單核心（Shioaji）
    ├── firebase_client.py        ← Firebase Admin SDK（AES 加解密 + Firestore 操作）
    ├── admin_api.py              ← 管理員 API 路由（雙重驗證）
    ├── order_logger.py           ← 下單紀錄即時寫回 Firestore
    ├── chart_api.py              ← K 線資料與交易 Marker API
    ├── firestore.rules           ← Firestore Security Rules（需貼到 Firebase Console）
    ├── verify_firebase.py        ← Firebase 連線驗證腳本
    ├── mock_signal.py            ← 測試用 Webhook 模擬腳本
    └── telegram_notifier.py      ← Telegram Bot 下單通知
```

---

## 🚀 快速啟動

### 前端（本地開發）
```bash
cd frontend
npm install
npm run dev
# 開啟 http://localhost:5173/leviathan-trading/
```

### 後端（Mac mini 部署）
```bash
cd server
# 1. 複製環境變數範本
cp .env.example .env
# 2. 填入 AES_SECRET_KEY 和 WEBHOOK_SECRET
# 3. 確認 serviceAccountKey.json 存在
pip install -r requirements.txt
# 4. 驗證 Firebase 連線
python verify_firebase.py
# 5. 啟動伺服器
python main.py
```

---

## 系統架構

### 數據流
```
TradingView Webhook
      │  POST /webhook?secret=xxx
      ▼
FastAPI Server（Mac mini - 24/7 常駐）
      │
      ├── 驗證 Webhook Secret
      ├── firebase_client.py → 撈取 isActive=true 的付費用戶（AES 解密憑證）
      ├── core_trader.py     → Multi-thread 併發下單（Shioaji）
      └── order_logger.py   → 成交紀錄寫入 Firestore
```

### Firebase Firestore 結構
```
/users/{uid}
  - email: string
  - isPaid: boolean           ← 管理員開通
  - isActive: boolean         ← 客戶自行控制（暫停/開始下單）
  - api_key_enc: string       ← AES-256 加密
  - secret_key_enc: string    ← AES-256 加密
  - ca_password_enc: string   ← AES-256 加密
  - ca_path: string
  - person_id: string
  /orders/{auto_id}
    - symbol, action, price, quantity, status, timestamp

/watchlist/config
  - symbols: array            ← Admin 管理的投資標的清單

/strategy/v6
  - script: string            ← LVIS 量化模型腳本
  - updated_at: timestamp
```

---

## 使用者角色

### Client（訂閱者）
- Google 帳號登入（自動跳轉到客戶儀表板）
- 查看下單紀錄
- 查看 K 線圖與回測/實盤對帳分析
- 暫停/開始自動化下單
- 設定 Shioaji API 憑證（後端加密存儲）

### Admin（管理員）
- 登入後自動跳轉到管理員後台
- 查看所有客戶狀況
- 開通/取消付費、強制暫停/啟動下單
- 線上編輯投資標的觀察清單（list.txt 同步）
- 線上編輯 LVIS V2 量化策略腳本（v6.txt 同步）

---

## 🔐 資安設計

| 資產 | 保護方式 |
|------|----------|
| 客戶 API Key / Secret | AES-256-CBC 加密儲存於 Firestore |
| 量化模型腳本 | 存於 Server 本機 + Firestore，Admin Token 驗證讀寫 |
| Firebase Admin 金鑰 | 只存於 Server 本機，不上傳 Git（`.gitignore` 保護） |
| 後端 Webhook | 驗證 Secret Header，防止偽造請求 |
| Admin Panel | Firebase ID Token + Admin UID 白名單雙重驗證 |
| Firestore Rules | 用戶只能讀寫自己的文件，禁止前端直接寫入 |

---

## 技術棧

| 層次 | 技術 |
|------|------|
| 前端框架 | Vite + React 19 |
| 圖表套件 | TradingView Lightweight Charts v5 |
| 多語言 | 內建 i18n（中文/英文，自動偵測華人地區） |
| 身份驗證 | Firebase Authentication（Google Sign-In） |
| 雲端資料庫 | Firebase Firestore |
| 後端框架 | Python FastAPI + uvicorn |
| 加密 | PyCryptodome（AES-256-CBC） |
| 下單 API | 永豐金 Shioaji SDK |
| 通知 | Telegram Bot API |
| CI/CD | GitHub Actions → GitHub Pages |
| 部署 | 前端：GitHub Pages，後端：Mac mini 常駐 |

---

## ⚙️ 環境變數設定

### 後端（`server/.env`）
```env
AES_SECRET_KEY=your_32_char_secret_key_here!!  # 必須 32 字元
WEBHOOK_SECRET=your_webhook_secret_here
ADMIN_UIDS=Za2Y2KDjDDVLI7qkHCyhqdfnrMu1        # 您的 Firebase UID
SERVICE_ACCOUNT_PATH=serviceAccountKey.json
```

### GitHub Actions 環境變數
已在 https://github.com/awesomerex09/leviathan-trading/settings/variables/actions 設定：
- `VITE_ADMIN_UID` = `Za2Y2KDjDDVLI7qkHCyhqdfnrMu1`
- `VITE_API_BASE` = Mac mini 部署後更新為實際 IP 或 ngrok URL

---

## 📋 部署到 Mac mini 的步驟

1. **複製 server/ 資料夾**到 Mac mini
2. **複製 serviceAccountKey.json** 到 Mac mini 的 server/ 目錄
3. **建立 .env**（參考 .env.example）
4. **安裝套件**：`pip install -r requirements.txt`
5. **驗證連線**：`python verify_firebase.py`
6. **啟動伺服器**：`python main.py`（或設定 launchd 常駐）
7. **取得公開 IP**（建議使用 Cloudflare Tunnel 或 ngrok 取得 HTTPS URL）
8. **更新 GitHub Actions 變數** `VITE_API_BASE` 為 Mac mini 的公開 URL
9. **重新觸發部署**（push 任意修改到 main 即可自動部署）

---

## 📝 設計決策記錄

- **量化模型名稱**：LVIS V2（Leviathan Intelligent Volume Strategy）
- **訊號來源**：TradingView Webhook → FastAPI Server
- **策略執行方式**：
  - TradingView 只負責「偵測進出場訊號」並發送 Webhook
  - **實際下單邏輯完全由 `core_trader.py` (Python) 控制**，非 PineScript
  - 優點：0 延遲、0 依賴 TradingView 平台、可實現任意複雜邏輯
  - Admin 可在後台線上修改 Python 策略腳本，儲存後下次 Webhook 觸發時生效
- **多語言預設**：自動偵測瀏覽器語言，華人地區（zh-TW, zh-CN 等）預設中文
- **訂閱費用**：$79 USD/月，透過 [Whop](https://whop.com/leviathan-6c7d/leviathan-signals/) 收款
- **K 線圖表**：TradingView Lightweight Charts v5，疊加回測訊號點與實際成交點
- **Admin 識別**：透過 Firebase UID 白名單
- **Admin UID**：`Za2Y2KDjDDVLI7qkHCyhqdfnrMu1`
- **Admin 面板設計**：直接讀寫 Firestore（不需要後端伺服器在線），Watchlist/策略腳本管理完全獨立
- **Firestore Rules**：已發布，Admin UID 可讀寫所有文件；一般用戶只能讀自己的 orders/userDoc

---

## 🧪 Shioaji 模擬下單測試

> ⚠️ **注意：Shioaji 模擬模式仍需要 API Key**，不能在沒有帳號的情況下測試

```bash
# 1. 在 server/.env 加入
SHIOAJI_API_KEY=your_api_key
SHIOAJI_SECRET_KEY=your_secret_key

# 2. 安裝套件
pip install shioaji

# 3. 執行模擬測試（不會真正下單）
python test_shioaji_simulation.py
```

模擬模式（`simulation=True`）特性：
- ✅ 不需要 CA 憑證（.pfx 檔案）
- ✅ 不會真正下單
- ✅ 可測試完整下單流程、委託查詢
- ❌ 仍需要有效的 API Key + Secret Key（需永豐金帳戶）

---

## 🔗 相關連結

- **線上網站**：https://awesomerex09.github.io/leviathan-trading/
- **GitHub 倉庫**：https://github.com/awesomerex09/leviathan-trading
- **Firebase Console**：https://console.firebase.google.com/project/autolvis
- **訂閱頁面**：https://whop.com/leviathan-6c7d/leviathan-signals/
- **Shioaji API 文件**：https://sinotrade.github.io/

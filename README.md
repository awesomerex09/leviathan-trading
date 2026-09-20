# Leviathan - 自動化量化交易 SaaS 系統

> **量化模型代號：LVIS V2（Leviathan Intelligent Volume Strategy）**
> 本系統以 PineScript v6 策略為核心，透過 TradingView Webhook 驅動後端多帳戶自動下單，並提供完整的客戶端與管理端 Web 儀表板。

---

## 專案目錄結構

```
auto/
├── README.md               ← 本文件
├── v6.txt                  ← LVIS V2 PineScript 量化策略原始碼 (機密)
├── list.txt                ← 投資標的觀察清單 (機密)
│
├── frontend/               ← 前端 React SPA (部署於 GitHub Pages 或靜態伺服器)
│   ├── public/
│   │   ├── favicon.svg     ← Leviathan 品牌 Logo
│   │   └── icons.svg
│   └── src/
│       ├── main.jsx        ← 程式進入點
│       ├── App.jsx         ← 主路由與 UI 邏輯
│       ├── Chart.jsx       ← TradingView Lightweight Charts K線元件
│       ├── firebase.js     ← Firebase Client SDK 初始化
│       ├── index.css       ← 全局樣式 (網點背景/白色主題)
│       └── App.css
│
└── server/                 ← Python 後端 (部署於 Mac mini - 常駐運行)
    ├── serviceAccountKey.json  ← Firebase Admin 金鑰 (機密，不上傳 Git)
    ├── requirements.txt    ← 套件清單
    ├── main.py             ← FastAPI 主程式，Webhook 接收端
    ├── core_trader.py      ← 多執行緒多帳戶下單核心 (Shioaji)
    ├── firebase_client.py  ← Firebase Admin SDK，讀寫 Firestore
    ├── order_logger.py     ← 下單紀錄寫回 Firestore
    ├── admin_api.py        ← 管理員後台 API (watchlist/策略腳本管理)
    ├── chart_api.py        ← K 線歷史資料與交易 Marker API
    ├── mock_signal.py      ← 測試用 Webhook 模擬腳本
    └── telegram_notifier.py ← Telegram Bot 下單結果通知
```

---

## 系統架構設計

### 數據流
```
TradingView Webhook
      │  POST /webhook (with auth header)
      ▼
FastAPI Server (Mac mini)
      │
      ├── 驗證 Webhook Secret
      ├── firebase_client.py → 撈取 isActive=true 的付費用戶
      ├── core_trader.py     → Multi-thread 併發下單 (Shioaji)
      └── order_logger.py    → 將成交紀錄寫入 Firestore
```

### Firebase 資料庫結構 (Firestore)
```
/users/{uid}
  - email: string
  - isPaid: boolean         ← 是否為付費訂閱者
  - isActive: boolean       ← 是否啟用自動下單（客戶自行控制）
  - api_key_enc: string     ← AES-256 加密後的 API Key
  - secret_key_enc: string  ← AES-256 加密後的 Secret Key
  - ca_path: string         ← 憑證路徑（存伺服器本機）
  - ca_password_enc: string ← 加密後的憑證密碼
  - person_id: string       ← 身分證字號
  - positions: array        ← 目前資產配置
  - orders: array           ← 歷史下單紀錄

/watchlist
  /config (doc)
  - symbols: array          ← 投資標的觀察清單（Admin 管理）

/strategy
  /v6 (doc)
  - script: string          ← LVIS 量化模型腳本（Admin 管理）
  - updated_at: timestamp
```

---

## 使用者角色與功能

### Client (訂閱者)
- Google 帳號登入
- 查看自己的下單紀錄
- 查看自己的資產配置
- 暫停 / 開始自動化下單（寫入 `isActive` flag）
- K 線圖表與回測/實盤對帳分析

### Admin (管理員 - 您)
- 查看**所有客戶**的下單狀況與資產配置
- 強制暫停/開始任意客戶的自動化下單
- 管理投資標的觀察清單 (Watchlist)
- 線上編輯量化模型底層腳本

---

## 資安設計

| 資產 | 保護方式 |
|------|----------|
| 客戶 API Key / Secret | AES-256 加密儲存於 Firestore |
| 量化模型腳本 (v6.txt) | 儲存於 Server 本機 + Firestore，前端透過 Token 驗證讀寫 |
| Firebase Admin 金鑰 | 只存於 Server 本機，絕不打包進前端 |
| 後端 Webhook | 驗證 Secret Header，防止偽造請求 |
| Admin Panel | 透過 Firebase ID Token + Admin UID 白名單雙重驗證 |
| Firestore Security Rules | 每個用戶只能讀寫自己的文件，Admin 才能讀所有文件 |

---

## 技術棧

| 層次 | 技術 |
|------|------|
| 前端框架 | Vite + React |
| 圖表套件 | TradingView Lightweight Charts |
| 身份驗證 | Firebase Authentication (Google Sign-In) |
| 雲端資料庫 | Firebase Firestore |
| 後端框架 | Python FastAPI + uvicorn |
| 加密 | PyCryptodome (AES-256-CBC) |
| 下單 API | 永豐金 Shioaji SDK |
| 通知 | Telegram Bot API |
| 部署 | 前端：GitHub Pages / Vercel，後端：Mac mini 常駐 |

---

## 設計決策記錄 (Q&A)

- **量化模型名稱？** LVIS V2（Leviathan Intelligent Volume Strategy）
- **訊號來源？** TradingView Webhook → FastAPI Server
- **Telegram 用途？** 用於下單成功/失敗的結果回報
- **部署環境？** 開發中：Windows 本地 PC；正式：Mac mini Server
- **訂閱費用？** $79 USD/月，透過 [Whop](https://whop.com/leviathan-6c7d/leviathan-signals/) 收款
- **回測/實盤比對？** K 線圖表上同時顯示策略訊號點與實際成交點，方便監控滑價

---

## 開發進度

- [x] 階段一：Firebase 環境建置與前端基礎
- [x] 階段二：Python 後端雛形建立
- [x] 階段三：K 線圖表與實盤對帳分析基礎
- [/] 階段四：完整後端安全化改寫（進行中）
- [ ] 階段五：完整客戶端儀表板
- [ ] 階段六：管理員後台 (Admin Panel)
- [ ] 階段七：Firestore Security Rules 部署

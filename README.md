# LVIS Leviathan Trading System

> **Live Demo:** https://awesomerex09.github.io/leviathan-trading/

自動化量化交易訊號平臺，結合 Python 策略引擎（LVIS V6 邏輯）、Shioaji 模擬下單、Firebase 即時同步與 React 前端。

---

## 系統架構

```
本機 Windows 機器（VillainPrime）
│
├── server/
│   ├── run_simulation.py      ← 每日自動執行（Task Scheduler）
│   ├── live_trader.py         ← 策略計算 + Shioaji 下單
│   ├── lvis_strategy.py       ← LVIS V6 核心邏輯（私密，不上 git）
│   └── .env                   ← API 金鑰（私密，不上 git）
│
├── Windows Task Scheduler
│   ├── LVIS_TW_DailyStockScan  → 每週一～五 13:35（台股收盤後）
│   └── LVIS_US_DailyStockScan  → 每週一～五 04:10（美股收盤後）
│
└── 寫入 Firestore（Firebase）
        ├── signals/           ← 進出場訊號
        ├── sim_orders/        ← Shioaji 模擬委託記錄
        └── watchlist/config   ← 49 個監控標的

GitHub Pages（公開前端）
└── React SPA（Vite build）
    ├── 管理後台 / Admin Dashboard
    │   └── 訂閱管理：切換用戶 isPaid / isActive
    └── 客戶端 / Client Dashboard
        ├── K 線圖 + 訊號標記（49 個標的）
        ├── 投資組合（持倉 / 報酬率 / 資金）
        └── 委託記錄（模擬單）
```

---

## 策略邏輯摘要（V6）

| 參數 | 預設值 | 說明 |
|------|--------|------|
| 最小下單單位 | 3,500 | 本金 < 875,000 時固定 |
| 倉位比例 | 1 : 1.5 : 1.5 : 1 | 換算最小 3500 / 5250 / 5250 / 3500 |
| 本金門檻 | 17,500 × 50 = 875,000 | 超過後等比例放大 |
| 最大標的數 | 49 | 訊號時依可用資金順序進場 |
| 加倉機制 | 雙倍倉位（符合條件時） | 資金不足時跳過，非錯誤 |

> 進出場機制、濾波條件、停損停利等細節與 `v6.txt` Pine Script 邏輯完全相同。

---

## 每日自動化排程

系統透過 **Windows 工作排程器（Task Scheduler）** 全自動執行，無需手動干預：

| 任務名稱 | 執行時間（台北） | 說明 |
|----------|-----------------|------|
| `LVIS_TW_DailyStockScan` | 週一～五 **13:35** | 台股收盤後掃描訊號 |
| `LVIS_US_DailyStockScan` | 週一～五 **04:10** | 美股收盤後掃描訊號 |

執行流程：
1. `run_tw_scan.bat` / `run_us_scan.bat` 啟動 Python
2. 連線 Shioaji → 模擬下單（`simulation=True`）
3. 計算 LVIS V6 訊號
4. 寫入 Firestore（signals / sim_orders）
5. 前端自動更新（Firestore 即時監聽）

日誌路徑：
- `logs/lvis_tw.log`
- `logs/lvis_us.log`

---

## 管理員操作流程

1. 登入 https://awesomerex09.github.io/leviathan-trading/ （管理員帳號）
2. 進入「Users」分頁
3. 找到新用戶 → 切換 **isPaid** / **isActive** 為 `true`
4. 客戶立即解鎖完整功能（無需重新登入）

> 管理員 UID：`Za2Y2KDjDDVLI7qkHCyhqdfnrMu1`（Firebase project: `autolvis`）

---

## 客戶端功能

- **登入後（未訂閱）**：只看到訂閱說明頁
- **訂閱後（isPaid = true）**：
  - 📊 K 線圖：選擇 49 個標的中任一，顯示進出場標記
  - 💼 投資組合：現有持倉、投入金額、累積報酬率
  - 📋 委託記錄：所有模擬下單歷史

---

## 技術棧

| 層級 | 技術 |
|------|------|
| 前端 | React 18 + Vite + lightweight-charts v5 |
| 資料庫 | Firebase Firestore（即時同步） |
| 身份驗證 | Firebase Auth |
| 策略引擎 | Python 3.10 + pandas + yfinance |
| 下單 API | Shioaji（永豐金證券）`simulation=True` |
| CI/CD | GitHub Actions → GitHub Pages |

---

## 部署說明

### 前端（GitHub Pages）
```bash
# 推送 frontend/ 變更即自動部署（.github/workflows/deploy.yml）
git add frontend/
git commit -m "feat: ..."
git push origin main
```

### 後端（本機，永不上 git）
```bash
cd server
pip install -r requirements.txt
python run_simulation.py   # 手動測試
```

### 工作排程器（一次性設定）
```cmd
# 已建立完成，無需重複執行
# 手動查詢狀態：
schtasks /query /tn "LVIS_TW_DailyStockScan" /fo LIST
schtasks /query /tn "LVIS_US_DailyStockScan" /fo LIST

# 手動觸發測試：
schtasks /run /tn "LVIS_TW_DailyStockScan"
```

---

## 重要：不進入版本控制的機密檔案

以下檔案僅存於本機，**絕對不能推送至 GitHub**：

| 檔案 / 目錄 | 原因 |
|------------|------|
| `server/` | 策略核心邏輯 + API 金鑰 |
| `.env` | Shioaji API Key / Secret |
| `Sinopac.pfx` | 永豐金憑證 |
| `serviceAccountKey.json` | Firebase Admin SDK 金鑰 |
| `v6.txt` | Pine Script 策略原始碼 |
| `list.txt` | 標的清單 |
| `firebase.json` / `.firebaserc` | Firebase 本地配置 |

已在 `.gitignore` 中排除，請勿手動 `git add` 上述檔案。

---

## 注意事項

- **模擬模式**：`.env` 中 `SIMULATION_MODE=true`，所有委託為模擬單，不動用真實資金
- **期貨**：需填寫 `.env` 中 `CA_PASSWORD` 才能啟用，目前未啟用
- **台股標的**：透過 Shioaji 直接下單；美股透過 yfinance 歷史資料計算訊號
- **資金不足時跳過**：屬正常行為，不代表錯誤

---

*Last updated: 2026-10-29*

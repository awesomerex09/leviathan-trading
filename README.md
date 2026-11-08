# LVIS Leviathan Trading System

> **Live Demo:** https://awesomerex09.github.io/leviathan-trading/

全自動量化交易平台，結合 Python 策略引擎（LVIS V2）、Shioaji API 下單、Firebase 即時資料同步與 React 前端。

---

## 系統架構

```
本機 Windows 機器
├── server/（機密，不上傳 git）
│   ├── run_simulation.py      每日自動排程主程式
│   ├── lvis_strategy.py       LVIS V2 策略邏輯（商業機密）
│   ├── firebase_client.py     Firestore 讀寫封裝
│   ├── .env                   API 金鑰（機密）
│   └── Sinopac.pfx            永豐金 CA 憑證（真實下單用）
├── Windows Task Scheduler
│   ├── LVIS_TW_DailyStockScan  週一～五 13:35（台股收盤後）
│   └── LVIS_US_DailyStockScan  週一～五 04:10（美股收盤後）
└── 寫入 Firestore（Firebase）
    ├── signals/           策略訊號
    ├── sim_orders/        Shioaji 委託記錄（模擬/真實）
    ├── price_data/        真實 OHLC 日線（yfinance 同步）
    ├── failed_orders/     失敗委託（補單追蹤，前端不可見）
    └── watchlist/config   49 個監控標的

GitHub Pages（公開前端）
└── React SPA（Vite build）
    ├── 管理後台 / Admin Dashboard
    │   ├── 訂閱管理：用戶 isPaid / isActive 開關
    │   └── 最近 sim_orders 委託記錄
    └── 客戶端 / Client Dashboard
        ├── K 線圖（真實 OHLC + 訊號 Marker，49 個標的）
        ├── 投資組合（持倉 / 損益 / 資產總覽）
        └── 委託記錄（模擬單狀態、補單追蹤說明）
```

---

## 策略邏輯說明（V2）

| 參數 | 預設值 | 說明 |
|------|--------|------|
| 最小單筆下單額 | 3,500 | 本金 < 875,000 時固定 |
| 加碼比例 | 1 : 1.5 : 1.5 : 1 | 分批 3500 / 5250 / 5250 / 3500 |
| 總本金目標 | 17,500 × 50 = 875,000 | 超過後按比例擴大 |
| 最大監控數 | 49 | 訊號分配可用資金到各市場 |
| 倍倉條件 | 超倍倉（符合條件） | 資金不足時跳過（不報錯） |

> 出場條件、濾波條件、動態槓桿等細節，請見 `v6.txt` Pine Script 邏輯完全對應。

---

## 每日自動排程

系統使用 **Windows 工作排程器（Task Scheduler）** 自動執行，無需人工干預：

| 任務名稱 | 執行時間（台北） | 說明 |
|----------|-----------------|------|
| `LVIS_TW_DailyStockScan` | 週一～五 **13:35** | 台股收盤後掃描 |
| `LVIS_US_DailyStockScan` | 週一～五 **04:10** | 美股收盤後掃描 |

**執行流程：**
1. `run_simulation.py` 啟動
2. Shioaji 登入（simulation=True 或 False）
3. 🔄 **補單檢查**：讀取上次失敗的委託，若訊號仍有效自動重試（最多 3 次）
4. 下載 benchmark（0050.TW）
5. 台股 31 個標的：yfinance → LVIS V2 → Shioaji 下委託
6. 美股 18 個標的：yfinance → LVIS V2 → 訊號寫 Firestore
7. 更新 price_data（前端 K 線圖真實行情）
8. 所有訊號 + 委託寫入 Firestore

**日誌路徑：**
- `logs/lvis_tw.log`（台股排程）
- `logs/lvis_us.log`（美股排程）

---

## 委託失敗補單機制

下單失敗的情況（Shioaji `OrderStatus.Failed`）通常發生在：
- 非交易時間下單（盤後、假日）
- 委託價格超出漲跌停限制
- 網路短暫中斷

**補單流程：**
1. 下單失敗 → 寫入 Firestore `failed_orders/{symbol}_TW`
2. 下次排程執行時，優先讀取待補單記錄
3. 用當日最新收盤價重新下單
4. 補單成功 → 刪除 `failed_orders` 記錄
5. 超過 3 次失敗 → 停止補單（需人工確認）

---

## 管理員操作流程

1. 登入 https://awesomerex09.github.io/leviathan-trading/（管理員帳號）
2. 進入「Users」頁面
3. 找到用戶，將 **isPaid** / **isActive** 設為 `true`
4. 客戶端立即獲得完整功能（無需重新登入）

> 管理員 UID：`Za2Y2KDjDDVLI7qkHCyhqdfnrMu1`（Firebase project: `autolvis`）

---

## 客戶端功能說明

- **登入後未訂閱**：只看到訂閱說明（Locked 畫面）
- **訂閱後（isPaid = true）**：
  - 📈 K 線圖：選取 49 個標的中任一，顯示真實 OHLC 日線 + 策略進出場 Markers
  - 💼 投資組合：持倉明細、損益金額、累積報酬率（模擬環境）
  - 📋 委託紀錄：Shioaji API 真實委託記錄，含狀態說明
  - ⚙️ 帳號設定：訂閱狀態、下單環境、排程時間

**委託狀態說明：**
| 狀態 | 意義 |
|------|------|
| ✅ PendingSubmit | 委託已成功送出，Shioaji 模擬環境受理 |
| ❌ Failed | 委託失敗（非交易時間、漲跌停、網路問題） |

---

## 真實下單啟用（SIMULATION_MODE=false）

> ⚠️ **警告**：啟用後委託將使用真實資金，請確認策略邏輯無誤後再啟用。

**前提條件：**
1. 已在永豐金開戶並申請 API 權限
2. 已下載 CA 憑證（`Sinopac.pfx`）
3. 本金充足（建議先從小部位開始）

**啟用步驟：**
1. 在 `server/.env` 設定：
   ```env
   SIMULATION_MODE=false
   CA_PATH=Sinopac.pfx
   CA_PASSWORD=你的憑證密碼
   CA_PERSON_ID=你的身分證字號
   ```
2. 先手動執行 `python run_simulation.py` 測試 1-2 筆
3. 確認委託正確後再恢復 Task Scheduler 自動執行

**申請永豐金 API：**
- 官方文件：https://sinotrade.github.io/
- 需完成開戶 + 申請 API 權限（通常 1-3 個工作天審核）

---

## 技術棧

| 層級 | 技術 |
|------|------|
| 前端 | React 18 + Vite + lightweight-charts v5 |
| 資料庫 | Firebase Firestore（即時同步） |
| 身份驗證 | Firebase Auth |
| 策略引擎 | Python 3.10 + pandas + yfinance |
| 下單 API | Shioaji（永豐金證券）|
| CI/CD | GitHub Actions → GitHub Pages |

---

## 部署說明

### 前端（GitHub Pages）
```bash
# frontend/ 變更後自動部署（.github/workflows/deploy.yml）
git add frontend/
git commit -m "feat: ..."
git push origin main
```

### 後端（本機，不上傳 git）
```bash
cd server
pip install -r requirements.txt
python run_simulation.py   # 手動測試
```

### 工作排程器（一次性設定）
```cmd
# 查詢現有任務
schtasks /query /tn "LVIS_TW_DailyStockScan" /fo LIST
schtasks /query /tn "LVIS_US_DailyStockScan" /fo LIST

# 手動觸發測試
schtasks /run /tn "LVIS_TW_DailyStockScan"
```

---

## 安全機制

### Firestore Security Rules
| 集合 | 讀取權限 | 寫入權限 |
|------|----------|----------|
| `users/{uid}` | 本人 / Admin | 本人（限部分欄位） / Admin |
| `watchlist/` | 所有登入用戶 | Admin 限定 |
| `strategy/` | Admin 限定 | Admin 限定 |
| `signals/` | 所有登入用戶 | 後端 Admin SDK 限定 |
| `sim_orders/` | 所有登入用戶 | 後端 Admin SDK 限定 |
| `price_data/` | 所有登入用戶 | 後端 Admin SDK 限定 |
| `failed_orders/` | ❌ 完全禁止 | 後端 Admin SDK 限定 |

### 用戶資料保護
- API 金鑰（Shioaji）以 AES-256-CBC 加密存入 Firestore，解密僅在後端進行
- `isPaid` / `isActive` 只有 Admin 能修改，用戶無法自行升級
- `failed_orders` 前端完全不可讀取（規則層硬性拒絕）

---

## ⚠️ 注意：絕不能推送到 GitHub 的檔案

| 檔案 / 目錄 | 原因 |
|------------|------|
| `server/` | 策略邏輯 + API 金鑰 |
| `.env` | Shioaji API Key / Secret |
| `Sinopac.pfx` | 永豐金 CA 憑證 |
| `serviceAccountKey.json` | Firebase Admin SDK 金鑰 |
| `v6.txt` | Pine Script 策略原始碼 |
| `list.txt` | 自定義標的清單 |
| `firebase.json` / `.firebaserc` | Firebase 本地設定 |

已在 `.gitignore` 中排除，請勿手動 `git add` 上述檔案。

---

*Last updated: 2026-11-08*

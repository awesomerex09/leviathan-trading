沒問題，Villain。我已經將整份 `Implementation_Plan.md` 更新完畢。其中第一部分的「法律防線」與第二部分的「區塊 B」皆已將「哥哥」的稱呼去除，並加上了彈性調整的說明，且為程式碼與段落加上了易讀的排版，你可以直接複製以下內容使用：

---

# Implementation_Plan.md

這是一份為你們量產的 量化自動跟單 SaaS 平台（GitHub + Firebase + Mac mini） 兼職創業完整執行計畫（Implementation Plan）。
本計畫分為兩大部分：第一部分為【整體企劃方向與商業閉環】，用以凝聚團隊共識；第二部分為【開發與執行指令集】

---

## 📊 第一部分：整體企劃方向與商業閉環

## 🎯 1. 核心定位

本項目定位為 「量化交易資訊軟體服務商（SaaS）」。
我們不經手客戶資金、不代管帳戶密碼、不保證獲利。我們透過網頁收集用戶主動授權的券商下單金鑰（API Key），由我們的高效能大腦伺服器（Mac mini）進行「多帳戶分散式同步下單」，提供客戶「一鍵設定、關機躺平」的極致懶人自動化體驗。

## 💰 2. 獲利模式（雙引擎收入）

* **引擎 A（軟體訂閱費）：** 向用戶收取固定的系統使用費（例如：每月 2,000 元台幣），不採取「獲利分潤」，確保 100% 避開非法代操法規。


* **引擎 B（券商退佣/折讓）：** 用戶必須透過我們團隊專屬的「永豐金開戶連結」進行跟單。用戶交易產生的手續費，由永豐金法人業務結算「退佣」給我們團隊，隨著用戶數與交易量放大，這將成為極其龐大的被動收入。



## 🛡 3. 法律與技術防線（零踩雷設計）

* **資金防線：** 資金全數在用戶個人的永豐金帳戶中。永豐金 Shioaji API 預設無出金/轉帳功能，完全杜絕資安提款風險。


* **法規防線：** 由 CFA 三級分析師負責所有對外文案與合規免責聲明。不推薦個股，不公開喊盤，100% 屬於資訊工具販售。



---

## 🤖 第二部分：給 Agent/開發夥伴執行的內容

請將以下內容直接複製給負責技術開發、法規風控與業務對接的執行夥伴。

---

## 🛠 區塊 A：給 Python / 網頁後端工程師 (Agent 執行指令)

### 1. 系統架構設計 (Data Flow)

* **前端 (Frontend):** 部署於 GitHub Pages (靜態 HTML/JS) 或使用 Vite/React 搭建的高品質 SPA。
* **後端/資料庫 (Backend/Database):** Firebase Authentication (支援 Google 登入) + Firestore (儲存 API Key)。
* **大腦伺服器 (Trading Server):** 本地端 Mac mini 執行 24 小時 Python 常駐程式 (Daemon)，提供 Webhook 接收與 Shioaji 多帳戶併發下單。
* **視覺化分析 (K-Line Overlay):** 提供實盤與回測圖表疊加，監控滑價與下單延遲。



### 2. Firebase Firestore 資料結構設計 (Schema)

在 Firestore 中建立 `users` 集合，每位用戶的 Document 欄位如下：

```json
{
  "uid": "FIREBASE_AUTH_UID",
  "email": "user@example.com",
  "isPaid": true,
  "sinopac_api_key": "ENCRYPTED_API_KEY",
  "sinopac_secret_key": "ENCRYPTED_SECRET_KEY",
  "sinopac_ca_path": "ca_file_path_or_string",
  "sinopac_ca_password": "ENCRYPTED_PASSWORD",
  "updatedAt": "TIMESTAMP"
}

```

**安全要求：** 前端網頁將金鑰送出前，需經 AES 加密，解密金鑰（Salt）僅保留在 Mac mini 本地端環境變數中。

### 3. Mac Mini 本地端 Python 核心代碼範例 (多帳戶併發下單)

請在 Mac mini 上安裝環境：`pip install shioaji requests pyyaml`。
以下為大腦伺服器核心的多執行緒（Multi-threading）下單架構，請以此為基底擴充：

```python
import threading
import logbook
import shioaji as sj
from firebase_admin import credentials, firestore, initialize_app

# 1. 初始化 Firebase (請替換為你們的 serviceAccountKey.json)
cred = credentials.Certificate("serviceAccountKey.json")
initialize_app(cred)
db = firestore.client()

logger = logbook.Logger("TradingBrain")

def execute_order_for_user(user_data, order_details):
    """單一用戶的下單執行緒"""
    api = sj.Shioaji()
    try:
        # 激活並登入該用戶的永豐金 API
        api.login(
            api_key=user_data['sinopac_api_key'],
            secret_key=user_data['sinopac_secret_key'],
            contracts_cb=lambda x: logger.info(f"Contracts loaded for {user_data['uid']}")
        )
        
        # 載入憑證
        api.activate_ca(
            ca_path=user_data['sinopac_ca_path'],
            ca_passwd=user_data['sinopac_ca_password'],
            person_id=user_data['person_id'] # 需請用戶提供身分證字號以激活憑證
        )
        
        # 建立期貨/股票合約對象 (以台指期近月為例，實際依訂單調整)
        contract = api.Contracts.Futures.TXF[order_details['target_month']]
        
        # 建立訂單對象
        order = api.Order(
            action=order_details['action'],       # sj.constant.Action.Buy 或 Sell
            price=order_details['price'],         # 價格 (市價或限價)
            quantity=order_details['quantity'],   # 口數/股數
            order_type=order_details['order_type'], # sj.constant.OrderType.IOC / ROC / FOK
            price_type=order_details['price_type'], # sj.constant.StockPriceType.MKT (市價) 或 LMT (限價)
            octype=sj.constant.FuturesOCType.Auto
        )
        
        # 送出下單
        trade = api.place_order(contract, order)
        logger.info(f"User {user_data['uid']} Order Sent: {trade}")
        
        # 登出釋放連線
        api.logout()
    except Exception as e:
        logger.error(f"Failed to execute order for user {user_data['uid']}: {str(e)}")
        # 這裡需串接 LINE Notify 警報機制，第一時間通知團隊人為介入

def on_tradingview_signal(signal_payload):
    """
    當大腦接收到 TradingView 訊號(或本地邏輯觸發)時調用
    signal_payload 範例: {'action': 'Buy', 'price': 0, 'price_type': 'MKT', 'quantity': 1}
    """
    # 撈取所有已付費的活躍用戶
    users_ref = db.collection("users").where("isPaid", "==", True).stream()
    threads = []
    
    order_details = {
        'action': sj.constant.Action.Buy if signal_payload['action'] == 'Buy' else sj.constant.Action.Sell,
        'price': signal_payload['price'],
        'quantity': signal_payload['quantity'],
        'price_type': sj.constant.StockPriceType.MKT if signal_payload['price_type'] == 'MKT' else sj.constant.StockPriceType.LMT,
        'order_type': sj.constant.OrderType.IOC, # 市價單通常搭配 IOC
        'target_month': '補上當月代碼' # 例如 '202610'
    }
    
    # 啟動多執行緒同步下單，防範同步循序下單造成的滑價延遲
    for doc in users_ref:
        user_data = doc.to_dict()
        t = threading.Thread(target=execute_order_for_user, args=(user_data, order_details))
        threads.append(t)
        t.start()
        
    for t in threads:
        t.join()
    logger.info("All user orders processed.")

```

---

## 📈 區塊 B：給 CFA / 證券分析師執行指令（此部分角色與職責可依團隊實際營運需求彈性調整）

請主要負責撰寫網頁的「免責聲明 (Disclaimer)」與「用戶合約條款」，建立完美的法律防火牆：

1. **條款核心關鍵字：**
* 明確定義本網站為「交易輔助資訊軟體提供商」。


* 用戶點擊跟單，屬於「用戶自行授權之自動化跟隨行為」，非本團隊主觀代操。


* 明確聲明「歷史回測績效不保證未來獲利」，使用者需自負盈虧。




2. **收費名目釐清：**
* 所有收費一律命名為「系統租用費」或「資訊訂閱費」。


* 文案中絕對不能出現「利潤拆分」、「賺錢後分二成」、「沒賺錢退費」等具有全委代操色彩的敘述。




3. **社群風控（LINE群/Discord）：**
* 在社群聊天時，若有客戶詢問「明天台指期怎麼看？」或「某某股票可不可以買？」，請由分析師以專業的觀點進行廣泛的總經或技術面客觀分析，切勿給出「點位推薦」或「帶單跟著買」的直白投資建議。





---

## 🤝 區塊 C：給商務對接與談判窗口 (開會準備清單)

請與永豐金法人業務約定正式會議，並索取以下商務條件：

1. **申請 API 開發權限：** 請業務協助團隊成員的測試帳號開通 Shioaji API 的實盤交易與憑證權限，並詢問是否有提供「模擬交易環境（Simulation Mode）」供前期測試。


2. **索取「專屬推薦開戶碼 / 連結」：**
* 要求永豐金生成一條你們團隊專屬的線上開戶連結（或業務代碼）。


* 未來你們的網頁用戶，必須透過這條連結開立永豐金證券與期貨戶頭。




3. **手續費折讓與退佣談判（重點）：**
* **談判籌碼：** 告知業務：「我們團隊由 CFA 三級分析師把關，策略已經 Ready。首批預計有 X 位客戶同時開戶，預估每月台指期總交易量可達 Y 口（或股票波段週轉率）。」


* **要求條件：** 爭取最低的「期貨每口淨手續費」與「股票手續費折讓折數」。並確認券商每個月如何將手續費折讓利潤（退佣）撥款至你們的對接帳戶中。





---

## 💡 補充技術細節與測試方針

核心大腦是用 Python 撰寫，Python 具備極強的跨平台特性。你在 Windows 寫好的 .py 程式檔、設定檔，可以直接 100% 複製到 Mac mini 上執行。

📥 **可以直接傳檔案嗎？會不會影響什麼？**
可以透過雲端硬碟（Google Drive）、隨身碟或 GitHub 直接傳送代碼檔案。直接傳檔不會影響程式邏輯，但從 Windows 移到 Mac 時，有以下 3 個技術細節需要工程師注意調整：

* **檔案路徑的斜線方向（最常見的 Bug）：**
Windows 路徑使用反斜線： `"C:\Users\admin\desktop\憑證.pfx"`


Mac / Linux 使用正斜線： `"/Users/admin/desktop/憑證.pfx"`


**解法：** 在寫 Python 時，引入 `os.path` 或 `pathlib` 庫來處理路徑，這樣程式就會自動適應 Windows 與 Mac，完全不用手動改程式。


* **永豐金憑證的安裝與路徑：**
在 Windows 上，Shioaji API 通常會去讀取副檔名為 `.pfx` 或已匯入 Windows 憑證帳戶的資料。移轉到 Mac 時，用戶的憑證檔案（`.pfx`）路徑必須正確餵給 Python 的 `api.activate_ca()` 函式，且 Mac 系統本身不需要像 Windows 那樣點擊兩下安裝憑證，只要確保 Python 能讀到該檔案即可。


* **環境套件的重新安裝：**
不要直接把 Windows 的 Python 資料夾整個複製過去。
**正確做法：** 在 Windows 開發完成後，於終端機輸入 `pip freeze > requirements.txt` 導出套件清單。到了 Mac 之後，直接執行 `pip install -r requirements.txt`，Mac 就會自動下載並編譯適合蘋果晶片（M系列）的 Shioaji 與 Firebase 套件，確保 100% 相容。



🔎 **一、 怎麼測試好幾個用戶的模擬單？**
永豐金的 Shioaji API 提供了非常佛心的 「模擬交易環境（Simulation Mode）」。要測試「多帳戶同步分頭下單」，你們團隊不需要強迫朋友去開戶拿 API Key，自己就能搞定：

1. **永豐金內建的多帳戶模擬法（最正統）**


永豐金的模擬環境（帳號通常是 SinoPac 的測試字串）是公開且不限單一連線的。
**作法：** 你們可以在 Python 程式碼中，複製出 5 個或 10 個不同的測試金鑰物件，或者用同一個模擬帳號，同時啟動 10 個 Thread（執行緒）分頭登入。
**驗證重點：** 這樣就能測試當 TradingView 訊號來時，你們的 Mac mini 能不能在 0.1 秒內同時對永豐金的伺服器發射 10 筆訂單，並同時收到 10 筆回報。


2. **自建「本地沙盒（Sandbox）」測試法（最推薦、最安全）**


在實際把訊號送給永豐金之前，你們的 Python 工程師通常會寫一個「假券商模組（Mock API）」。
**作法：** 在 Firebase 建立 50 個假用戶資料。訊號觸發時，Mac mini 不去連永豐金，而是把這 50 筆訂單直接打到本地的一個 Log 檔案或另一個資料庫裡，並記錄每筆訂單發射的毫秒時間戳（Timestamp）。
**驗證重點：** 檢查時間戳。如果第 1 個用戶跟第 50 個用戶的下單時間差小於 50 毫秒（0.05秒），就代表你們的多執行緒併發架構完美過關，實盤絕對不會卡頓。
# ============================================================
# main.py
# FastAPI 主程式。
# - Webhook 端點接收 TradingView 訊號
# - API 端點供前端呼叫（儲存憑證、控制下單開關）
# - 所有敏感端點需驗證 Firebase ID Token
# ============================================================
import os
import logbook
from fastapi import FastAPI, HTTPException, Header, BackgroundTasks, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

import firebase_admin
from firebase_admin import auth as firebase_auth
from firebase_client import FirebaseClient
from core_trader import execute_all_users
from admin_api import router as admin_router

logbook.StderrHandler().push_application()
logger = logbook.Logger("MainAPI")

# ----- 環境設定 -----
WEBHOOK_SECRET = os.environ.get("WEBHOOK_SECRET", "leviathan_webhook_secret_change_me")
ADMIN_UIDS = set(os.environ.get("ADMIN_UIDS", "").split(","))  # 管理員 Firebase UID 白名單
SERVICE_ACCOUNT_PATH = os.environ.get("SERVICE_ACCOUNT_PATH", "serviceAccountKey.json")

# ----- 初始化 -----
app = FastAPI(title="Leviathan Trading API", version="2.0")

# CORS：只允許前端網域
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "https://yourdomain.github.io"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 掛載 Admin 路由
app.include_router(admin_router, prefix="/admin")

# Firebase 客戶端（單例）
try:
    fb = FirebaseClient(service_account_path=SERVICE_ACCOUNT_PATH)
    logger.info("FirebaseClient ready.")
except Exception as e:
    logger.error(f"Could not init Firebase: {e}")
    fb = None


# ============================================================
# 工具函式：驗證 Firebase ID Token
# ============================================================
def verify_firebase_token(authorization: Optional[str] = Header(None)) -> dict:
    """
    從 HTTP Header: Authorization: Bearer <id_token> 驗證用戶身份。
    回傳 decoded_token dict（包含 uid, email 等）。
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header.")
    token = authorization.split(" ", 1)[1]
    try:
        decoded = firebase_auth.verify_id_token(token)
        return decoded
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired Firebase token.")


def verify_admin(token: dict = Depends(verify_firebase_token)) -> dict:
    """額外驗證是否為 Admin UID"""
    if token["uid"] not in ADMIN_UIDS:
        raise HTTPException(status_code=403, detail="Admin access only.")
    return token


# ============================================================
# Pydantic Models
# ============================================================
class WebhookSignal(BaseModel):
    symbol: str
    action: str       # "BUY" | "SELL"
    price: float
    quantity: int = 1
    order_type: str = "ROD"
    price_type: str = "MKT"
    target_month: str = "TXFR1"
    secret: str       # Webhook 驗證密鑰

class CredentialPayload(BaseModel):
    api_key: str
    secret_key: str
    ca_path: str
    ca_password: str
    person_id: str

class ActiveStatusPayload(BaseModel):
    is_active: bool


# ============================================================
# 端點：健康檢查
# ============================================================
@app.get("/health")
def health():
    return {"status": "ok", "version": "2.0"}


# ============================================================
# 端點：接收 TradingView Webhook 訊號
# ============================================================
@app.post("/webhook")
async def receive_webhook(signal: WebhookSignal, background_tasks: BackgroundTasks):
    """
    接收 TradingView 的自動化訊號，觸發多帳戶併發下單。
    使用 BackgroundTasks 確保立即回應，避免 TradingView Webhook 超時。
    """
    # 1. 驗證 Webhook Secret
    if signal.secret != WEBHOOK_SECRET:
        raise HTTPException(status_code=403, detail="Invalid webhook secret.")

    if not fb:
        raise HTTPException(status_code=500, detail="Firebase not initialized.")

    logger.info(f"Webhook received: {signal.action} {signal.symbol} @ {signal.price}")

    # 2. 在背景執行，立即回應 200
    def process():
        users = fb.get_active_users()
        if not users:
            logger.warning("No active users found, skipping order execution.")
            return
        order_details = signal.dict(exclude={"secret"})
        results = execute_all_users(users, order_details)
        logger.info(f"Execution complete: {results}")

    background_tasks.add_task(process)
    return {"status": "received", "symbol": signal.symbol, "action": signal.action}


# ============================================================
# 端點：Client - 儲存 API 憑證（加密）
# ============================================================
@app.post("/user/credentials")
def save_credentials(payload: CredentialPayload, token: dict = Depends(verify_firebase_token)):
    """
    前端表單提交後，由此端點接收並呼叫 firebase_client 加密儲存。
    用戶只能存自己的憑證。
    """
    uid = token["uid"]
    success = fb.save_user_credentials(
        uid=uid,
        api_key=payload.api_key,
        secret_key=payload.secret_key,
        ca_path=payload.ca_path,
        ca_password=payload.ca_password,
        person_id=payload.person_id
    )
    if not success:
        raise HTTPException(status_code=500, detail="Failed to save credentials.")
    return {"status": "saved"}


# ============================================================
# 端點：Client - 設定自動下單開關
# ============================================================
@app.post("/user/active-status")
def set_active_status(payload: ActiveStatusPayload, token: dict = Depends(verify_firebase_token)):
    """用戶自行控制是否啟用自動下單"""
    uid = token["uid"]
    success = fb.set_user_active_status(uid, payload.is_active)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to update status.")
    return {"status": "updated", "isActive": payload.is_active}


# ============================================================
# 啟動
# ============================================================
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

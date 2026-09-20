# ============================================================
# admin_api.py
# 管理員專屬 API 路由。
# 所有端點需通過 Firebase ID Token + Admin UID 白名單雙重驗證。
# ============================================================
import os
from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel
from typing import Optional

from firebase_admin import auth as firebase_auth
from firebase_client import FirebaseClient

router = APIRouter()

ADMIN_UIDS = set(os.environ.get("ADMIN_UIDS", "").split(","))
SERVICE_ACCOUNT_PATH = os.environ.get("SERVICE_ACCOUNT_PATH", "serviceAccountKey.json")

# 使用已初始化的 FirebaseClient（從 main.py 傳遞或重新建立）
def get_fb():
    return FirebaseClient(service_account_path=SERVICE_ACCOUNT_PATH)


def verify_admin(authorization: Optional[str] = Header(None)) -> dict:
    """驗證是否為管理員"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Authorization header.")
    token = authorization.split(" ", 1)[1]
    try:
        decoded = firebase_auth.verify_id_token(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid Firebase token.")
    if decoded["uid"] not in ADMIN_UIDS:
        raise HTTPException(status_code=403, detail="Admin access only.")
    return decoded


# ============================================================
# Pydantic Models
# ============================================================
class WatchlistPayload(BaseModel):
    symbols: list[str]

class StrategyPayload(BaseModel):
    script: str

class SetUserActivePayload(BaseModel):
    uid: str
    is_active: bool

class SetUserPaidPayload(BaseModel):
    uid: str
    is_paid: bool


# ============================================================
# Admin 端點
# ============================================================

@router.get("/users")
def get_all_users(admin: dict = Depends(verify_admin)):
    """取得所有用戶摘要（不含機密憑證）"""
    fb = get_fb()
    return fb.get_all_users_summary()


@router.post("/users/active")
def admin_set_active(payload: SetUserActivePayload, admin: dict = Depends(verify_admin)):
    """管理員強制設定任一用戶的下單開關"""
    fb = get_fb()
    success = fb.set_user_active_status(payload.uid, payload.is_active)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to update user status.")
    return {"status": "updated", "uid": payload.uid, "isActive": payload.is_active}


@router.post("/users/paid")
def admin_set_paid(payload: SetUserPaidPayload, admin: dict = Depends(verify_admin)):
    """管理員設定用戶的付費狀態"""
    from firebase_admin import firestore
    db = firestore.client()
    db.collection("users").document(payload.uid).update({"isPaid": payload.is_paid})
    return {"status": "updated", "uid": payload.uid, "isPaid": payload.is_paid}


@router.get("/watchlist")
def get_watchlist(admin: dict = Depends(verify_admin)):
    """取得投資標的清單"""
    fb = get_fb()
    return {"symbols": fb.get_watchlist()}


@router.post("/watchlist")
def update_watchlist(payload: WatchlistPayload, admin: dict = Depends(verify_admin)):
    """更新投資標的清單"""
    fb = get_fb()
    success = fb.update_watchlist(payload.symbols)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to update watchlist.")
    return {"status": "updated", "symbols": payload.symbols}


@router.get("/strategy")
def get_strategy(admin: dict = Depends(verify_admin)):
    """取得量化策略腳本"""
    fb = get_fb()
    return {"script": fb.get_strategy_script()}


@router.post("/strategy")
def update_strategy(payload: StrategyPayload, admin: dict = Depends(verify_admin)):
    """更新量化策略腳本"""
    fb = get_fb()
    success = fb.update_strategy_script(payload.script)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to update strategy.")
    return {"status": "updated"}

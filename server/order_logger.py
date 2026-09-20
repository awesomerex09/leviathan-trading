# ============================================================
# order_logger.py
# 負責將每一筆下單結果即時寫回 Firestore，供前端儀表板顯示。
# ============================================================
from datetime import datetime, timezone
from firebase_admin import firestore
import logbook

logger = logbook.Logger("OrderLogger")


def log_order(uid: str, symbol: str, action: str, price: float,
              quantity: int, status: str, trade_id: str = "", error: str = ""):
    """
    將一筆下單紀錄寫入 Firestore。
    結構: /users/{uid}/orders/{auto_id}
    """
    try:
        db = firestore.client()
        order_data = {
            "symbol": symbol,
            "action": action,          # "BUY" | "SELL"
            "price": price,
            "quantity": quantity,
            "status": status,          # "SUCCESS" | "FAILED"
            "trade_id": trade_id,
            "error": error,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        db.collection("users").document(uid).collection("orders").add(order_data)
        logger.info(f"Order logged for user {uid}: {symbol} {action} @ {price}")
    except Exception as e:
        logger.error(f"Failed to log order for user {uid}: {e}")

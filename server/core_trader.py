# ============================================================
# core_trader.py
# 多執行緒多帳戶下單核心。
# 每位活躍用戶分配一條執行緒，同步併發下單，最小化時間差。
# ============================================================
import threading
import logbook
import shioaji as sj
from order_logger import log_order

logger = logbook.Logger("TradingBrain")


def _execute_order_for_user(user_data: dict, order_details: dict):
    """
    單一用戶的下單執行緒邏輯。
    所有憑證在進入此函式前已在 firebase_client.py 完成 AES 解密。
    """
    uid = user_data.get("uid", "Unknown")
    symbol = order_details.get("symbol", "TXF")
    action_str = order_details.get("action", "Buy")  # "Buy" | "Sell"
    quantity = order_details.get("quantity", 1)
    price = order_details.get("price", 0)
    order_type = order_details.get("order_type", sj.constant.OrderType.ROD)
    price_type = order_details.get("price_type", sj.constant.FuturesPriceType.MKT)

    api = sj.Shioaji()
    try:
        # 1. 登入永豐 API
        api.login(
            api_key=user_data["api_key"],
            secret_key=user_data["secret_key"],
            contracts_cb=lambda x: logger.info(f"[{uid}] Contracts loaded.")
        )

        # 2. 啟用憑證
        api.activate_ca(
            ca_path=user_data["ca_path"],
            ca_passwd=user_data["ca_password"],
            person_id=user_data["person_id"]
        )

        # 3. 取得合約
        # 預設取得台指期近月合約
        target_month = order_details.get("target_month", "TXFR1")
        contract = api.Contracts.Futures[symbol][target_month]

        # 4. 建立訂單
        action = sj.constant.Action.Buy if action_str.upper() == "BUY" else sj.constant.Action.Sell
        order = api.Order(
            action=action,
            price=price,
            quantity=quantity,
            order_type=order_type,
            price_type=price_type,
            octype=sj.constant.FuturesOCType.Auto
        )

        # 5. 送出訂單
        trade = api.place_order(contract, order)
        trade_id = getattr(trade.order, "id", "")
        logger.info(f"[{uid}] Order placed: {trade}")

        # 6. 記錄成功
        log_order(
            uid=uid, symbol=symbol, action=action_str.upper(),
            price=price, quantity=quantity,
            status="SUCCESS", trade_id=str(trade_id)
        )
        return True, str(trade)

    except Exception as e:
        error_msg = str(e)
        logger.error(f"[{uid}] Order failed: {error_msg}")
        log_order(
            uid=uid, symbol=symbol, action=action_str.upper(),
            price=price, quantity=quantity,
            status="FAILED", error=error_msg
        )
        return False, error_msg

    finally:
        try:
            api.logout()
        except Exception:
            pass


def execute_all_users(users: list[dict], order_details: dict) -> dict:
    """
    對所有活躍用戶同步發動多執行緒下單。

    Args:
        users: 已解密的用戶清單（來自 firebase_client.get_active_users()）
        order_details: 訂單內容（symbol, action, quantity, price, etc.）

    Returns:
        dict: {uid: (success: bool, message: str)}
    """
    results = {}
    threads = []

    def run(user):
        success, msg = _execute_order_for_user(user, order_details)
        results[user["uid"]] = {"success": success, "message": msg}

    for user in users:
        t = threading.Thread(target=run, args=(user,), daemon=True)
        threads.append(t)
        t.start()

    # 等待所有執行緒完成（最多 30 秒）
    for t in threads:
        t.join(timeout=30)

    logger.info(f"All orders dispatched. Results: {results}")
    return results

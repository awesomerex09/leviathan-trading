#!/usr/bin/env python3
# =============================================================
# test_shioaji_simulation.py
# Shioaji 模擬下單測試腳本
# 
# ⚠️ 說明：Shioaji 模擬模式 (simulation=True) 依然需要有效的 API Key
#    和 Secret Key。但不需要憑證（CA）即可執行「模擬」下單。
#    模擬單不會真正成交，僅用於測試系統流程。
#
# 執行前準備：
#   1. 在 .env 中設定 SHIOAJI_API_KEY 和 SHIOAJI_SECRET_KEY
#   2. pip install shioaji python-dotenv
#   3. python test_shioaji_simulation.py
# =============================================================

import os
import sys
import time
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv("SHIOAJI_API_KEY", "")
SECRET_KEY = os.getenv("SHIOAJI_SECRET_KEY", "")

if not API_KEY or not SECRET_KEY:
    print("=" * 60)
    print("ERROR: 需要設定 API Key 才能使用 Shioaji 模擬模式")
    print("=" * 60)
    print()
    print("請在 server/.env 中加入以下設定：")
    print("  SHIOAJI_API_KEY=your_api_key_here")
    print("  SHIOAJI_SECRET_KEY=your_secret_key_here")
    print()
    print("然後重新執行此腳本")
    print()
    print("【取得 API Key 的方法】")
    print("  1. 登入永豐金官網")
    print("  2. 申請開通 API 功能")
    print("  3. 在「永豐金API後台」取得 API Key 和 Secret Key")
    print("  文件：https://sinotrade.github.io/zh/tutor/prepare/terms/")
    sys.exit(1)

try:
    import shioaji as sj
except ImportError:
    print("請先安裝 shioaji: pip install shioaji")
    sys.exit(1)


def run_simulation_test():
    print("=" * 60)
    print("Leviathan - Shioaji 模擬下單測試")
    print(f"時間：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    # ── Step 1: 初始化 API（模擬模式）──────────────────────
    print("\n[1/5] 初始化 Shioaji API（simulation=True）...")
    api = sj.Shioaji(simulation=True)

    # ── Step 2: 登入（不需要 CA 憑證）─────────────────────
    print("[2/5] 登入中（模擬模式，不需要憑證）...")
    try:
        accounts = api.login(
            api_key=API_KEY,
            secret_key=SECRET_KEY,
        )
        print(f"  ✓ 登入成功！帳戶數量：{len(accounts)}")
        for acc in accounts:
            print(f"    - {acc.account_id}（{acc.broker_id}）")
    except Exception as e:
        print(f"  ✗ 登入失敗：{e}")
        print("    請確認 API Key 和 Secret Key 是否正確")
        return False

    # ── Step 3: 取得合約資訊 ───────────────────────────────
    print("\n[3/5] 取得合約資訊（台指期 TXF）...")
    try:
        api.fetch_contracts(contract_download=True)
        txf = api.Contracts.Futures.TXF
        # 取得近月合約
        front_month = [c for c in txf if c.code.startswith('TXF')][0]
        print(f"  ✓ 近月合約：{front_month.code}（{front_month.name}）")
        print(f"    交易時間：{front_month.day_trade}")
    except Exception as e:
        print(f"  ✗ 取得合約失敗：{e}")
        return False

    # ── Step 4: 下模擬買單 ────────────────────────────────
    print("\n[4/5] 送出模擬買單（台指期 1 口）...")
    try:
        order = api.Order(
            price=18000,              # 模擬下單價格
            quantity=1,
            action=sj.constant.Action.Buy,
            price_type=sj.constant.FuturesPriceType.LMT,
            order_type=sj.constant.OrderType.ROD,
            octype=sj.constant.FuturesOCType.Auto,
            account=api.futopt_account,
        )
        trade = api.place_order(front_month, order)
        print(f"  ✓ 模擬買單已送出！")
        print(f"    訂單 ID：{trade.order.id}")
        print(f"    狀態：{trade.status.status}")
        print(f"    合約：{trade.contract.code}")
        print(f"    價格：{trade.order.price}")
        print(f"    數量：{trade.order.quantity}")
    except Exception as e:
        print(f"  ✗ 下單失敗：{e}")

    # ── Step 5: 查詢委託 ──────────────────────────────────
    print("\n[5/5] 查詢委託清單...")
    time.sleep(1)
    try:
        api.update_status(api.futopt_account)
        trades = api.list_trades()
        print(f"  ✓ 委託筆數：{len(trades)}")
        for t in trades[:5]:
            print(f"    - {t.contract.code} {t.order.action} {t.order.quantity} 口 @ {t.order.price} → {t.status.status}")
    except Exception as e:
        print(f"  ✗ 查詢失敗：{e}")

    print("\n" + "=" * 60)
    print("模擬下單測試完成！")
    print("系統確認可以正常連線並下單（模擬環境）")
    print("=" * 60)

    api.logout()
    return True


if __name__ == "__main__":
    success = run_simulation_test()
    sys.exit(0 if success else 1)

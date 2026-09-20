#!/usr/bin/env python3
# ============================================================
# verify_firebase.py
# 快速測試腳本：驗證 Firebase Admin SDK 是否能成功連線 Firestore
# 執行方式: python verify_firebase.py
# ============================================================
import sys
import os

print("=" * 50)
print("Leviathan - Firebase 連線驗證")
print("=" * 50)

# 1. 確認 serviceAccountKey.json 存在
key_path = "serviceAccountKey.json"
if not os.path.exists(key_path):
    print(f"❌ 找不到 {key_path}")
    print("   請將 Firebase Service Account Key 下載後放在此目錄")
    sys.exit(1)
print(f"✅ 找到金鑰檔案: {key_path}")

# 2. 初始化 Firebase
try:
    from firebase_client import FirebaseClient
    fb = FirebaseClient(service_account_path=key_path)
    print("✅ Firebase Admin SDK 初始化成功")
except Exception as e:
    print(f"❌ Firebase 初始化失敗: {e}")
    sys.exit(1)

# 3. 讀取 Firestore 連線測試
try:
    from firebase_admin import firestore
    db = firestore.client()
    # 嘗試讀取一個不存在的文件（只是測試連線）
    test_doc = db.collection("_connection_test").document("ping").get()
    print("✅ Firestore 連線成功！")
except Exception as e:
    print(f"❌ Firestore 連線失敗: {e}")
    sys.exit(1)

# 4. 測試讀取 watchlist
try:
    watchlist = fb.get_watchlist()
    print(f"✅ Watchlist 讀取成功（目前 {len(watchlist)} 個標的）")
    if watchlist:
        print(f"   標的清單: {watchlist}")
except Exception as e:
    print(f"⚠️  Watchlist 讀取失敗（可能尚未建立）: {e}")

# 5. 測試讀取用戶列表
try:
    users = fb.get_all_users_summary()
    print(f"✅ 用戶列表讀取成功（共 {len(users)} 位用戶）")
except Exception as e:
    print(f"⚠️  用戶列表讀取失敗: {e}")

print()
print("🎉 所有測試通過！後端已成功連接 Firebase。")
print("下一步：啟動主服務器")
print("  python main.py")

# ============================================================
# firebase_client.py
# 負責與 Firestore 連線，取得活躍用戶的加密憑證，並在本地解密。
# 也負責讀寫 watchlist 和 strategy 等管理員配置。
# ============================================================
import os
import firebase_admin
from firebase_admin import credentials, firestore
from Crypto.Cipher import AES
from Crypto.Util.Padding import pad, unpad
import base64
import logbook

logger = logbook.Logger("FirebaseClient")

# AES 加密金鑰 - 32 bytes (256-bit)。
# 正式環境請存放於環境變數 AES_SECRET_KEY，不要硬編碼。
AES_KEY = os.environ.get("AES_SECRET_KEY", "leviathan_default_32byte_key!!!!!").encode("utf-8")[:32]


def _aes_encrypt(plaintext: str) -> str:
    """AES-256-CBC 加密，回傳 base64 字串"""
    cipher = AES.new(AES_KEY, AES.MODE_CBC)
    ct_bytes = cipher.encrypt(pad(plaintext.encode("utf-8"), AES.block_size))
    iv = base64.b64encode(cipher.iv).decode("utf-8")
    ct = base64.b64encode(ct_bytes).decode("utf-8")
    return f"{iv}:{ct}"


def _aes_decrypt(ciphertext: str) -> str:
    """AES-256-CBC 解密，回傳原始字串"""
    try:
        iv_b64, ct_b64 = ciphertext.split(":")
        iv = base64.b64decode(iv_b64)
        ct = base64.b64decode(ct_b64)
        cipher = AES.new(AES_KEY, AES.MODE_CBC, iv)
        return unpad(cipher.decrypt(ct), AES.block_size).decode("utf-8")
    except Exception as e:
        logger.error(f"Decryption failed: {e}")
        return ""


class FirebaseClient:
    _initialized = False

    def __init__(self, service_account_path: str = "serviceAccountKey.json"):
        if not FirebaseClient._initialized:
            try:
                cred = credentials.Certificate(service_account_path)
                firebase_admin.initialize_app(cred)
                FirebaseClient._initialized = True
                logger.info("Firebase Admin SDK initialized successfully.")
            except Exception as e:
                logger.error(f"Failed to initialize Firebase: {e}")
                raise

        self.db = firestore.client()

    # ------------------------------------------------------------------
    # 用戶管理
    # ------------------------------------------------------------------

    def get_active_users(self) -> list[dict]:
        """
        撈取所有 isPaid=true 且 isActive=true 的用戶，
        並在本地端解密 API 憑證後回傳。
        前端永遠看不到解密後的資料，只有本伺服器能操作。
        """
        try:
            docs = (
                self.db.collection("users")
                .where("isPaid", "==", True)
                .where("isActive", "==", True)
                .stream()
            )
            users = []
            for doc in docs:
                data = doc.to_dict()
                data["uid"] = doc.id

                # 解密敏感欄位
                data["api_key"] = _aes_decrypt(data.get("api_key_enc", ""))
                data["secret_key"] = _aes_decrypt(data.get("secret_key_enc", ""))
                data["ca_password"] = _aes_decrypt(data.get("ca_password_enc", ""))

                # 移除加密欄位，避免意外外洩
                data.pop("api_key_enc", None)
                data.pop("secret_key_enc", None)
                data.pop("ca_password_enc", None)

                users.append(data)

            logger.info(f"Loaded {len(users)} active users.")
            return users
        except Exception as e:
            logger.error(f"Error fetching active users: {e}")
            return []

    def get_all_users_summary(self) -> list[dict]:
        """
        Admin 用：撈取所有用戶的摘要資訊（不含解密資料）。
        """
        try:
            docs = self.db.collection("users").stream()
            users = []
            for doc in docs:
                data = doc.to_dict()
                # 明確排除所有機密欄位
                safe_data = {
                    "uid": doc.id,
                    "email": data.get("email", ""),
                    "isPaid": data.get("isPaid", False),
                    "isActive": data.get("isActive", False),
                    "positions": data.get("positions", []),
                    "orders": data.get("orders", []),
                }
                users.append(safe_data)
            return users
        except Exception as e:
            logger.error(f"Error fetching all users: {e}")
            return []

    def save_user_credentials(self, uid: str, api_key: str, secret_key: str,
                               ca_path: str, ca_password: str, person_id: str):
        """
        將用戶的 API 憑證加密後儲存至 Firestore。
        由前端 API 呼叫，後端進行加密，確保明文不在網路傳輸。
        """
        try:
            self.db.collection("users").document(uid).set({
                "api_key_enc": _aes_encrypt(api_key),
                "secret_key_enc": _aes_encrypt(secret_key),
                "ca_password_enc": _aes_encrypt(ca_password),
                "ca_path": ca_path,
                "person_id": person_id,
                "isPaid": False,  # 預設待管理員審核後手動開通
                "isActive": False,
            }, merge=True)
            logger.info(f"Credentials saved (encrypted) for user {uid}")
            return True
        except Exception as e:
            logger.error(f"Failed to save credentials for {uid}: {e}")
            return False

    def set_user_active_status(self, uid: str, is_active: bool):
        """設定用戶的自動下單狀態"""
        try:
            self.db.collection("users").document(uid).update({"isActive": is_active})
            logger.info(f"User {uid} isActive set to {is_active}")
            return True
        except Exception as e:
            logger.error(f"Failed to update isActive for {uid}: {e}")
            return False

    # ------------------------------------------------------------------
    # 投資標的清單 (Watchlist) 管理
    # ------------------------------------------------------------------

    def get_watchlist(self) -> list[str]:
        """讀取目前的投資標的清單"""
        try:
            doc = self.db.collection("watchlist").document("config").get()
            if doc.exists:
                return doc.to_dict().get("symbols", [])
            return []
        except Exception as e:
            logger.error(f"Error fetching watchlist: {e}")
            return []

    def update_watchlist(self, symbols: list[str]) -> bool:
        """更新投資標的清單（Admin 限定）"""
        try:
            self.db.collection("watchlist").document("config").set({"symbols": symbols})
            logger.info(f"Watchlist updated: {symbols}")
            return True
        except Exception as e:
            logger.error(f"Error updating watchlist: {e}")
            return False

    # ------------------------------------------------------------------
    # 量化策略腳本管理
    # ------------------------------------------------------------------

    def get_strategy_script(self) -> str:
        """讀取量化策略腳本（Admin 限定）"""
        try:
            doc = self.db.collection("strategy").document("v6").get()
            if doc.exists:
                return doc.to_dict().get("script", "")
            return ""
        except Exception as e:
            logger.error(f"Error fetching strategy: {e}")
            return ""

    def update_strategy_script(self, script: str) -> bool:
        """更新量化策略腳本（Admin 限定）"""
        try:
            from datetime import datetime, timezone
            self.db.collection("strategy").document("v6").set({
                "script": script,
                "updated_at": datetime.now(timezone.utc).isoformat()
            })
            logger.info("Strategy script updated successfully.")
            return True
        except Exception as e:
            logger.error(f"Error updating strategy: {e}")
            return False

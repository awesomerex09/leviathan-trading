import requests
import logbook

logger = logbook.Logger("TelegramNotifier")

class TelegramNotifier:
    def __init__(self, bot_token, chat_id):
        self.bot_token = bot_token
        self.chat_id = chat_id
        self.api_url = f"https://api.telegram.org/bot{self.bot_token}/sendMessage"

    def send_message(self, message):
        """發送訊息至 Telegram 群組/用戶"""
        try:
            payload = {
                "chat_id": self.chat_id,
                "text": message,
                "parse_mode": "Markdown"
            }
            response = requests.post(self.api_url, json=payload)
            if response.status_code == 200:
                logger.info("Telegram message sent successfully.")
            else:
                logger.error(f"Failed to send Telegram message: {response.text}")
        except Exception as e:
            logger.error(f"Telegram notifier error: {str(e)}")

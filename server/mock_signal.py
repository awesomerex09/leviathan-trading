import requests
import json
import time

def test_webhook():
    url = "http://localhost:8000/webhook"
    
    # 模擬 TradingView 送出的 JSON 格式訊號
    payload = {
        "action": "Buy",
        "price": 0.0,
        "price_type": "MKT",
        "quantity": 1,
        "target_month": "202610",
        "passcode": "super_secret_trading_code"
    }
    
    headers = {
        "Content-Type": "application/json"
    }
    
    print(f"Sending mock signal to {url}...")
    start_time = time.time()
    
    try:
        response = requests.post(url, data=json.dumps(payload), headers=headers)
        elapsed = time.time() - start_time
        
        print(f"Response Status Code: {response.status_code}")
        print(f"Response Body: {response.json()}")
        print(f"Time taken to receive response: {elapsed:.4f} seconds")
        print("Note: Actual order execution is happening in the background.")
        
    except requests.exceptions.ConnectionError:
        print("Error: Could not connect to the server. Is main.py running?")

if __name__ == "__main__":
    test_webhook()

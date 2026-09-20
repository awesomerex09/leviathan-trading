from fastapi import FastAPI
import random
from datetime import datetime, timedelta

app = FastAPI()

@app.get("/api/chart_data")
def get_chart_data():
    """
    提供給前端 K 線圖表的測試資料。
    未來將串接 Shioaji API 獲取真實的 K-bars，並與本地實盤資料庫合併。
    """
    # 產生 100 根模擬 K 棒 (1分鐘 K)
    base_time = datetime.now() - timedelta(minutes=100)
    
    k_bars = []
    current_price = 22000.0
    
    for i in range(100):
        t = base_time + timedelta(minutes=i)
        
        # 模擬價格波動
        open_p = current_price + random.uniform(-10, 10)
        close_p = open_p + random.uniform(-20, 20)
        high_p = max(open_p, close_p) + random.uniform(0, 15)
        low_p = min(open_p, close_p) - random.uniform(0, 15)
        
        k_bars.append({
            "time": int(t.timestamp()),
            "open": round(open_p, 1),
            "high": round(high_p, 1),
            "low": round(low_p, 1),
            "close": round(close_p, 1)
        })
        current_price = close_p
        
    # 產生回測與實盤的下單 Marker
    markers = []
    
    # 找中間的幾根 K 棒加上訊號
    target_k1 = k_bars[20]
    target_k2 = k_bars[70]
    
    # 1. 模擬回測的買入訊號
    markers.append({
        "time": target_k1["time"],
        "position": "belowBar",
        "color": "#e11d48", # Red
        "shape": "arrowUp",
        "text": "回測: 買入"
    })
    
    # 2. 模擬實盤實際下單紀錄 (可能有滑價延遲)
    # 通常實盤會比回測晚一點點，這裡時間戳加 2 秒
    markers.append({
        "time": target_k1["time"] + 2,
        "position": "aboveBar",
        "color": "#2563eb", # Blue
        "shape": "arrowDown",
        "text": "實盤: 買入成交"
    })
    
    # 賣出訊號
    markers.append({
        "time": target_k2["time"],
        "position": "aboveBar",
        "color": "#16a34a",
        "shape": "arrowDown",
        "text": "回測: 賣出"
    })
    
    markers.append({
        "time": target_k2["time"] + 3,
        "position": "belowBar",
        "color": "#2563eb",
        "shape": "arrowUp",
        "text": "實盤: 賣出成交"
    })
    
    return {
        "k_bars": k_bars,
        "markers": markers
    }

if __name__ == "__main__":
    import uvicorn
    # 作為獨立測試 API 運行
    uvicorn.run(app, host="0.0.0.0", port=8001)

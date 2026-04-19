import pandas as pd
import numpy as np
import json
import sys
import math
from datetime import datetime, timedelta
from sklearn.linear_model import LinearRegression
from sklearn.metrics import r2_score

class NumpyEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, np.integer):
            return int(obj)
        if isinstance(obj, np.floating):
            if np.isnan(obj) or np.isinf(obj):
                return None
            return float(obj)
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        if isinstance(obj, pd.Timestamp):
            return obj.strftime('%Y-%m-%d')
        return super(NumpyEncoder, self).default(obj)

def forecast_single_item(item_data, usage_df):
    """
    Forecasting logic based on raw usage logs.
    """
    item_id = item_data.get('id')
    code = item_data.get('code')
    min_stock_level = int(item_data.get('min_stock_level', 0))
    current_stock = float(item_data.get('current_stock', 0))
    history_days = int(item_data.get('history_days', 30))

    # Filter for this specific item
    df = usage_df[usage_df['id'].astype(str) == str(item_id)].copy()

    if df.empty:
        return {
            "prediction_status": "Insufficient Data",
            "forecast_status": "Safe",
            "message": "No clinical consumption records found.",
            "average_daily_consumption": 0
        }

    # Aggregate by date to handle multiple sales on same day
    daily_usage = df.groupby('date')['quantity_used'].sum().reset_index()
    
    # Analysis Window calculation
    window_end = datetime.now()
    window_start = window_end - timedelta(days=history_days)
    
    # Calculate average daily consumption over the WHOLE window
    total_consumption = daily_usage['quantity_used'].sum()
    
    # The actual analyzed period is either the history_days or the time since first usage
    actual_days = (window_end - min(daily_usage['date'])).days or 1
    analyzed_days = min(history_days, actual_days)
    
    avg_consumption = total_consumption / analyzed_days

    if avg_consumption <= 0:
        return {
            "prediction_status": "Success",
            "forecast_status": "Safe",
            "message": "No consumption rate measured in clinical history.",
            "average_daily_consumption": 0,
            "current_stock": current_stock
        }

    # Predict
    stock_to_deplete = max(0, current_stock - min_stock_level)
    predicted_days = math.ceil(stock_to_deplete / avg_consumption)
    
    # Status
    if predicted_days < 7:
        status = "Critical"
    elif predicted_days < 14:
        status = "Reorder Soon"
    else:
        status = "Safe"

    predicted_date = window_end + timedelta(days=max(0, predicted_days))

    return {
        "prediction_status": "Success",
        "forecast_status": status,
        "predicted_stockout_date": predicted_date.strftime('%Y-%m-%d'),
        "days_until_stockout": max(0, predicted_days),
        "current_stock": current_stock,
        "min_stock_level": min_stock_level,
        "average_daily_consumption": round(avg_consumption, 2),
        "predicted_monthly_sales": round(avg_consumption * 30, 2)
    }

def run_batch():
    try:
        # Args: csv_path, json_input_path
        if len(sys.argv) < 3:
            print(json.dumps({"error": "Missing arguments."}))
            return

        csv_path = sys.argv[1]
        json_input_path = sys.argv[2]

        # 1. Load Live Usage Logs
        df = pd.read_csv(csv_path)
        if not df.empty:
            df['date'] = pd.to_datetime(df['date'], errors='coerce')
            df = df.dropna(subset=['date'])

        # 2. Load Items to Process
        with open(json_input_path, 'r') as f:
            items = json.load(f)

        results = {}
        for item in items:
            item_id = item.get('id')
            try:
                results[item_id] = forecast_single_item(item, df)
            except Exception as item_err:
                results[item_id] = {"error": str(item_err), "prediction_status": "Error"}

        # 3. Final Output
        print(json.dumps(results, cls=NumpyEncoder))

    except Exception as e:
        print(json.dumps({"error": str(e), "prediction_status": "GlobalError"}))

if __name__ == '__main__':
    run_batch()

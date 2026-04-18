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

def forecast_single_item(item_data, full_df):
    """
    Core forecasting logic extracted from forecast.py, optimized to work on a filtered dataframe.
    """
    item_id = item_data.get('id')
    code = item_data.get('code')
    min_stock_level = int(item_data.get('min_stock_level', 0))
    current_stock = float(item_data.get('current_stock', 0))
    history_days = int(item_data.get('history_days', 30))

    # Filter dataframe for this specific code
    df = full_df[full_df['code'].astype(str) == str(code)].copy()

    if df.empty:
        return {
            "prediction_status": "Insufficient Data",
            "forecast_status": "Insufficient Data",
            "message": f"No historical data found for code {code}."
        }

    # Range-based slicing
    latest_data_date = df['date'].max()
    cutoff_date = latest_data_date - timedelta(days=history_days)
    df = df[df['date'] >= cutoff_date]

    if len(df) < 3:
        return {
            "prediction_status": "Insufficient Data",
            "forecast_status": "Insufficient Data",
            "message": f"Only {len(df)} data points in {history_days}d window. Need 3+.",
            "average_daily_consumption": 0
        }

    # Clean and calculate diffs
    df = df.sort_values(by=['date'])
    df = df.groupby('date', as_index=False).last()
    df['days_diff'] = df['date'].diff().dt.days
    df['stock_diff'] = df['stock_level'].diff()

    # If stock is already at or below min_stock_level
    if current_stock <= min_stock_level:
        return {
            "prediction_status": "Critical",
            "forecast_status": "Critical",
            "message": "Stock is currently at or below minimum level.",
            "days_until_stockout": 0,
            "average_daily_consumption": 0,
            "current_stock": current_stock
        }

    # Consumption analysis
    consumptions = df[df['stock_diff'] < 0]
    if consumptions.empty:
        return {
            "prediction_status": "Safe",
            "forecast_status": "Safe",
            "message": "No consumption history detected.",
            "average_daily_consumption": 0,
            "current_stock": current_stock
        }

    total_consumption = abs(consumptions['stock_diff'].sum())
    total_days_consuming = consumptions['days_diff'].sum()
    if total_days_consuming <= 0:
        total_days_consuming = (df['date'].max() - df['date'].min()).days or 1

    avg_consumption = total_consumption / total_days_consuming

    if avg_consumption <= 0:
        return {
            "prediction_status": "Safe",
            "forecast_status": "Safe",
            "message": "Zero consumption rate calculated.",
            "average_daily_consumption": 0,
            "current_stock": current_stock
        }

    # Predict
    stock_to_deplete = current_stock - min_stock_level
    predicted_days = math.ceil(stock_to_deplete / avg_consumption)
    
    # Linear Regression trend (confidence)
    X = np.arange(len(df)).reshape(-1, 1)
    y = df['stock_level'].values
    model = LinearRegression()
    model.fit(X, y)
    lr_r2 = round(float(r2_score(y, model.predict(X))), 4)

    # Status
    if predicted_days < 7:
        status = "Critical"
    elif predicted_days < 14:
        status = "Reorder Soon"
    else:
        status = "Safe"

    base_date = datetime.now()
    predicted_date = base_date + timedelta(days=max(0, predicted_days))

    return {
        "prediction_status": "Success",
        "forecast_status": status,
        "predicted_stockout_date": predicted_date.strftime('%Y-%m-%d'),
        "days_until_stockout": max(0, predicted_days),
        "current_stock": current_stock,
        "min_stock_level": min_stock_level,
        "average_daily_consumption": round(avg_consumption, 2),
        "predicted_monthly_sales": round(avg_consumption * 30, 2),
        "confidence_score": lr_r2
    }

def run_batch():
    try:
        # Args: csv_path, input_json_path
        if len(sys.argv) < 3:
            print(json.dumps({"error": "Missing arguments. Usage: batch_forecast.py <csv> <json_input>"}))
            return

        csv_path = sys.argv[1]
        json_input_path = sys.argv[2]

        # 1. Load Dataset Once
        df = pd.read_csv(csv_path)
        if df.empty:
            print(json.dumps({"error": "CSV is empty"}))
            return

        # Canonicalize columns
        col_map = {'usage_date': 'date', 'ending_stock': 'stock_level', 'stock_level': 'stock_level', 'date': 'date'}
        df = df.rename(columns={k: v for k, v in col_map.items() if k in df.columns})
        df['date'] = pd.to_datetime(df['date'], dayfirst=True, errors='coerce')
        mask = df['date'].isna()
        if mask.any():
            df.loc[mask, 'date'] = pd.to_datetime(df.loc[mask, 'date'], errors='coerce')
        df = df.dropna(subset=['date', 'stock_level'])
        df['stock_level'] = pd.to_numeric(df['stock_level'], errors='coerce')

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

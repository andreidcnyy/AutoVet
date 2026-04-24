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

def forecast_stockout(csv_filepath, min_stock_level):
    try:
        min_stock_level = int(min_stock_level)
    except (ValueError, TypeError):
        return {"error": "Invalid min_stock_level provided. Must be an integer."}

    # Extract optional arguments from sys.argv
    target_code = next((arg.split('=')[1] for arg in sys.argv if arg.startswith('--code=')), None)
    current_stock_arg = next((arg.split('=')[1] for arg in sys.argv if arg.startswith('--current_stock=')), None)
    history_days_arg = next((arg.split('=')[1] for arg in sys.argv if arg.startswith('--history_days=')), None)

    try:
        # Load CSV and treat empty strings as NaN
        df = pd.read_csv(csv_filepath)
        
        if df.empty:
            return {"error": "CSV file is empty."}

        # 2. Normalize columns
        col_map = {
            'usage_date': 'date',
            'ending_stock': 'stock_level',
            'stock_level': 'stock_level',
            'date': 'date'
        }
        df = df.rename(columns={k: v for k, v in col_map.items() if k in df.columns})

        # Validate required columns
        required_cols = ['date', 'stock_level']
        if not all(col in df.columns for col in required_cols):
             # Try mapping 'quantity_used' if 'stock_level' missing (for raw usage logs)
             if 'quantity_used' in df.columns and 'date' in df.columns:
                 # Standard procedure for ExportInventoryHistory is providing stock_level.
                 pass
             else:
                return {"error": f"CSV must contain the following columns: {', '.join(required_cols)} (Found: {', '.join(df.columns)})"}

        # Target item filtering by code if requested and column exists
        if target_code and 'code' in df.columns:
            df = df[df['code'].astype(str) == target_code]
            if df.empty:
                return {"error": f"No data found for code {target_code} in dataset."}

    except FileNotFoundError:
        return {"error": f"CSV file not found at {csv_filepath}"}
    except Exception as e:
        return {"error": f"Error reading CSV file: {e}"}

    # Clean data
    # Convert dates and drop invalid ones
    df['date'] = pd.to_datetime(df['date'], dayfirst=True, errors='coerce')
    # If standard parsing fails (e.g. YYYY-MM-DD), try without dayfirst
    mask = df['date'].isna()
    if mask.any():
        df.loc[mask, 'date'] = pd.to_datetime(df.loc[mask, 'date'], errors='coerce')
        
    df = df.dropna(subset=['date'])
    
    # Ensure stock_level is strictly numeric (reject string types/errors)
    df['stock_level'] = pd.to_numeric(df['stock_level'], errors='coerce')
    df = df.dropna(subset=['stock_level'])
    
    # Sort and remove duplicates
    df = df.sort_values(by=['date'])
    df = df.groupby('date', as_index=False).last()

    # Range-based slicing
    if history_days_arg:
        try:
            days = int(history_days_arg)
            if not df.empty:
                # Cutoff is relative to the latest data point in the set
                latest_data_date = df['date'].max()
                cutoff_date = latest_data_date - timedelta(days=days)
                df = df[df['date'] >= cutoff_date]
        except ValueError:
            pass

    if len(df) < 3:     
        return {
            "prediction_status": "Insufficient Data",
            "forecast_status": "Insufficient Data",
            "message": f"Only {len(df)} unique data points found in requested window. At least 3 required for a valid trend.",
            "average_daily_consumption": 0
        }

    # Calculate differences between consecutive records
    df['days_diff'] = df['date'].diff().dt.days
    df['stock_diff'] = df['stock_level'].diff()

    # Determine last_stock and last_date
    last_date = df['date'].max()
    if current_stock_arg is not None:
        try:
            last_stock = float(current_stock_arg)
        except ValueError:
            last_stock = float(df['stock_level'].iloc[-1])
    else:
        last_stock = float(df['stock_level'].iloc[-1])

    # If stock is already at or below min_stock_level, we still want to return 
    # the true average daily consumption for recalculated UI projections.
    if last_stock <= min_stock_level:
        # We calculate the average even if stock is 0
        consumptions = df[df['stock_diff'] < 0]
        total_consumption = abs(consumptions['stock_diff'].sum()) if not consumptions.empty else 0
        window_start = df['date'].min()
        window_end = df['date'].max()
        total_days_in_window = (window_end - window_start).days or 1
        avg_daily = total_consumption / total_days_in_window

        return {
            "prediction_status": "Critical",
            "forecast_status": "Critical",
            "message": "Stock is currently at or below minimum level.",
            "predicted_stockout_date": last_date.strftime('%Y-%m-%d'),
            "days_until_stockout": 0,
            "average_daily_consumption": round(avg_daily, 2),
            "predicted_monthly_sales": round(avg_daily * 30, 2),
            "current_stock": last_stock
        }

    # Calculate average daily consumption over the analyzed window
    total_consumption = abs(consumptions['stock_diff'].sum())
    
    # window_start is either the requested history cutoff or the first data point
    window_start = df['date'].min()
    window_end = df['date'].max()
    total_days_in_window = (window_end - window_start).days or 1

    average_daily_consumption = total_consumption / total_days_in_window

    if average_daily_consumption <= 0:
        return {
            "prediction_status": "Success",
            "forecast_status": "Safe",
            "message": "No consumption rate measured in clinical history.",
            "average_daily_consumption": 0,
            "predicted_monthly_sales": 0,
            "days_until_stockout": None,
            "predicted_stockout_date": None,
            "current_stock": last_stock
        }

    # Predict stockout days based on current stock
    # Logic: how many days until current_stock hits min_stock_level?
    stock_to_deplete = max(0, last_stock - min_stock_level)
    predicted_days_to_min = math.ceil(stock_to_deplete / average_daily_consumption)

    # FINAL RULE: stockout date must never be in the past. 
    # Use localized 'now' since this is a relative forecast based on current live state.
    base_date = datetime.now()
    
    # If last_stock is already below min, days might be negative if we stayed strictly by formula
    # but the earlier check handles last_stock <= min_stock_level.
    predicted_date_to_min = base_date + timedelta(days=max(0, predicted_days_to_min))

    # Scikit-learn LinearRegression for explainability (shows trend)
    X = np.arange(len(df)).reshape(-1, 1)
    y = df['stock_level'].values
    model = LinearRegression()
    model.fit(X, y)
    lr_r2 = round(float(r2_score(y, model.predict(X))), 4)

    # Determine status based on days remaining
    if predicted_days_to_min < 7:
        forecast_status = "Critical"
    elif predicted_days_to_min < 14:
        forecast_status = "Reorder Soon"
    else:
        forecast_status = "Safe"

    # For sanity, limit forecast to max 5 years
    if predicted_days_to_min > 365 * 5:
         return {
            "prediction_status": "Safe",
            "forecast_status": "Safe",
            "message": "Stockout is over 5 years away.",
            "average_daily_consumption": round(average_daily_consumption, 2),
            "days_until_stockout": 1825,
            "predicted_stockout_date": (base_date + timedelta(days=1825)).strftime('%Y-%m-%d'),
            "current_stock": last_stock
        }

    return {
        "prediction_status": "Success",
        "forecast_status": forecast_status,
        "predicted_stockout_date": predicted_date_to_min.strftime('%Y-%m-%d'),
        "days_until_stockout": max(0, predicted_days_to_min),
        "current_stock": last_stock,
        "min_stock_level": min_stock_level,
        "average_daily_consumption": round(average_daily_consumption, 2),
        "predicted_monthly_sales": round(average_daily_consumption * 30, 2),
        "confidence_score": lr_r2,
        "ml_algorithm": "scikit-learn LinearRegression",
        "historical_period_end": last_date.strftime('%Y-%m-%d')
    }

def run():
    try:
        if len(sys.argv) < 3:
            print(json.dumps({
                "error": "Usage: python forecast.py <csv_filepath> <min_stock_level> [--code=X] [--current_stock=Y] [--history_days=Z]",
                "prediction_status": "Monitoring",
                "message": "Insufficient parameters for AI model."
            }))
            sys.exit(0) # Exit with 0 to prevent PHP proc failures

        csv_filepath = sys.argv[1]
        try:
            min_stock_level = int(sys.argv[2])
        except ValueError:
            print(json.dumps({
                "error": "min_stock_level must be an integer",
                "prediction_status": "Monitoring"
            }))
            sys.exit(0)

        result = forecast_stockout(csv_filepath, min_stock_level)
        print(json.dumps(result, cls=NumpyEncoder))

    except Exception as e:
        # GLOBAL FALLBACK: Never crash with a traceback, always return JSON
        print(json.dumps({
            "error": str(e),
            "prediction_status": "Monitoring",
            "message": "The AI model encountered an unexpected data anomaly. Monitoring active.",
            "average_daily_consumption": 0,
            "days_until_stockout": None
        }))

if __name__ == '__main__':
    run()

import pandas as pd
import numpy as np
import json
import sys
import math
from datetime import datetime, timedelta

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

    try:
        # Load CSV and treat empty strings as NaN
        df = pd.read_csv(csv_filepath, dtype={'stock_level': 'float64'})
    except FileNotFoundError:
        return {"error": f"CSV file not found at {csv_filepath}"}
    except Exception as e:
        return {"error": f"Error reading CSV file: {e}"}

    if df.empty:
        return {"error": "No data in CSV file to forecast."}

    # Validate required columns
    required_cols = ['date', 'stock_level']
    if not all(col in df.columns for col in required_cols):
        return {"error": f"CSV must contain the following columns: {', '.join(required_cols)}"}

    # Clean data
    # Convert dates and drop invalid ones
    df['date'] = pd.to_datetime(df['date'], errors='coerce')
    df = df.dropna(subset=['date', 'stock_level'])

    if df.empty:
        return {"error": "No valid data rows found after cleaning."}

    # Ensure stock_level is strictly numeric (reject string types/errors)
    df['stock_level'] = pd.to_numeric(df['stock_level'], errors='coerce')
    df = df.dropna(subset=['stock_level'])
    
    # Handle negative values by setting to 0 or ignoring
    df.loc[df['stock_level'] < 0, 'stock_level'] = 0

    # Aggregate duplicate dates (e.g., take the last entry of the day or mean)
    # Group by date and take the last recorded stock level for that day
    df = df.sort_values(by=['date'])
    df = df.groupby('date', as_index=False).last()

    if len(df) < 2:
        return {"error": "Not enough unique data points (at least 2 required) to perform forecasting. Try with more history."}

    # Calculate differences between consecutive records
    df['days_diff'] = df['date'].diff().dt.days
    df['stock_diff'] = df['stock_level'].diff()

    # We only care about consumption (where stock_diff < 0). 
    # Positive diffs are considered restocks, which distort natural consumption rates.
    consumptions = df[df['stock_diff'] < 0]

    last_stock = int(df['stock_level'].iloc[-1])
    last_date = df['date'].max()

    # If stock is already at or below min_stock_level
    if last_stock <= min_stock_level:
        return {
            "prediction_status": "Stockout Imminent/Occurred",
            "message": f"Current stock ({last_stock}) is at or below minimum stock level ({min_stock_level}).",
            "last_recorded_stock": last_stock,
            "last_recorded_date": last_date.strftime('%Y-%m-%d')
        }

    # Calculate average daily consumption
    if consumptions.empty:
        return {
            "prediction_status": "No Stockout Predicted",
            "message": "No historical consumption (stock decrease) observed.",
            "last_recorded_stock": last_stock,
            "last_recorded_date": last_date.strftime('%Y-%m-%d')
        }

    total_consumption = abs(consumptions['stock_diff'].sum())
    total_days_consuming = consumptions['days_diff'].sum()

    if total_days_consuming <= 0:
        return {
            "prediction_status": "No Stockout Predicted",
            "message": "Invalid time difference for consumption.",
            "last_recorded_stock": last_stock,
            "last_recorded_date": last_date.strftime('%Y-%m-%d')
        }

    average_daily_consumption = total_consumption / total_days_consuming

    if average_daily_consumption == 0:
        return {
            "prediction_status": "No Stockout Predicted",
            "message": "Average daily consumption is zero based on historical data.",
            "last_recorded_stock": last_stock,
            "last_recorded_date": last_date.strftime('%Y-%m-%d'),
            "average_daily_consumption": round(average_daily_consumption, 2)
        }

    # Predict stockout days based on current stock
    stock_to_deplete = last_stock - min_stock_level
    predicted_days_to_min = math.ceil(stock_to_deplete / average_daily_consumption)

    predicted_date_to_min = last_date + timedelta(days=predicted_days_to_min)

    # For sanity, limit forecast to max 5 years
    if predicted_days_to_min > 365 * 5:
         return {
            "prediction_status": "No Stockout Predicted",
            "message": "Predicted stockout is over 5 years away.",
            "last_recorded_stock": last_stock,
            "last_recorded_date": last_date.strftime('%Y-%m-%d'),
            "average_daily_consumption": round(average_daily_consumption, 2)
        }

    return {
        "prediction_status": "Forecast Available",
        "predicted_stockout_date": predicted_date_to_min.strftime('%Y-%m-%d'),
        "days_until_stockout": predicted_days_to_min,
        "current_stock": last_stock,
        "min_stock_level": min_stock_level,
        "average_daily_consumption": round(average_daily_consumption, 2),
        "last_recorded_date": last_date.strftime('%Y-%m-%d')
    }

if __name__ == '__main__':
    if len(sys.argv) != 3:
        print(json.dumps({"error": "Usage: python forecast.py <csv_filepath> <min_stock_level>"}))
        sys.exit(1)

    csv_filepath = sys.argv[1]
    
    # Catch min_stock_level parse errors at CLI level as well
    try:
        min_stock_level = int(sys.argv[2])
    except ValueError:
        print(json.dumps({"error": "min_stock_level must be an integer"}))
        sys.exit(1)

    result = forecast_stockout(csv_filepath, min_stock_level)
    print(json.dumps(result, cls=NumpyEncoder))

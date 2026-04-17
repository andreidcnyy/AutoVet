import pandas as pd
import numpy as np
import json
import sys
from sklearn.linear_model import LinearRegression


class NumpyEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, (np.integer,)):
            return int(obj)
        if isinstance(obj, (np.floating,)):
            return None if (np.isnan(obj) or np.isinf(obj)) else float(obj)
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        return super().default(obj)


def forecast_sales(csv_filepath, target_code=None):
    try:
        df = pd.read_csv(csv_filepath)
    except FileNotFoundError:
        return {"error": f"CSV file not found at {csv_filepath}"}
    except Exception as e:
        return {"error": f"Error reading CSV: {e}"}

    if df.empty:
        return {"error": "Sales CSV is empty."}

    if 'sales_date' not in df.columns or 'quantity_sold' not in df.columns:
        return {"error": "Sales CSV must contain 'sales_date' and 'quantity_sold' columns."}

    if target_code and 'code' in df.columns:
        df = df[df['code'].astype(str) == target_code]
        if df.empty:
            return {
                "predicted_daily_sales": 0,
                "predicted_weekly_sales": 0,
                "predicted_monthly_sales": 0,
                "prediction_status": "No Data",
                "message": f"No sales records found for code {target_code}."
            }

    df['sales_date'] = pd.to_datetime(df['sales_date'], dayfirst=True, errors='coerce')
    df['quantity_sold'] = pd.to_numeric(df['quantity_sold'], errors='coerce')
    df = df.dropna(subset=['sales_date', 'quantity_sold'])

    if len(df) < 3:
        return {
            "predicted_daily_sales": 0,
            "predicted_weekly_sales": 0,
            "predicted_monthly_sales": 0,
            "prediction_status": "Insufficient Data",
            "message": "Not enough sales records for a reliable prediction."
        }

    df = df.groupby('sales_date', as_index=False)['quantity_sold'].sum()
    df = df.sort_values('sales_date').reset_index(drop=True)

    total_days = max((df['sales_date'].max() - df['sales_date'].min()).days, 1)
    total_sold = float(df['quantity_sold'].sum())
    avg_daily = total_sold / total_days

    X = np.arange(len(df)).reshape(-1, 1)
    y = df['quantity_sold'].values.astype(float)
    model = LinearRegression()
    model.fit(X, y)
    trend_next = max(0.0, float(model.predict([[len(df)]])[0]))

    return {
        "predicted_daily_sales": round(avg_daily, 2),
        "predicted_weekly_sales": round(avg_daily * 7, 2),
        "predicted_monthly_sales": round(avg_daily * 30, 2),
        "trend_daily_sales": round(trend_next, 2),
        "total_sales_records": len(df),
        "prediction_status": "Success"
    }


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: python sales_forecast.py <csv_filepath> [--code=INV-001]"}))
        sys.exit(1)

    csv_path = sys.argv[1]
    code = next((a.split('=')[1] for a in sys.argv if a.startswith('--code=')), None)
    print(json.dumps(forecast_sales(csv_path, code), cls=NumpyEncoder))

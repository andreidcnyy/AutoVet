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


def forecast_sales(csv_filepath, target_code=None, mode='quantity', range_months=6):
    try:
        df = pd.read_csv(csv_filepath)
    except FileNotFoundError:
        return {"error": f"CSV file not found at {csv_filepath}"}
    except Exception as e:
        return {"error": f"Error reading CSV: {e}"}

    if df.empty:
        return {"error": "Sales CSV is empty."}

    # Column mapping
    target_col = 'total_sales' if mode == 'revenue' else 'quantity_sold'
    
    if 'sales_date' not in df.columns or target_col not in df.columns:
        return {"error": f"Sales CSV must contain 'sales_date' and '{target_col}' columns."}

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
    df[target_col] = pd.to_numeric(df[target_col], errors='coerce')
    df = df.dropna(subset=['sales_date', target_col])

    if len(df) < 3:
        return {
            "prediction_status": "Insufficient Data",
            "message": "Not enough sales records for a reliable prediction."
        }

    # 1. Metric Calculation (Daily/Weekly/Monthly metrics)
    df_daily = df.groupby('sales_date', as_index=False)[target_col].sum()
    df_daily = df_daily.sort_values('sales_date').reset_index(drop=True)

    total_days = max((df_daily['sales_date'].max() - df_daily['sales_date'].min()).days, 1)
    total_val = float(df_daily[target_col].sum())
    avg_daily = total_val / total_days

    # 2. Time-Series for Chart (Monthly Aggregation)
    df['month_year'] = df['sales_date'].dt.to_period('M')
    df_monthly = df.groupby('month_year', as_index=False)[target_col].sum()
    df_monthly = df_monthly.sort_values('month_year').reset_index(drop=True)
    
    # 3. Simple Regression on monthly data
    # Use the selected window for the model training
    model_df = df_monthly.tail(range_months).reset_index(drop=True)
    X_m = np.arange(len(model_df)).reshape(-1, 1)
    y_m = model_df[target_col].values.astype(float)
    
    model_m = LinearRegression()
    model_m.fit(X_m, y_m)
    
    m_slope = float(model_m.coef_[0])
    b_intercept = float(model_m.intercept_)
    r2_score = float(model_m.score(X_m, y_m))
    
    # Stability: If slope is extreme (> 50% of avg monthly value), cap it for demo stability
    avg_monthly = y_m.mean() if len(y_m) > 0 else 0
    if abs(m_slope) > (avg_monthly * 0.5) and avg_monthly > 0:
        m_slope = (avg_monthly * 0.5) * (1 if m_slope > 0 else -1)

    # 4. Generate series (Exactly range_months actual + 2 forecast)
    chart_results = []
    
    # We want the window to be [Latest Month - (range_months-1)] to [Latest Month + 2]
    latest_month = df_monthly['month_year'].max()
    history_start = latest_month - (range_months - 1)
    
    # Build history
    for i in range(range_months):
        current_m = history_start + i
        match = df_monthly[df_monthly['month_year'] == current_m]
        
        actual_val = float(match[target_col].iloc[0]) if not match.empty else 0.0
        
        # Calculate forecast projection for this historical point based on the model
        model_start_m = model_df['month_year'].min()
        rel_idx = (current_m - model_start_m).n
        proj_val = max(0.0, m_slope * rel_idx + b_intercept)
        
        chart_results.append({
            "month": current_m.strftime('%b'),
            "actual": round(actual_val, 2),
            "forecast": round(proj_val, 2)
        })

    # Build future (2 months)
    for i in range(1, 3):
        future_m = latest_month + i
        rel_idx = (future_m - model_start_m).n
        proj_val = max(0.0, m_slope * rel_idx + b_intercept)
        
        chart_results.append({
            "month": future_m.strftime('%b'),
            "actual": None,
            "forecast": round(proj_val, 2)
        })

    # 5. Trend interpretation
    trend_desc = "Revenue is projected to remain stable."
    if m_slope > (avg_monthly * 0.05):
        trend_desc = f"Revenue shows a moderate growth trend based on {len(model_df)} months of historical data."
    elif m_slope < -(avg_monthly * 0.05):
        trend_desc = "Revenue shows a slight declining trend. Consider reviewing service volume or pricing."

    return {
        "predicted_daily_sales": round(avg_daily, 2),
        "predicted_weekly_sales": round(avg_daily * 7, 2),
        "predicted_monthly_sales": round(avg_daily * 30, 2),
        "chart_data": chart_results,
        "model": {
            "slope": round(m_slope, 4),
            "intercept": round(b_intercept, 4),
            "r2": round(r2_score, 4),
            "next_forecast": round(max(0.0, m_slope * (len(model_df)) + b_intercept), 2),
            "algorithm": "Linear Regression (Optimized)"
        },
        "trend_description": trend_desc,
        "total_records": len(df),
        "prediction_status": "Success",
        "mode": mode,
        "window_range": range_months
    }


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: python sales_forecast.py <csv_filepath> [--code=INV-001] [--mode=revenue] [--range=6]"}))
        sys.exit(1)

    csv_path = sys.argv[1]
    code = next((a.split('=')[1] for a in sys.argv if a.startswith('--code=')), None)
    mode = next((a.split('=')[1] for a in sys.argv if a.startswith('--mode=')), 'quantity')
    range_val = next((int(a.split('=')[1]) for a in sys.argv if a.startswith('--range=')), 6)
    
    print(json.dumps(forecast_sales(csv_path, code, mode, range_val), cls=NumpyEncoder))


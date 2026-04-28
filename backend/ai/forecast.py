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


def _model_meta(slope, intercept, r2):
    return {
        "ml_algorithm": "scikit-learn LinearRegression",
        "regression_target": "cumulative_consumption_vs_day_index",
        "regression_slope": round(float(slope), 4),
        "regression_intercept": round(float(intercept), 4),
        "trend_fit_score": round(float(r2), 4),
        # Backward-compat alias for older UI consumers.
        "confidence_score": round(float(r2), 4),
    }


def forecast_stockout(csv_filepath, min_stock_level):
    try:
        min_stock_level = int(min_stock_level)
    except (ValueError, TypeError):
        return {"error": "Invalid min_stock_level provided. Must be an integer."}

    target_code = next((arg.split('=')[1] for arg in sys.argv if arg.startswith('--code=')), None)
    current_stock_arg = next((arg.split('=')[1] for arg in sys.argv if arg.startswith('--current_stock=')), None)
    history_days_arg = next((arg.split('=')[1] for arg in sys.argv if arg.startswith('--history_days=')), None)

    try:
        df = pd.read_csv(csv_filepath)
        if df.empty:
            return {"error": "CSV file is empty."}

        col_map = {
            'usage_date': 'date',
            'ending_stock': 'stock_level',
            'stock_level': 'stock_level',
            'date': 'date',
        }
        df = df.rename(columns={k: v for k, v in col_map.items() if k in df.columns})

        required_cols = ['date', 'stock_level']
        if not all(col in df.columns for col in required_cols):
            if 'quantity_used' in df.columns and 'date' in df.columns:
                pass
            else:
                return {"error": f"CSV must contain the following columns: {', '.join(required_cols)} (Found: {', '.join(df.columns)})"}

        if target_code and 'code' in df.columns:
            df = df[df['code'].astype(str) == target_code]
            if df.empty:
                return {"error": f"No data found for code {target_code} in dataset."}

    except FileNotFoundError:
        return {"error": f"CSV file not found at {csv_filepath}"}
    except Exception as e:
        return {"error": f"Error reading CSV file: {e}"}

    df['date'] = pd.to_datetime(df['date'], dayfirst=True, errors='coerce')
    mask = df['date'].isna()
    if mask.any():
        df.loc[mask, 'date'] = pd.to_datetime(df.loc[mask, 'date'], errors='coerce')
    df = df.dropna(subset=['date'])

    df['stock_level'] = pd.to_numeric(df['stock_level'], errors='coerce')
    df = df.dropna(subset=['stock_level'])

    df = df.sort_values(by=['date'])
    df = df.groupby('date', as_index=False).last()

    if history_days_arg:
        try:
            days = int(history_days_arg)
            if not df.empty:
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
            "average_daily_consumption": 0,
        }

    # Build a monotonic consumption series — robust to restock spikes that would
    # otherwise corrupt a raw stock_level regression.
    df = df.reset_index(drop=True)
    df['stock_diff'] = df['stock_level'].diff()
    # Daily consumption: only count negative changes (drops); restocks count as 0.
    df['daily_consumption'] = (-df['stock_diff']).clip(lower=0).fillna(0.0)
    df['cumulative_consumption'] = df['daily_consumption'].cumsum()

    last_date = df['date'].max()
    if current_stock_arg is not None:
        try:
            last_stock = float(current_stock_arg)
        except ValueError:
            last_stock = float(df['stock_level'].iloc[-1])
    else:
        last_stock = float(df['stock_level'].iloc[-1])

    window_start = df['date'].min()
    window_end = df['date'].max()
    total_days_in_window = max(1, (window_end - window_start).days)
    total_consumption = float(df['daily_consumption'].sum())
    average_daily_consumption = total_consumption / total_days_in_window

    # Fit Linear Regression on cumulative consumption over time. The slope IS the
    # learned daily consumption rate; R² measures how steady that rate has been.
    day_index = (df['date'] - df['date'].min()).dt.days.values.astype(float)
    X = day_index.reshape(-1, 1)
    y = df['cumulative_consumption'].values.astype(float)
    model = LinearRegression()
    model.fit(X, y)
    lr_r2 = float(r2_score(y, model.predict(X))) if len(set(y)) > 1 else 0.0
    slope = float(model.coef_[0])
    intercept = float(model.intercept_)
    meta = _model_meta(slope, intercept, lr_r2)

    base_date = datetime.now()

    if last_stock <= min_stock_level:
        return {
            "prediction_status": "Critical",
            "forecast_status": "Critical",
            "message": "Stock is currently at or below minimum level.",
            "predicted_stockout_date": last_date.strftime('%Y-%m-%d'),
            "days_until_stockout": 0,
            "average_daily_consumption": round(average_daily_consumption, 2),
            "predicted_monthly_sales": round(average_daily_consumption * 30, 2),
            "current_stock": last_stock,
            "min_stock_level": min_stock_level,
            "historical_period_end": last_date.strftime('%Y-%m-%d'),
            "last_recorded_date": last_date.strftime('%Y-%m-%d'),
            **meta,
        }

    # If the regressed daily consumption rate is non-positive, no stockout.
    if slope <= 0:
        return {
            "prediction_status": "Success",
            "forecast_status": "Safe",
            "message": "Linear regression on cumulative usage shows non-positive consumption rate; no stockout predicted.",
            "average_daily_consumption": round(average_daily_consumption, 2),
            "predicted_monthly_sales": round(average_daily_consumption * 30, 2),
            "days_until_stockout": None,
            "predicted_stockout_date": None,
            "current_stock": last_stock,
            "min_stock_level": min_stock_level,
            "historical_period_end": last_date.strftime('%Y-%m-%d'),
            "last_recorded_date": last_date.strftime('%Y-%m-%d'),
            **meta,
        }

    # Predict days until current_stock depletes to min_stock_level using the
    # learned consumption rate (slope of cumulative usage curve).
    stock_to_deplete = max(0.0, last_stock - min_stock_level)
    predicted_days_to_min = int(math.ceil(stock_to_deplete / slope))

    if predicted_days_to_min > 365 * 5:
        return {
            "prediction_status": "Success",
            "forecast_status": "Safe",
            "message": "Projected stockout is over 5 years away.",
            "average_daily_consumption": round(average_daily_consumption, 2),
            "predicted_monthly_sales": round(average_daily_consumption * 30, 2),
            "days_until_stockout": 1825,
            "predicted_stockout_date": (base_date + timedelta(days=1825)).strftime('%Y-%m-%d'),
            "current_stock": last_stock,
            "min_stock_level": min_stock_level,
            "historical_period_end": last_date.strftime('%Y-%m-%d'),
            "last_recorded_date": last_date.strftime('%Y-%m-%d'),
            **meta,
        }

    predicted_date_to_min = base_date + timedelta(days=predicted_days_to_min)

    if predicted_days_to_min < 7:
        forecast_status = "Critical"
    elif predicted_days_to_min < 14:
        forecast_status = "Reorder Soon"
    else:
        forecast_status = "Safe"

    return {
        "prediction_status": "Success",
        "forecast_status": forecast_status,
        "predicted_stockout_date": predicted_date_to_min.strftime('%Y-%m-%d'),
        "days_until_stockout": max(0, predicted_days_to_min),
        "current_stock": last_stock,
        "min_stock_level": min_stock_level,
        "average_daily_consumption": round(average_daily_consumption, 2),
        "predicted_monthly_sales": round(average_daily_consumption * 30, 2),
        "historical_period_end": last_date.strftime('%Y-%m-%d'),
        "last_recorded_date": last_date.strftime('%Y-%m-%d'),
        **meta,
    }


def run():
    try:
        if len(sys.argv) < 3:
            print(json.dumps({
                "error": "Usage: python forecast.py <csv_filepath> <min_stock_level> [--code=X] [--current_stock=Y] [--history_days=Z]",
                "prediction_status": "Monitoring",
                "message": "Insufficient parameters for AI model.",
            }))
            sys.exit(0)

        csv_filepath = sys.argv[1]
        try:
            min_stock_level = int(sys.argv[2])
        except ValueError:
            print(json.dumps({
                "error": "min_stock_level must be an integer",
                "prediction_status": "Monitoring",
            }))
            sys.exit(0)

        result = forecast_stockout(csv_filepath, min_stock_level)
        print(json.dumps(result, cls=NumpyEncoder))

    except Exception as e:
        print(json.dumps({
            "error": str(e),
            "prediction_status": "Monitoring",
            "message": "The AI model encountered an unexpected data anomaly. Monitoring active.",
            "average_daily_consumption": 0,
            "days_until_stockout": None,
        }))


if __name__ == '__main__':
    run()

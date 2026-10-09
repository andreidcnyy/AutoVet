import pandas as pd
import numpy as np
import json
import sys
import math
from datetime import datetime, timedelta
from sklearn.linear_model import LinearRegression
from sklearn.metrics import r2_score, mean_squared_error, mean_absolute_error


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


def _confidence_level(r2):
    if r2 >= 0.7:
        return "High"
    elif r2 >= 0.4:
        return "Medium"
    return "Low"


def _model_meta(slope, intercept, r2, test_r2=None, rmse=None, mae=None):
    return {
        "ml_algorithm": "scikit-learn LinearRegression",
        "regression_target": "cumulative_consumption_vs_day_index",
        "regression_slope": round(float(slope), 4),
        "regression_intercept": round(float(intercept), 4),
        "trend_fit_score": round(float(r2), 4),
        "confidence_score": round(float(r2), 4),
        "confidence_level": _confidence_level(r2),
        "test_r2": round(float(test_r2), 4) if test_r2 is not None else None,
        "validation_method": "80/20 holdout" if test_r2 is not None else "in-sample (insufficient data for split)",
        "rmse": round(float(rmse), 4) if rmse is not None else None,
        "mae": round(float(mae), 4) if mae is not None else None,
    }


def forecast_single_item(item_data, usage_df):
    item_id = item_data.get('id')
    min_stock_level = int(item_data.get('min_stock_level', 0))
    current_stock = float(item_data.get('current_stock', 0))
    history_days = int(item_data.get('history_days', 30))

    df = usage_df[usage_df['id'].astype(str) == str(item_id)].copy()

    if df.empty:
        return {
            "prediction_status": "Insufficient Data",
            "forecast_status": "Safe",
            "message": "No clinical consumption records found.",
            "average_daily_consumption": 0,
        }

    # Aggregate quantity used per day
    daily = df.groupby('date')['quantity_used'].sum().reset_index()
    daily = daily.sort_values('date').reset_index(drop=True)

    if len(daily) < 3:
        return {
            "prediction_status": "Insufficient Data",
            "forecast_status": "Safe",
            "message": f"Only {len(daily)} data point(s) found. At least 3 required for a valid trend.",
            "average_daily_consumption": 0,
            "current_stock": current_stock,
            "min_stock_level": min_stock_level,
        }

    # Build cumulative consumption and day index — same approach as forecast.py
    daily['cumulative_consumption'] = daily['quantity_used'].cumsum()
    min_date = daily['date'].min()
    daily['day_index'] = (daily['date'] - min_date).dt.days.astype(float)

    X = daily['day_index'].values.reshape(-1, 1)
    y = daily['cumulative_consumption'].values.astype(float)

    # 80/20 holdout validation when enough data points exist
    _MIN_SPLIT = 10
    model = LinearRegression()
    if len(X) >= _MIN_SPLIT:
        split = int(len(X) * 0.8)
        eval_model = LinearRegression()
        eval_model.fit(X[:split], y[:split])
        train_r2 = float(r2_score(y[:split], eval_model.predict(X[:split]))) if len(set(y[:split])) > 1 else 0.0
        test_r2  = float(r2_score(y[split:], eval_model.predict(X[split:]))) if len(set(y[split:])) > 1 else 0.0
        rmse = math.sqrt(mean_squared_error(y[split:], eval_model.predict(X[split:])))
        mae  = mean_absolute_error(y[split:], eval_model.predict(X[split:]))
        model.fit(X, y)
    else:
        model.fit(X, y)
        train_r2 = float(r2_score(y, model.predict(X))) if len(set(y)) > 1 else 0.0
        test_r2  = None
        rmse = math.sqrt(mean_squared_error(y, model.predict(X)))
        mae  = mean_absolute_error(y, model.predict(X))

    slope     = float(model.coef_[0])
    intercept = float(model.intercept_)
    meta      = _model_meta(slope, intercept, train_r2, test_r2, rmse, mae)

    # Informational average (not used for prediction — slope is)
    total_consumption        = float(daily['quantity_used'].sum())
    window_days              = max(1, int((daily['date'].max() - min_date).days) or 1)
    average_daily_consumption = total_consumption / window_days

    base_date = datetime.now()

    if slope <= 0:
        return {
            "prediction_status": "Success",
            "forecast_status": "Safe",
            "message": "Linear regression shows non-positive consumption rate; no stockout predicted.",
            "average_daily_consumption": round(average_daily_consumption, 2),
            "predicted_monthly_sales": round(average_daily_consumption * 30, 2),
            "days_until_stockout": None,
            "predicted_stockout_date": None,
            "current_stock": current_stock,
            "min_stock_level": min_stock_level,
            **meta,
        }

    if current_stock <= min_stock_level:
        return {
            "prediction_status": "Critical",
            "forecast_status": "Critical",
            "message": "Stock is currently at or below minimum level.",
            "predicted_stockout_date": base_date.strftime('%Y-%m-%d'),
            "days_until_stockout": 0,
            "average_daily_consumption": round(average_daily_consumption, 2),
            "predicted_monthly_sales": round(average_daily_consumption * 30, 2),
            "current_stock": current_stock,
            "min_stock_level": min_stock_level,
            **meta,
        }

    stock_to_deplete = max(0.0, current_stock - min_stock_level)
    predicted_days   = int(math.ceil(stock_to_deplete / slope))

    if predicted_days > 365 * 5:
        return {
            "prediction_status": "Success",
            "forecast_status": "Safe",
            "message": "Projected stockout is over 5 years away.",
            "average_daily_consumption": round(average_daily_consumption, 2),
            "predicted_monthly_sales": round(average_daily_consumption * 30, 2),
            "days_until_stockout": 1825,
            "predicted_stockout_date": (base_date + timedelta(days=1825)).strftime('%Y-%m-%d'),
            "current_stock": current_stock,
            "min_stock_level": min_stock_level,
            **meta,
        }

    predicted_date = base_date + timedelta(days=predicted_days)

    if predicted_days < 7:
        forecast_status = "Critical"
    elif predicted_days < 14:
        forecast_status = "Reorder Soon"
    else:
        forecast_status = "Safe"

    low_confidence = meta.get("confidence_level") == "Low"
    message = (
        "Low confidence prediction (R²={:.2f}). Trend is noisy — collect more usage data for reliable forecasting.".format(meta["trend_fit_score"])
        if low_confidence else None
    )

    return {
        "prediction_status": "Success",
        "forecast_status": forecast_status,
        "predicted_stockout_date": predicted_date.strftime('%Y-%m-%d'),
        "days_until_stockout": max(0, predicted_days),
        "current_stock": current_stock,
        "min_stock_level": min_stock_level,
        "average_daily_consumption": round(average_daily_consumption, 2),
        "predicted_monthly_sales": round(average_daily_consumption * 30, 2),
        **({"message": message} if message else {}),
        **meta,
    }


def run_batch():
    try:
        if len(sys.argv) < 3:
            print(json.dumps({"error": "Missing arguments."}))
            return

        csv_path       = sys.argv[1]
        json_input_path = sys.argv[2]

        df = pd.read_csv(csv_path)
        if not df.empty:
            df['date'] = pd.to_datetime(df['date'], errors='coerce')
            df = df.dropna(subset=['date'])

        with open(json_input_path, 'r') as f:
            items = json.load(f)

        results = {}
        for item in items:
            item_id = item.get('id')
            try:
                results[item_id] = forecast_single_item(item, df)
            except Exception as item_err:
                results[item_id] = {"error": str(item_err), "prediction_status": "Error"}

        print(json.dumps(results, cls=NumpyEncoder))

    except Exception as e:
        print(json.dumps({"error": str(e), "prediction_status": "GlobalError"}))


if __name__ == '__main__':
    run_batch()

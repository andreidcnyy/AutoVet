#!/usr/bin/env python3
"""
AutoVet Service Forecast Module
Algorithm: Linear Regression per category + Moving Average Smoothing
WARNING: Forecast only. Not medical/clinical prediction.
         Minimum 6 months of data recommended for reliable output.
"""

import sys
import json
import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression
from sklearn.metrics import r2_score

AVG_PRICE = {
    'consultation': 375,
    'grooming':     750,
    'vaccination':  887.50,
    'laboratory':   800,
    'others':       400,
}

CUSTOMER_RATE = {
    'consultation': 0.90,
    'grooming':     0.85,
    'vaccination':  0.95,
    'laboratory':   0.80,
    'others':       0.75,
}

def smooth(values, window=3):
    """Apply 3-month moving average to reduce spike influence."""
    return pd.Series(values).rolling(window=window, min_periods=1).mean().tolist()

def forecast(historical: list, horizon: int = 6) -> dict:
    if len(historical) < 2:
        raise ValueError("Insufficient data. Minimum 2 months required.")

    columns = ['consultation', 'grooming', 'vaccination', 'laboratory', 'others']

    n = len(historical)
    
    # Sort historical data by month
    historical_df = pd.DataFrame(historical).sort_values('month')
    historical = historical_df.to_dict('records')

    # Add month_of_year as second feature for seasonality awareness
    month_of_year_train = []
    for h in historical:
        month_val = int(h['month'].split('-')[1])
        month_of_year_train.append(month_val)
        
    X_train_full = np.column_stack([range(1, n + 1), month_of_year_train])

    X_future_idx = list(range(n + 1, n + horizon + 1))
    
    # Advance month labels for forecast
    last_month_str = historical[-1]['month']
    year, month = map(int, last_month_str.split('-'))
    forecast_months = []
    month_of_year_future = []
    for _ in range(horizon):
        month += 1
        if month > 12:
            month = 1
            year += 1
        forecast_months.append(f"{year:04d}-{month:02d}")
        month_of_year_future.append(month)

    X_future_full = np.column_stack([X_future_idx, month_of_year_future])

    # Train one model per category
    models = {}
    r2_scores = {}
    for col in columns:
        y_raw      = [float(h.get(col, 0)) for h in historical]
        y_smoothed = smooth(y_raw)
        model = LinearRegression()
        model.fit(X_train_full, y_smoothed)
        models[col]    = model
        r2_scores[col] = round(r2_score(y_smoothed, model.predict(X_train_full)), 3)

    results = []
    for i in range(horizon):
        X_i = X_future_full[i].reshape(1, -1)
        row = {'month': forecast_months[i]}

        # Per-category volumes
        category_volumes = {}
        for col in columns:
            pred = models[col].predict(X_i)[0]
            vol = max(0, int(round(pred)))
            
            # FALLBACK: If prediction is 0 but historical average is > 0, 
            # use a conservative 3-month moving average of the last historical data
            # to avoid the -100% "disappearing" effect in the UI.
            y_raw = [float(h.get(col, 0)) for h in historical]
            avg_last_3 = sum(y_raw[-3:]) / 3 if len(y_raw) >= 3 else sum(y_raw) / len(y_raw)
            
            if vol == 0 and avg_last_3 > 0.5:
                vol = max(1, int(round(avg_last_3 * 0.9))) # 90% of recent avg as a safe floor
            
            category_volumes[col] = vol

        # Per-category breakdown (for per-tab cards in dashboard)
        row['by_category'] = {}
        for col, vol in category_volumes.items():
            row['by_category'][col] = {
                'volume':              vol,
                'estimated_revenue':   round(vol * AVG_PRICE[col], 2),
                'estimated_customers': round(vol * CUSTOMER_RATE[col]),
            }

        # Category columns
        for col in columns:
            row[col] = category_volumes[col]

        # Totals
        row['total_services']      = sum(category_volumes.values())
        row['estimated_revenue']   = round(
            sum(v * AVG_PRICE[k] for k, v in category_volumes.items()), 2
        )
        row['estimated_customers'] = round(
            sum(v * CUSTOMER_RATE[k] for k, v in category_volumes.items())
        )

        results.append(row)

    return {
        "forecast": results,
        "model_info": {
            "algorithm":        "Linear Regression (per category) + Moving Average Smoothing",
            "training_months":  n,
            "forecast_horizon": horizon,
            "r2_scores":        r2_scores,
            "note":             "Surgery excluded. Not a clinical prediction tool."
        }
    }


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Usage: service_forecast.py <input.json> <output.json> [horizon]"}))
        sys.exit(1)

    input_path  = sys.argv[1]
    output_path = sys.argv[2]
    horizon     = int(sys.argv[3]) if len(sys.argv) > 3 else 6

    try:
        with open(input_path, 'r') as f:
            historical = json.load(f)
        result = forecast(historical, horizon)
        with open(output_path, 'w') as f:
            json.dump(result, f, indent=2)
    except Exception as e:
        with open(output_path, 'w') as f:
            json.dump({"error": str(e)}, f)
        sys.exit(1)

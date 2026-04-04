import pandas as pd
from sklearn.linear_model import LinearRegression
import numpy as np
import json
import sys
from datetime import datetime, timedelta

def forecast_stockout(csv_filepath, min_stock_level):
    try:
        df = pd.read_csv(csv_filepath, parse_dates=['date'])
    except FileNotFoundError:
        return {"error": f"CSV file not found at {csv_filepath}"}
    except Exception as e:
        return {"error": f"Error reading CSV file: {e}"}

    if df.empty:
        return {"error": "No data in CSV file to forecast."}

    # Sort data by date
    df = df.sort_values(by='date')

    # Convert dates to numerical format (days since the first recorded date)
    df['days'] = (df['date'] - df['date'].min()).dt.days

    # Use only the 'days' and 'stock_level' columns for regression
    X = df[['days']]
    y = df['stock_level']

    if len(X) < 2:
        return {"error": "Not enough data points (at least 2 required) to perform linear regression. Try with more history."}

    model = LinearRegression()
    model.fit(X, y)

    # Predict future stock levels
    last_day = df['days'].max()
    last_stock = df['stock_level'].iloc[-1]
    last_date = df['date'].max()

    # If stock is already at or below min_stock_level
    if last_stock <= min_stock_level:
        return {
            "prediction_status": "Stockout Imminent/Occurred",
            "message": f"Current stock ({last_stock}) is at or below minimum stock level ({min_stock_level}).",
            "last_recorded_stock": last_stock,
            "last_recorded_date": last_date.strftime('%Y-%m-%d')
        }

    # Find the day when stock hits min_stock_level
    # stock_level = intercept + slope * days
    # min_stock_level = model.intercept_ + model.coef_[0] * predicted_days
    # predicted_days = (min_stock_level - model.intercept_) / model.coef_[0]
    
    # Handle cases where slope is non-negative (stock not decreasing or increasing)
    if model.coef_[0] >= 0:
        return {
            "prediction_status": "No Stockout Predicted",
            "message": "Stock level is not decreasing or is increasing based on historical data.",
            "last_recorded_stock": last_stock,
            "last_recorded_date": last_date.strftime('%Y-%m-%d')
        }

    predicted_days_to_min = (min_stock_level - model.intercept_) / model.coef_[0]

    # Calculate actual predicted date
    predicted_date_to_min = df['date'].min() + timedelta(days=predicted_days_to_min)

    # Only provide a forecast if it's in the future
    if predicted_date_to_min > last_date:
        return {
            "prediction_status": "Forecast Available",
            "predicted_stockout_date": predicted_date_to_min.strftime('%Y-%m-%d'),
            "days_until_stockout": max(0, (predicted_date_to_min - last_date).days),
            "current_stock": last_stock,
            "min_stock_level": min_stock_level,
            "last_recorded_date": last_date.strftime('%Y-%m-%d')
        }
    else:
        return {
            "prediction_status": "Stockout Already Passed/Occurred",
            "message": f"Predicted stockout date ({predicted_date_to_min.strftime('%Y-%m-%d')}) has already passed or is today. Current stock is {last_stock}.",
            "last_recorded_stock": last_stock,
            "last_recorded_date": last_date.strftime('%Y-%m-%d')
        }

if __name__ == '__main__':
    # Expecting arguments: script_name, csv_filepath, min_stock_level
    if len(sys.argv) != 3:
        print(json.dumps({"error": "Usage: python3 forecast.py <csv_filepath> <min_stock_level>"}))
        sys.exit(1)

    csv_filepath = sys.argv[1]
    min_stock_level = int(sys.argv[2])

    result = forecast_stockout(csv_filepath, min_stock_level)
    print(json.dumps(result))
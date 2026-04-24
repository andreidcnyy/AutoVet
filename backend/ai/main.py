from fastapi import FastAPI, HTTPException, Query
from typing import Optional
import pandas as pd
import io
import os
from forecast import forecast_stockout, NumpyEncoder
from sales_forecast import forecast_sales
import json

app = FastAPI(title="AutoVet AI Microservice")

@app.get("/")
def read_root():
    return {"status": "online", "message": "AutoVet AI Engine is running"}

@app.post("/forecast/inventory")
async def get_inventory_forecast(
    min_stock_level: int,
    csv_data: str,
    code: Optional[str] = None,
    current_stock: Optional[float] = None,
    history_days: Optional[int] = 30
):
    # Save CSV data to a temp file for the existing forecast logic
    temp_file = "temp_inventory.csv"
    with open(temp_file, "w") as f:
        f.write(csv_data)
    
    try:
        # Mock sys.argv or refactor forecast.py slightly
        # For now, we'll refactor the call to accept arguments directly
        import sys
        # We need to preserve the sys.argv behavior for now or refactor forecast_stockout
        # Refactoring to accept args directly is better.
        
        result = forecast_stockout(temp_file, min_stock_level)
        return json.loads(json.dumps(result, cls=NumpyEncoder))
    finally:
        if os.path.exists(temp_file):
            os.remove(temp_file)

@app.post("/forecast/sales")
async def get_sales_forecast(
    csv_data: str,
    code: Optional[str] = None,
    mode: Optional[str] = "quantity",
    range_months: Optional[int] = 6
):
    temp_file = "temp_sales.csv"
    with open(temp_file, "w") as f:
        f.write(csv_data)
    
    try:
        result = forecast_sales(temp_file, code, mode, range_months)
        return json.loads(json.dumps(result, cls=NumpyEncoder))
    finally:
        if os.path.exists(temp_file):
            os.remove(temp_file)

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)

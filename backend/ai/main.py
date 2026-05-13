from fastapi import FastAPI, HTTPException, Query
from typing import Optional
import pandas as pd
import io
import os
from forecast import forecast_stockout, NumpyEncoder
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
        result = forecast_stockout(
            temp_file,
            min_stock_level,
            code=code,
            current_stock=current_stock,
            history_days=history_days,
        )
        return json.loads(json.dumps(result, cls=NumpyEncoder))
    finally:
        if os.path.exists(temp_file):
            os.remove(temp_file)


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)

import pandas as pd
import numpy as np
from datetime import datetime

def validate_dataset(file_path):
    print(f"--- Validating Dataset: {file_path} ---")
    try:
        df = pd.read_csv(file_path)
        print("Success: Successfully read file.")
    except Exception as e:
        print(f"Error: Error reading file: {e}")
        return

    # 1. Basic Stats
    rows, cols = df.shape
    print(f"Rows: {rows}")
    print(f"Columns: {cols}")
    print(f"Column Names: {list(df.columns)}")

    # 2. Required Columns
    required = ['inventory_id', 'item_name', 'category', 'usage_date', 'quantity_used']
    missing = [col for col in required if col not in df.columns]
    if missing:
        print(f"Error: Missing required columns: {missing}")
    else:
        print("Success: All required columns present.")

    # 3. Data Types & Values
    print("\n--- Data Type & Value Checks ---")
    
    # usage_date
    try:
        df['usage_date_dt'] = pd.to_datetime(df['usage_date'], format='%d/%m/%Y', errors='coerce')
        invalid_dates = df['usage_date_dt'].isna().sum()
        if invalid_dates > 0:
            print(f"Error: Found {invalid_dates} invalid dates in 'usage_date'.")
        else:
            print("Success: 'usage_date' is properly formatted (DD/MM/YYYY).")
    except Exception as e:
        print(f"Error: Error parsing 'usage_date': {e}")

    # quantity_used
    df['quantity_used_num'] = pd.to_numeric(df['quantity_used'], errors='coerce')
    invalid_qty = df['quantity_used_num'].isna().sum()
    if invalid_qty > 0:
        print(f"Error: Found {invalid_qty} non-numeric values in 'quantity_used'.")
    else:
        negative_qty = (df['quantity_used_num'] < 0).sum()
        if negative_qty > 0:
            print(f"Warning: Found {negative_qty} negative values in 'quantity_used'.")
        else:
            print("Success: 'quantity_used' is numeric and non-negative.")

    # 4. Data Quality
    print("\n--- Data Quality Checks ---")
    null_counts = df.isnull().sum().sum()
    print(f"Null Values: {null_counts}")
    
    dup_rows = df.duplicated().sum()
    print(f"Duplicate Rows: {dup_rows}")

    # 5. Time-Series Readiness
    print("\n--- Time-Series Readiness (Item-wise) ---")
    df = df.sort_values(['inventory_id', 'usage_date_dt'])
    
    # Check for duplicate dates per item
    item_date_dups = df.duplicated(subset=['inventory_id', 'usage_date_dt']).sum()
    if item_date_dups > 0:
        print(f"Error: Found {item_date_dups} duplicate entries for the same item on the same date.")
    else:
        print("Success: No duplicate entries for a single item on the same date.")

    # Check for gaps
    items = df['inventory_id'].unique()
    total_gaps = 0
    for item in items:
        item_df = df[df['inventory_id'] == item]
        date_range = pd.date_range(start=item_df['usage_date_dt'].min(), end=item_df['usage_date_dt'].max())
        if len(item_df) != len(date_range):
            gaps = len(date_range) - len(item_df)
            total_gaps += gaps
    
    if total_gaps > 0:
        print(f"Warning: Found {total_gaps} total day gaps across all items.")
    else:
        print("Success: No gaps in dates detected for any item.")

    min_date = df['usage_date_dt'].min()
    max_date = df['usage_date_dt'].max()
    print(f"Date Range: {min_date.date()} to {max_date.date()} ({ (max_date - min_date).days } days)")


if __name__ == "__main__":
    validate_dataset(r'c:\AutoVet\backend\storage\datasets\inventory.csv')

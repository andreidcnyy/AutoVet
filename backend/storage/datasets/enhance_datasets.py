import pandas as pd
import numpy as np
import os

def enhance_datasets():
    print("Starting dataset enhancement process...")
    
    inv_path = r'c:\AutoVet\backend\storage\datasets\inventory.csv'
    sales_path = r'c:\AutoVet\backend\storage\datasets\sales.csv'
    
    # Load data
    inv_df = pd.read_csv(inv_path)
    sales_df = pd.read_csv(sales_path)
    
    inv_df['usage_date_dt'] = pd.to_datetime(inv_df['usage_date'], format='%d/%m/%Y')
    sales_df['sales_date_dt'] = pd.to_datetime(sales_df['sales_date'], format='%d/%m/%Y')

    np.random.seed(42) # For reproducibility
    
    items = inv_df['inventory_id'].unique()
    
    enhanced_inv = []
    
    print("Processing inventory items...")
    for item_id in items:
        # Sort chronologically
        item_df = inv_df[inv_df['inventory_id'] == item_id].sort_values('usage_date_dt').copy()
        
        # 1. Base Seasonality
        month = item_df['usage_date_dt'].dt.month
        season_multiplier = np.ones(len(item_df))
        season_multiplier[(month >= 6) & (month <= 10)] = 1.15
        season_multiplier[month == 12] = 1.25
        season_multiplier[month == 2] = 0.85
        
        qty = item_df['quantity_used'].values.astype(float)
        qty = qty * season_multiplier
        qty = np.floor(qty) + (np.random.rand(len(qty)) < (qty - np.floor(qty))).astype(int)
        
        # 2. Spikes (2 per item per year)
        spike_indices = np.random.choice(len(qty), size=2, replace=False)
        for idx in spike_indices:
            spike_factor = np.random.uniform(3.0, 5.0)
            if qty[idx] == 0:
                qty[idx] = np.random.randint(3, 8) * spike_factor
            else:
                qty[idx] = qty[idx] * spike_factor
        qty = np.round(qty).astype(int)
        
        # 3. Autocorrelation (Smoothing)
        smoothed_qty = np.zeros_like(qty)
        smoothed_qty[0] = qty[0]
        for t in range(1, len(qty)):
            smoothed_val = 0.7 * qty[t] + 0.3 * smoothed_qty[t-1]
            smoothed_qty[t] = np.round(smoothed_val)
            if qty[t] == 0 and smoothed_qty[t-1] < 3:
                smoothed_qty[t] = 0
                
        # 4. Missing Values & Interpolation
        na_indices = np.random.choice(len(smoothed_qty), size=int(0.02 * len(smoothed_qty)), replace=False)
        smoothed_qty = smoothed_qty.astype(float)
        smoothed_qty[na_indices] = np.nan
        
        smoothed_qty_series = pd.Series(smoothed_qty).ffill().bfill()
        
        # CRITICAL FIX: use .values to avoid index alignment issues
        item_df['quantity_used'] = smoothed_qty_series.values.astype(int)
        
        # Update lag features
        item_df['previous_day_usage'] = item_df['quantity_used'].shift(1).fillna(0).astype(int)
        item_df['last_week_same_day_usage'] = item_df['quantity_used'].shift(7).fillna(0).astype(int)
        
        enhanced_inv.append(item_df)

    final_inv = pd.concat(enhanced_inv).sort_values(['inventory_id', 'usage_date_dt'])
    
    print("Processing sales matching and pricing...")
    enhanced_sales = []
    
    for item_id in items:
        item_inv = final_inv[final_inv['inventory_id'] == item_id].copy()
        item_sales = sales_df[sales_df['inventory_id'] == item_id].sort_values('sales_date_dt').copy()
        
        item_sales = item_sales.set_index('sales_date_dt')
        item_inv = item_inv.set_index('usage_date_dt')
        
        # 5. Sales vs Inventory Mismatch
        base_qty = item_inv['quantity_used'].values
        noise = np.random.uniform(0.8, 1.2, size=len(base_qty))
        sales_qty = np.round(base_qty * noise).astype(int)
        sales_qty = np.maximum(sales_qty, 0)
        item_sales['quantity_sold'] = sales_qty
        
        # 6. Price Adjustment
        base_price = item_sales['unit_price'].mode().iloc[0]
        new_prices = np.full(len(item_sales), base_price, dtype=float)
        
        num_changes = np.random.randint(1, 3)
        change_indices = sorted(np.random.choice(range(30, len(item_sales) - 30), size=num_changes, replace=False))
        
        current_price = base_price
        for idx in change_indices:
            current_price = current_price * np.random.uniform(1.02, 1.05)
            if current_price > 50:
                current_price = np.round(current_price / 5.0) * 5.0
            elif current_price > 10:
                current_price = np.round(current_price)
            else:
                current_price = np.round(current_price * 2) / 2
            
            new_prices[idx:] = current_price
            
        item_sales['unit_price'] = new_prices
        item_sales['total_sales'] = item_sales['quantity_sold'] * item_sales['unit_price']
        
        item_sales = item_sales.reset_index().rename(columns={'index': 'sales_date_dt'})
        enhanced_sales.append(item_sales)

    final_sales = pd.concat(enhanced_sales).sort_values(['inventory_id', 'sales_date_dt'])
    
    final_inv = final_inv.drop(columns=['usage_date_dt'])
    final_sales = final_sales.drop(columns=['sales_date_dt'])
    
    final_inv.to_csv(inv_path, index=False)
    final_sales.to_csv(sales_path, index=False)
    
    print("Enhancement complete. Modified datasets saved.")

if __name__ == "__main__":
    enhance_datasets()

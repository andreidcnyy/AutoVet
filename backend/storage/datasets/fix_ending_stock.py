import pandas as pd

inv_df = pd.read_csv(r'c:\AutoVet\backend\storage\datasets\inventory.csv')
items = inv_df['inventory_id'].unique()

recalculated_df = []
for item in items:
    # 1. Isolate the item temporally
    item_df = inv_df[inv_df['inventory_id'] == item].copy()
    
    # 2. Extract physics vectors
    used = item_df['quantity_used'].values
    restocked = item_df['quantity_restocked'].values
    stock = item_df['ending_stock'].values
    
    # 3. Simulate sequential ledger logic starting from the original row 0 stock
    for t in range(1, len(stock)):
        stock[t] = stock[t-1] - used[t] + restocked[t]
        
    item_df['ending_stock'] = stock
    recalculated_df.append(item_df)

# 4. Save and overwrite
pd.concat(recalculated_df).to_csv(r'c:\AutoVet\backend\storage\datasets\inventory.csv', index=False)
print("ending_stock successfully recalculated and inventory.csv rewritten.")

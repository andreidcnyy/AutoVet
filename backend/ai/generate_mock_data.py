import csv
import random
from datetime import datetime, timedelta

def generate_ph_clinic_data(years=2):
    start_date = datetime(2024, 1, 1)
    
    data = []
    
    # Initial states
    current_stock = 500 # e.g., Parvo vaccine units
    restock_level = 100
    restock_amount = 500
    
    headers = ['date', 'visits', 'revenue', 'stock_level', 'is_holiday', 'month', 'day_name']
    
    num_days = 365 * years
    for day_offset in range(num_days + 1):
        current_date = start_date + timedelta(days=day_offset)
        
        # 1. Seasonal Factors
        month = current_date.month
        day_of_week = current_date.weekday() # 0=Mon, 6=Sun
        
        season_mult = 1.0
        if month in [3, 4, 5]: # Summer peak (March to May)
            season_mult = 1.3
        elif month in [6, 7, 8]: # Rainy season (June to August)
            season_mult = 1.4
        elif month == 12: # Christmas rush
            season_mult = 1.5
            
        # 2. Holiday Factors
        holiday_mult = 1.0
        # Holy Week (approx mid-April)
        if month == 4 and 10 <= current_date.day <= 17:
            holiday_mult = 0.2
        # All Saints Day
        if month == 11 and current_date.day in [1, 2]:
            holiday_mult = 0.1
        # Christmas/New Year
        if (month == 12 and current_date.day in [24, 25, 30, 31]) or (month == 1 and current_date.day == 1):
            holiday_mult = 0.1
            
        # 3. Weekly Patterns (Busy on weekends)
        week_mult = 1.0
        if day_of_week in [5, 6]: # Sat, Sun
            week_mult = 1.6
        elif day_of_week == 0: # Mon
            week_mult = 1.2
            
        # Calculate daily visits
        base_visits = 15
        daily_visits = int(base_visits * season_mult * holiday_mult * week_mult + random.randint(-3, 3))
        daily_visits = max(0, daily_visits)
        
        # Calculate Revenue (PHP)
        avg_ticket = 1500 + random.randint(-500, 1000)
        daily_revenue = daily_visits * avg_ticket
        
        # 4. Inventory Consumption
        vaccines_used = int(daily_visits * 0.4 + (1 if random.random() > 0.5 else 0))
        current_stock -= vaccines_used
        
        # Auto-restock logic
        if current_stock <= restock_level:
            current_stock += restock_amount
            
        data.append([
            current_date.strftime('%Y-%m-%d'),
            daily_visits,
            daily_revenue,
            current_stock,
            1 if holiday_mult < 1.0 else 0,
            month,
            current_date.strftime('%A')
        ])
        
    return headers, data

if __name__ == "__main__":
    headers, data = generate_ph_clinic_data()
    file_path = 'backend/ai/ph_clinic_mock_data.csv'
    with open(file_path, 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(headers)
        writer.writerows(data)
    print(f"Generated 2 years of PH-specific clinic data in {file_path}")

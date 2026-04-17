import pandas as pd
import numpy as np
from collections import Counter

def analyze_realism(file_path):
    df = pd.read_csv(file_path)
    df['usage_date_dt'] = pd.to_datetime(df['usage_date'], format='%d/%m/%Y')
    df['dow'] = df['usage_date_dt'].dt.dayofweek  # 0=Mon, 6=Sun
    df['month'] = df['usage_date_dt'].dt.month
    df['is_weekend'] = df['dow'].isin([5, 6])

    items = df['inventory_id'].unique()

    print("=" * 70)
    print("REALISM ANALYSIS: inventory.csv")
    print("=" * 70)
    
    # ---------------------------------------------------------------
    # 1. Distribution of quantity_used per item
    # ---------------------------------------------------------------
    print("\n[1] DISTRIBUTION OF quantity_used PER ITEM")
    print("-" * 60)
    print(f"{'ID':<5} {'Item Name':<25} {'Mean':>6} {'Std':>6} {'Min':>4} {'Max':>4} {'Zero%':>6} {'CV':>6}")
    print("-" * 60)

    low_variance_items = []
    high_zero_items = []

    for item_id in sorted(items):
        item_df = df[df['inventory_id'] == item_id]
        name = item_df['item_name'].iloc[0][:24]
        qty = item_df['quantity_used']
        mean_val = qty.mean()
        std_val = qty.std()
        min_val = qty.min()
        max_val = qty.max()
        zero_pct = (qty == 0).sum() / len(qty) * 100
        cv = std_val / mean_val if mean_val > 0 else 0

        print(f"{item_id:<5} {name:<25} {mean_val:>6.2f} {std_val:>6.2f} {min_val:>4} {max_val:>4} {zero_pct:>5.1f}% {cv:>6.2f}")

        if std_val < 0.5 and mean_val > 0:
            low_variance_items.append((item_id, name))
        if zero_pct > 90:
            high_zero_items.append((item_id, name, zero_pct))

    if low_variance_items:
        print(f"\n  >> Warning: {len(low_variance_items)} items have suspiciously low variance (std < 0.5).")
    else:
        print("\n  >> OK: No items with suspiciously low variance.")

    if high_zero_items:
        print(f"  >> Note: {len(high_zero_items)} items have >90% zero-usage days (sparse demand -- can be realistic for specialty items).")

    # ---------------------------------------------------------------
    # 2. Perfect repetition detection
    # ---------------------------------------------------------------
    print("\n\n[2] PERFECT REPETITION / PATTERN DETECTION")
    print("-" * 60)

    repetition_issues = []
    for item_id in sorted(items):
        item_df = df[df['inventory_id'] == item_id].sort_values('usage_date_dt')
        name = item_df['item_name'].iloc[0][:24]
        qty_list = item_df['quantity_used'].tolist()

        # Check for repeating sequences (window sizes 7, 14, 28)
        for window in [7, 14, 28]:
            if len(qty_list) >= window * 2:
                matches = 0
                total_checks = 0
                for i in range(len(qty_list) - window):
                    if qty_list[i] == qty_list[i + window] and qty_list[i] != 0:
                        matches += 1
                    total_checks += 1
                repeat_pct = matches / total_checks * 100 if total_checks > 0 else 0
                if repeat_pct > 50:
                    repetition_issues.append((item_id, name, window, repeat_pct))

        # Check for longest constant run
        max_run = 1
        current_run = 1
        current_val = qty_list[0]
        for i in range(1, len(qty_list)):
            if qty_list[i] == current_val:
                current_run += 1
                max_run = max(max_run, current_run)
            else:
                current_run = 1
                current_val = qty_list[i]

        # Runs of zero are normal; runs of non-zero are suspicious
        max_nonzero_run = 1
        current_run = 1
        for i in range(1, len(qty_list)):
            if qty_list[i] == qty_list[i-1] and qty_list[i] != 0:
                current_run += 1
                max_nonzero_run = max(max_nonzero_run, current_run)
            else:
                current_run = 1

    if repetition_issues:
        print(f"  >> Warning: {len(repetition_issues)} item-window combos show >50% periodic repetition:")
        for iid, nm, w, pct in repetition_issues[:5]:
            print(f"     Item {iid} ({nm}): {pct:.1f}% repeat at window={w}")
    else:
        print("  >> OK: No suspicious periodic repetition detected.")

    # Check autocorrelation (lag-1)
    print("\n  Lag-1 Autocorrelation per item (non-zero values):")
    autocorr_values = []
    for item_id in sorted(items):
        item_df = df[df['inventory_id'] == item_id].sort_values('usage_date_dt')
        qty = item_df['quantity_used']
        if qty.std() > 0:
            ac = qty.autocorr(lag=1)
            autocorr_values.append(ac)

    mean_ac = np.nanmean(autocorr_values)
    print(f"  Mean lag-1 autocorrelation: {mean_ac:.4f}")
    if abs(mean_ac) < 0.3:
        print("  >> OK: Low autocorrelation suggests non-deterministic patterns.")
    else:
        print("  >> Warning: High autocorrelation may indicate synthetic generation.")

    # ---------------------------------------------------------------
    # 3. Weekend vs Weekday analysis
    # ---------------------------------------------------------------
    print("\n\n[3] WEEKEND vs WEEKDAY ANALYSIS")
    print("-" * 60)

    weekday_usage = df[~df['is_weekend']]['quantity_used']
    weekend_usage = df[df['is_weekend']]['quantity_used']

    wd_mean = weekday_usage.mean()
    we_mean = weekend_usage.mean()
    wd_nonzero_pct = (weekday_usage > 0).mean() * 100
    we_nonzero_pct = (weekend_usage > 0).mean() * 100

    print(f"  Weekday mean usage:  {wd_mean:.4f}  (non-zero days: {wd_nonzero_pct:.1f}%)")
    print(f"  Weekend mean usage:  {we_mean:.4f}  (non-zero days: {we_nonzero_pct:.1f}%)")
    diff_pct = abs(wd_mean - we_mean) / max(wd_mean, we_mean, 0.001) * 100
    print(f"  Difference: {diff_pct:.1f}%")

    if diff_pct < 5:
        print("  >> Warning: Almost no difference between weekday and weekend usage.")
        print("     Real clinics typically see reduced weekend volume.")
        weekend_verdict = "UNREALISTIC"
    elif diff_pct < 15:
        print("  >> Note: Small difference. Could be realistic for 7-day clinics.")
        weekend_verdict = "BORDERLINE"
    else:
        print("  >> OK: Clear weekday/weekend differentiation.")
        weekend_verdict = "REALISTIC"

    # Per-day-of-week breakdown
    print("\n  Per Day-of-Week Average Usage:")
    day_names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    for d in range(7):
        day_usage = df[df['dow'] == d]['quantity_used'].mean()
        bar = '#' * int(day_usage * 20 / max(df.groupby('dow')['quantity_used'].mean()))
        print(f"    {day_names[d]}: {day_usage:.3f}  {bar}")

    # ---------------------------------------------------------------
    # 4. Seasonal variation
    # ---------------------------------------------------------------
    print("\n\n[4] SEASONAL VARIATION ANALYSIS")
    print("-" * 60)

    monthly_usage = df.groupby('month')['quantity_used'].agg(['mean', 'sum']).reset_index()
    monthly_usage.columns = ['Month', 'Mean', 'Total']

    month_names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                   'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    max_total = monthly_usage['Total'].max()

    print(f"  {'Month':<6} {'Mean':>8} {'Total':>8}  Visual")
    print(f"  {'-'*6} {'-'*8} {'-'*8}  {'-'*30}")
    for _, row in monthly_usage.iterrows():
        m = int(row['Month'])
        bar_len = int(row['Total'] / max_total * 30) if max_total > 0 else 0
        bar = '#' * bar_len
        marker = ' <-- expected spike' if m in [6, 7, 8, 9, 10, 12] else ''
        print(f"  {month_names[m-1]:<6} {row['Mean']:>8.3f} {int(row['Total']):>8}  {bar}{marker}")

    overall_cv = monthly_usage['Total'].std() / monthly_usage['Total'].mean() if monthly_usage['Total'].mean() > 0 else 0
    print(f"\n  Monthly total CV (coefficient of variation): {overall_cv:.4f}")

    # Check for expected seasonal patterns
    wet_season = monthly_usage[monthly_usage['Month'].isin([6, 7, 8, 9, 10])]['Total'].mean()
    dry_season = monthly_usage[monthly_usage['Month'].isin([1, 2, 3, 4, 5])]['Total'].mean()
    dec_total = monthly_usage[monthly_usage['Month'] == 12]['Total'].values[0]
    annual_mean = monthly_usage['Total'].mean()

    print(f"\n  Wet season avg (Jun-Oct):  {wet_season:.0f}")
    print(f"  Dry season avg (Jan-May):  {dry_season:.0f}")
    print(f"  December total:            {dec_total}")
    print(f"  Annual monthly avg:        {annual_mean:.0f}")

    if overall_cv < 0.05:
        print("  >> Warning: Extremely flat seasonal curve. Real vet data shows seasonal swings.")
        seasonal_verdict = "UNREALISTIC"
    elif overall_cv < 0.10:
        print("  >> Note: Low but present seasonal variation.")
        seasonal_verdict = "BORDERLINE"
    else:
        print("  >> OK: Meaningful seasonal variation exists.")
        seasonal_verdict = "REALISTIC"

    # ---------------------------------------------------------------
    # 5. Value distribution shape
    # ---------------------------------------------------------------
    print("\n\n[5] VALUE DISTRIBUTION SHAPE")
    print("-" * 60)

    all_qty = df['quantity_used']
    nonzero = all_qty[all_qty > 0]

    print(f"  Total data points:     {len(all_qty)}")
    print(f"  Zero values:           {(all_qty == 0).sum()} ({(all_qty == 0).mean()*100:.1f}%)")
    print(f"  Non-zero values:       {len(nonzero)} ({len(nonzero)/len(all_qty)*100:.1f}%)")
    print(f"  Non-zero mean:         {nonzero.mean():.2f}")
    print(f"  Non-zero median:       {nonzero.median():.2f}")
    print(f"  Non-zero std:          {nonzero.std():.2f}")
    print(f"  Skewness:              {nonzero.skew():.2f}")
    print(f"  Kurtosis:              {nonzero.kurtosis():.2f}")

    # Value frequency
    val_counts = nonzero.value_counts().sort_index().head(15)
    print(f"\n  Top non-zero value frequencies:")
    for val, count in val_counts.items():
        pct = count / len(nonzero) * 100
        print(f"    {int(val):>3}: {count:>5} occurrences ({pct:>5.1f}%)")

    if nonzero.skew() > 0.5:
        print("\n  >> OK: Right-skewed distribution (many small values, few large) -- typical for real demand.")
    else:
        print("\n  >> Note: Distribution is not strongly right-skewed. Real demand typically is.")

    # ---------------------------------------------------------------
    # FINAL VERDICT
    # ---------------------------------------------------------------
    print("\n")
    print("=" * 70)
    print("FINAL VERDICT")
    print("=" * 70)

    issues = []
    positives = []

    # Assess each dimension
    if low_variance_items:
        issues.append(f"{len(low_variance_items)} items have suspiciously low variance")
    else:
        positives.append("Good variance across items")

    if repetition_issues:
        issues.append(f"Periodic repetition detected in {len(repetition_issues)} item-window combos")
    else:
        positives.append("No mechanical repetition patterns")

    if abs(mean_ac) >= 0.3:
        issues.append(f"High autocorrelation ({mean_ac:.3f}) suggests synthetic generation")
    else:
        positives.append(f"Natural autocorrelation ({mean_ac:.3f})")

    if weekend_verdict == "UNREALISTIC":
        issues.append("No meaningful weekday/weekend difference")
    elif weekend_verdict == "REALISTIC":
        positives.append("Clear weekday/weekend differentiation")
    else:
        positives.append("Some weekday/weekend differentiation (borderline)")

    if seasonal_verdict == "UNREALISTIC":
        issues.append("Flat seasonal curve -- no variation across months")
    elif seasonal_verdict == "REALISTIC":
        positives.append("Meaningful seasonal variation")
    else:
        positives.append("Some seasonal variation (borderline)")

    if nonzero.skew() > 0.5:
        positives.append("Right-skewed demand distribution (realistic)")
    else:
        issues.append("Demand distribution lacks expected right-skew")

    if high_zero_items:
        positives.append(f"{len(high_zero_items)} items with sparse demand (realistic for specialty products)")

    print("\n  STRENGTHS:")
    for p in positives:
        print(f"    [+] {p}")

    print("\n  ISSUES:")
    if issues:
        for i in issues:
            print(f"    [-] {i}")
    else:
        print("    None found.")

    if len(issues) == 0:
        print("\n  VERDICT: REALISTIC")
        print("  The dataset exhibits natural demand patterns consistent with real veterinary clinic operations.")
    elif len(issues) <= 2:
        print("\n  VERDICT: PARTIALLY REALISTIC")
        print("  The dataset has minor issues but is generally usable for forecasting with caveats.")
    else:
        print("\n  VERDICT: UNREALISTIC")
        print("  The dataset shows multiple signs of synthetic/artificial generation.")


if __name__ == "__main__":
    analyze_realism(r'c:\AutoVet\backend\storage\datasets\inventory.csv')

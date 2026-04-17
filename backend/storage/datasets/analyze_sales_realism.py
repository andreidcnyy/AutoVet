import pandas as pd
import numpy as np

def analyze_sales_realism(file_path):
    df = pd.read_csv(file_path)
    df['sales_date_dt'] = pd.to_datetime(df['sales_date'], format='%d/%m/%Y')
    df['dow'] = df['sales_date_dt'].dt.dayofweek
    df['month'] = df['sales_date_dt'].dt.month
    df['is_weekend'] = df['dow'].isin([5, 6])

    items = df['inventory_id'].unique()

    print("=" * 70)
    print("REALISM ANALYSIS: sales.csv")
    print("=" * 70)

    # ---------------------------------------------------------------
    # 1. Distribution of quantity_sold per item
    # ---------------------------------------------------------------
    print("\n[1] DISTRIBUTION OF quantity_sold PER ITEM")
    print("-" * 70)
    print(f"{'ID':<4} {'Item Name':<50} {'Mean':>6} {'Std':>6} {'Min':>4} {'Max':>4} {'Zero%':>6} {'CV':>6}")
    print("-" * 70)

    low_variance_items = []
    high_zero_items = []
    categories = {}

    for item_id in sorted(items):
        item_df = df[df['inventory_id'] == item_id]
        name = item_df['item_name'].iloc[0][:49]
        cat = item_df['category'].iloc[0]
        categories[item_id] = cat
        qty = item_df['quantity_sold']
        mean_val = qty.mean()
        std_val = qty.std()
        min_val = qty.min()
        max_val = qty.max()
        zero_pct = (qty == 0).sum() / len(qty) * 100
        cv = std_val / mean_val if mean_val > 0 else 0

        print(f"{item_id:<4} {name:<50} {mean_val:>6.2f} {std_val:>6.2f} {min_val:>4} {max_val:>4} {zero_pct:>5.1f}% {cv:>6.2f}")

        if std_val < 0.5 and mean_val > 0:
            low_variance_items.append((item_id, name))
        if zero_pct > 90:
            high_zero_items.append((item_id, name, zero_pct))

    if low_variance_items:
        print(f"\n  >> Warning: {len(low_variance_items)} items have suspiciously low variance (std < 0.5).")
    else:
        print("\n  >> OK: No items with suspiciously low variance.")

    if high_zero_items:
        print(f"  >> Note: {len(high_zero_items)} items have >90% zero-sales days (sparse demand).")

    # ---------------------------------------------------------------
    # 2. Category-level behavior
    # ---------------------------------------------------------------
    print("\n\n[2] CATEGORY-LEVEL BEHAVIOR")
    print("-" * 60)
    cat_stats = df.groupby('category')['quantity_sold'].agg(['mean', 'std', 'sum', 'count']).reset_index()
    cat_stats.columns = ['Category', 'Mean', 'Std', 'Total', 'Records']
    for _, row in cat_stats.iterrows():
        print(f"  {row['Category']:<25} Mean: {row['Mean']:>6.2f}  Std: {row['Std']:>6.2f}  Total: {int(row['Total']):>8}")

    # ---------------------------------------------------------------
    # 3. Perfect repetition detection
    # ---------------------------------------------------------------
    print("\n\n[3] PERFECT REPETITION / PATTERN DETECTION")
    print("-" * 60)

    repetition_issues = []
    for item_id in sorted(items):
        item_df = df[df['inventory_id'] == item_id].sort_values('sales_date_dt')
        name = item_df['item_name'].iloc[0][:30]
        qty_list = item_df['quantity_sold'].tolist()

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

    if repetition_issues:
        print(f"  >> Warning: {len(repetition_issues)} item-window combos show >50% periodic repetition:")
        for iid, nm, w, pct in repetition_issues[:5]:
            print(f"     Item {iid} ({nm}): {pct:.1f}% repeat at window={w}")
    else:
        print("  >> OK: No suspicious periodic repetition detected.")

    # Autocorrelation
    autocorr_values = []
    for item_id in sorted(items):
        item_df = df[df['inventory_id'] == item_id].sort_values('sales_date_dt')
        qty = item_df['quantity_sold']
        if qty.std() > 0:
            ac = qty.autocorr(lag=1)
            autocorr_values.append(ac)

    mean_ac = np.nanmean(autocorr_values)
    print(f"\n  Mean lag-1 autocorrelation: {mean_ac:.4f}")
    if abs(mean_ac) < 0.3:
        print("  >> OK: Low autocorrelation suggests non-deterministic patterns.")
    else:
        print("  >> Warning: High autocorrelation may indicate synthetic generation.")

    # ---------------------------------------------------------------
    # 4. Weekend vs Weekday analysis
    # ---------------------------------------------------------------
    print("\n\n[4] WEEKEND vs WEEKDAY ANALYSIS")
    print("-" * 60)

    weekday_sales = df[~df['is_weekend']]['quantity_sold']
    weekend_sales = df[df['is_weekend']]['quantity_sold']

    wd_mean = weekday_sales.mean()
    we_mean = weekend_sales.mean()
    wd_nonzero_pct = (weekday_sales > 0).mean() * 100
    we_nonzero_pct = (weekend_sales > 0).mean() * 100

    print(f"  Weekday mean sales:  {wd_mean:.4f}  (non-zero days: {wd_nonzero_pct:.1f}%)")
    print(f"  Weekend mean sales:  {we_mean:.4f}  (non-zero days: {we_nonzero_pct:.1f}%)")
    diff_pct = abs(wd_mean - we_mean) / max(wd_mean, we_mean, 0.001) * 100
    print(f"  Difference: {diff_pct:.1f}%")

    if diff_pct < 5:
        print("  >> Warning: Almost no difference between weekday and weekend sales.")
        weekend_verdict = "UNREALISTIC"
    elif diff_pct < 15:
        print("  >> Note: Small difference. Could be realistic for 7-day clinics.")
        weekend_verdict = "BORDERLINE"
    else:
        print("  >> OK: Clear weekday/weekend differentiation.")
        weekend_verdict = "REALISTIC"

    # Per-day breakdown
    print("\n  Per Day-of-Week Average Sales:")
    day_names = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    dow_means = df.groupby('dow')['quantity_sold'].mean()
    max_dow = dow_means.max()
    for d in range(7):
        val = dow_means.get(d, 0)
        bar_len = int(val / max_dow * 25) if max_dow > 0 else 0
        print(f"    {day_names[d]}: {val:.3f}  {'#' * bar_len}")

    # ---------------------------------------------------------------
    # 5. Seasonal variation
    # ---------------------------------------------------------------
    print("\n\n[5] SEASONAL VARIATION ANALYSIS")
    print("-" * 60)

    monthly = df.groupby('month')['quantity_sold'].agg(['mean', 'sum']).reset_index()
    monthly.columns = ['Month', 'Mean', 'Total']
    month_names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                   'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    max_total = monthly['Total'].max()

    print(f"  {'Month':<6} {'Mean':>8} {'Total':>8}  Visual")
    print(f"  {'-'*6} {'-'*8} {'-'*8}  {'-'*30}")
    for _, row in monthly.iterrows():
        m = int(row['Month'])
        bar_len = int(row['Total'] / max_total * 30) if max_total > 0 else 0
        marker = ' <-- expected spike' if m in [6, 7, 8, 9, 10, 12] else ''
        print(f"  {month_names[m-1]:<6} {row['Mean']:>8.3f} {int(row['Total']):>8}  {'#' * bar_len}{marker}")

    overall_cv = monthly['Total'].std() / monthly['Total'].mean() if monthly['Total'].mean() > 0 else 0
    print(f"\n  Monthly total CV: {overall_cv:.4f}")

    wet_season = monthly[monthly['Month'].isin([6, 7, 8, 9, 10])]['Total'].mean()
    dry_season = monthly[monthly['Month'].isin([1, 2, 3, 4, 5])]['Total'].mean()
    dec_total = monthly[monthly['Month'] == 12]['Total'].values[0]
    annual_mean = monthly['Total'].mean()

    print(f"\n  Wet season avg (Jun-Oct):  {wet_season:.0f}")
    print(f"  Dry season avg (Jan-May):  {dry_season:.0f}")
    print(f"  December total:            {dec_total}")
    print(f"  Annual monthly avg:        {annual_mean:.0f}")

    if overall_cv < 0.05:
        seasonal_verdict = "UNREALISTIC"
        print("  >> Warning: Extremely flat seasonal curve.")
    elif overall_cv < 0.10:
        seasonal_verdict = "BORDERLINE"
        print("  >> Note: Low but present seasonal variation.")
    else:
        seasonal_verdict = "REALISTIC"
        print("  >> OK: Meaningful seasonal variation exists.")

    # ---------------------------------------------------------------
    # 6. Revenue integrity check
    # ---------------------------------------------------------------
    print("\n\n[6] REVENUE INTEGRITY CHECK")
    print("-" * 60)

    # Check unit_price consistency per item
    price_issues = []
    for item_id in sorted(items):
        item_df = df[df['inventory_id'] == item_id]
        unique_prices = item_df['unit_price'].nunique()
        if unique_prices > 1:
            prices = item_df['unit_price'].unique()
            price_issues.append((item_id, item_df['item_name'].iloc[0][:30], unique_prices, prices))

    if price_issues:
        print(f"  >> Warning: {len(price_issues)} items have inconsistent unit prices:")
        for iid, nm, cnt, prices in price_issues[:5]:
            print(f"     Item {iid} ({nm}): {cnt} different prices: {prices}")
    else:
        print("  >> OK: All items have consistent unit prices throughout the year.")

    # total_sales accuracy
    df['calc_total'] = df['quantity_sold'] * df['unit_price']
    mismatch = (np.abs(df['total_sales'] - df['calc_total']) > 0.01).sum()
    if mismatch > 0:
        print(f"  >> Warning: {mismatch} rows where total_sales != quantity_sold * unit_price.")
    else:
        print("  >> OK: total_sales = quantity_sold * unit_price for all rows.")

    # ---------------------------------------------------------------
    # 7. Value distribution shape
    # ---------------------------------------------------------------
    print("\n\n[7] VALUE DISTRIBUTION SHAPE")
    print("-" * 60)

    all_qty = df['quantity_sold']
    nonzero = all_qty[all_qty > 0]

    print(f"  Total data points:     {len(all_qty)}")
    print(f"  Zero values:           {(all_qty == 0).sum()} ({(all_qty == 0).mean()*100:.1f}%)")
    print(f"  Non-zero values:       {len(nonzero)} ({len(nonzero)/len(all_qty)*100:.1f}%)")
    print(f"  Non-zero mean:         {nonzero.mean():.2f}")
    print(f"  Non-zero median:       {nonzero.median():.2f}")
    print(f"  Non-zero std:          {nonzero.std():.2f}")
    print(f"  Skewness:              {nonzero.skew():.2f}")
    print(f"  Kurtosis:              {nonzero.kurtosis():.2f}")

    val_counts = nonzero.value_counts().sort_index().head(15)
    print(f"\n  Top non-zero value frequencies:")
    for val, count in val_counts.items():
        pct = count / len(nonzero) * 100
        print(f"    {int(val):>3}: {count:>5} occurrences ({pct:>5.1f}%)")

    if nonzero.skew() > 0.5:
        print("\n  >> OK: Right-skewed distribution -- typical for real demand.")
    else:
        print("\n  >> Note: Distribution is not strongly right-skewed.")

    # ---------------------------------------------------------------
    # 8. Cross-dataset consistency (inventory vs sales item alignment)
    # ---------------------------------------------------------------
    print("\n\n[8] CROSS-DATASET ITEM COVERAGE")
    print("-" * 60)
    print(f"  Unique inventory_id values in sales.csv: {len(items)}")
    unique_cats = df['category'].unique()
    print(f"  Categories: {list(unique_cats)}")
    print(f"  Items per day: {len(items)} items x 365 days = {len(items) * 365} expected rows")
    actual_row_count = len(df)
    expected = len(items) * 365
    if actual_row_count == expected:
        print(f"  >> OK: Row count ({actual_row_count}) matches expected ({expected}).")
    else:
        diff = expected - actual_row_count
        print(f"  >> Note: Row count ({actual_row_count}) vs expected ({expected}). Difference: {diff} rows.")

    # ---------------------------------------------------------------
    # FINAL VERDICT
    # ---------------------------------------------------------------
    print("\n")
    print("=" * 70)
    print("FINAL VERDICT")
    print("=" * 70)

    issues = []
    positives = []

    if low_variance_items:
        issues.append(f"{len(low_variance_items)} items have suspiciously low variance")
    else:
        positives.append("Good variance across all 28 items")

    if repetition_issues:
        issues.append(f"Periodic repetition in {len(repetition_issues)} item-window combos")
    else:
        positives.append("No mechanical repetition patterns")

    if abs(mean_ac) >= 0.3:
        issues.append(f"High autocorrelation ({mean_ac:.3f})")
    else:
        positives.append(f"Natural autocorrelation ({mean_ac:.3f})")

    if weekend_verdict == "UNREALISTIC":
        issues.append("No meaningful weekday/weekend difference")
    elif weekend_verdict == "REALISTIC":
        positives.append("Clear weekday/weekend differentiation")
    else:
        positives.append("Some weekday/weekend differentiation")

    if seasonal_verdict == "UNREALISTIC":
        issues.append("Flat seasonal curve")
    elif seasonal_verdict == "REALISTIC":
        positives.append("Meaningful seasonal variation")
    else:
        positives.append("Some seasonal variation")

    if nonzero.skew() > 0.5:
        positives.append("Right-skewed demand distribution (realistic)")
    else:
        issues.append("Demand lacks expected right-skew")

    if not price_issues:
        positives.append("Consistent unit pricing per item")
    else:
        issues.append(f"Inconsistent pricing on {len(price_issues)} items")

    if mismatch == 0:
        positives.append("Revenue calculations are mathematically correct")
    else:
        issues.append(f"{mismatch} revenue calculation mismatches")

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
        print("  The sales dataset exhibits natural demand patterns consistent with real veterinary clinic operations.")
    elif len(issues) <= 2:
        print("\n  VERDICT: PARTIALLY REALISTIC")
        print("  The dataset has minor issues but is generally usable.")
    else:
        print("\n  VERDICT: UNREALISTIC")
        print("  The dataset shows multiple signs of synthetic/artificial generation.")


if __name__ == "__main__":
    analyze_sales_realism(r'c:\AutoVet\backend\storage\datasets\sales.csv')

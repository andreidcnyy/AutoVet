<?php

namespace App\Http\Controllers;

use App\Models\Invoice;
use App\Models\InvoiceItem;
use App\Models\Inventory;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class ReportAnalyticsController extends Controller
{
    // -------------------------------------------------------------------------
    // Shared helpers
    // -------------------------------------------------------------------------

    /**
     * Simple linear regression on an array of y-values (x = 0,1,2,...).
     * Returns [slope, intercept, r2].
     */
    private function fitLR(array $y): array
    {
        $n = count($y);
        if ($n < 2) {
            return [0, $n === 1 ? $y[0] : 0, 0.0];
        }
        $x    = range(0, $n - 1);
        $sumX = array_sum($x);
        $sumY = array_sum($y);
        $sumXY = 0;
        $sumX2 = 0;
        for ($i = 0; $i < $n; $i++) {
            $sumXY += $x[$i] * $y[$i];
            $sumX2 += $x[$i] * $x[$i];
        }
        $denom = ($n * $sumX2) - ($sumX * $sumX);
        $m     = $denom != 0 ? (($n * $sumXY) - ($sumX * $sumY)) / $denom : 0;
        $b     = ($sumY - ($m * $sumX)) / $n;

        $meanY = $sumY / $n;
        $ssTot = array_sum(array_map(fn($v) => pow($v - $meanY, 2), $y));
        $ssRes = 0;
        for ($i = 0; $i < $n; $i++) {
            $ssRes += pow($y[$i] - ($m * $i + $b), 2);
        }
        $r2 = $ssTot > 0 ? round(1 - $ssRes / $ssTot, 4) : 0.0;

        return [$m, $b, $r2];
    }

    // -------------------------------------------------------------------------
    // Transaction analytics
    // -------------------------------------------------------------------------

    /**
     * Monthly invoice count + volume trend with LR fitted values and 2-month forecast.
     *
     * GET /reports/analytics/transaction-trends?months=12
     */
    public function transactionTrends(Request $request): JsonResponse
    {
        $months = max(3, min(24, (int) $request->query('months', 12)));
        $start  = Carbon::now()->startOfMonth()->subMonths($months - 1);

        $rows = Invoice::where('created_at', '>=', $start)
            ->selectRaw("DATE_FORMAT(created_at, '%Y-%m') AS month, COUNT(*) AS count, SUM(total) AS revenue")
            ->groupBy('month')
            ->orderBy('month')
            ->get()
            ->keyBy('month');

        // Build ordered arrays
        $labels  = [];
        $counts  = [];
        $revenues = [];
        for ($i = 0; $i < $months; $i++) {
            $key       = $start->copy()->addMonths($i)->format('Y-m');
            $labels[]  = $key;
            $counts[]  = (int) ($rows[$key]->count   ?? 0);
            $revenues[] = (float) ($rows[$key]->revenue ?? 0);
        }

        [$mC, $bC, $r2C] = $this->fitLR($counts);
        [$mR, $bR, $r2R] = $this->fitLR($revenues);

        $series = [];
        foreach ($labels as $idx => $key) {
            $series[] = [
                'month'         => Carbon::createFromFormat('Y-m', $key)->format('M Y'),
                'actual_count'  => $counts[$idx],
                'actual_revenue'=> $revenues[$idx],
                'trend_count'   => round(max(0, $mC * $idx + $bC), 2),
                'trend_revenue' => round(max(0, $mR * $idx + $bR), 2),
            ];
        }
        // 2-month forecast (null actuals, trend line continues)
        for ($i = 1; $i <= 2; $i++) {
            $idx      = $months - 1 + $i;
            $series[] = [
                'month'         => Carbon::now()->startOfMonth()->addMonths($i)->format('M Y'),
                'actual_count'  => null,
                'actual_revenue'=> null,
                'trend_count'   => round(max(0, $mC * $idx + $bC), 2),
                'trend_revenue' => round(max(0, $mR * $idx + $bR), 2),
            ];
        }

        $totalCount   = array_sum($counts);
        $totalRevenue = array_sum($revenues);

        return response()->json([
            'series'  => $series,
            'model'   => [
                'count'   => ['slope' => round($mC, 3), 'intercept' => round($bC, 2), 'r2' => $r2C],
                'revenue' => ['slope' => round($mR, 3), 'intercept' => round($bR, 2), 'r2' => $r2R],
            ],
            'summary' => [
                'total_invoices'  => $totalCount,
                'total_revenue'   => $totalRevenue,
                'avg_per_invoice' => $totalCount > 0 ? round($totalRevenue / $totalCount, 2) : 0,
            ],
        ]);
    }

    /**
     * Invoice status breakdown + top items for a given rolling period.
     *
     * GET /reports/analytics/transaction-stats?days=30
     */
    public function transactionStats(Request $request): JsonResponse
    {
        $days  = max(7, min(365, (int) $request->query('days', 30)));
        $since = Carbon::now()->subDays($days);

        $byStatus = Invoice::where('created_at', '>=', $since)
            ->selectRaw('status, COUNT(*) AS count, SUM(total) AS revenue')
            ->groupBy('status')
            ->orderByDesc('count')
            ->get();

        $topItems = InvoiceItem::whereHas('invoice', fn($q) =>
                $q->whereIn('status', ['Finalized', 'Paid', 'Partially Paid'])
                  ->where('created_at', '>=', $since)
            )
            ->selectRaw('name, item_type, COUNT(*) AS times_used, SUM(qty) AS total_qty')
            ->groupBy('name', 'item_type')
            ->orderByDesc('times_used')
            ->limit(10)
            ->get();

        return response()->json([
            'by_status' => $byStatus,
            'top_items' => $topItems,
            'period_days' => $days,
        ]);
    }

    // -------------------------------------------------------------------------
    // Inventory analytics
    // -------------------------------------------------------------------------

    /**
     * Monthly consumption per category from inventory_usage_history, with per-category
     * LR fitted values and a 2-month forecast.
     *
     * GET /reports/analytics/inventory-consumption?months=12
     */
    public function inventoryConsumption(Request $request): JsonResponse
    {
        $months = max(3, min(24, (int) $request->query('months', 12)));
        $start  = Carbon::now()->startOfMonth()->subMonths($months - 1);

        $usageRows = DB::table('inventory_usage_history')
            ->join('inventories', 'inventory_usage_history.inventory_id', '=', 'inventories.id')
            ->leftJoin('mdm_inventory_categories', 'inventories.inventory_category_id', '=', 'mdm_inventory_categories.id')
            ->where('inventory_usage_history.usage_date', '>=', $start->toDateString())
            ->selectRaw("
                COALESCE(mdm_inventory_categories.name, 'Uncategorized') AS category,
                DATE_FORMAT(inventory_usage_history.usage_date, '%Y-%m') AS month,
                SUM(inventory_usage_history.quantity_used) AS qty
            ")
            ->groupBy('category', 'month')
            ->orderBy('month')
            ->get();

        // Pivot: category → month → qty
        $pivot = [];
        foreach ($usageRows as $row) {
            $pivot[$row->category][$row->month] = (float) $row->qty;
        }

        if (empty($pivot)) {
            return response()->json([]);
        }

        $result = [];
        foreach ($pivot as $catName => $monthlyData) {
            $labels  = [];
            $actuals = [];
            for ($i = 0; $i < $months; $i++) {
                $key       = $start->copy()->addMonths($i)->format('Y-m');
                $labels[]  = $key;
                $actuals[] = $monthlyData[$key] ?? 0.0;
            }

            [$m, $b, $r2] = $this->fitLR($actuals);

            $series = [];
            foreach ($actuals as $idx => $val) {
                $series[] = [
                    'month'  => Carbon::createFromFormat('Y-m', $labels[$idx])->format('M Y'),
                    'actual' => round($val, 1),
                    'trend'  => round(max(0, $m * $idx + $b), 1),
                ];
            }
            for ($i = 1; $i <= 2; $i++) {
                $idx      = $months - 1 + $i;
                $series[] = [
                    'month'  => Carbon::now()->startOfMonth()->addMonths($i)->format('M Y'),
                    'actual' => null,
                    'trend'  => round(max(0, $m * $idx + $b), 1),
                ];
            }

            $total = array_sum($actuals);
            $result[] = [
                'category'       => $catName,
                'total'          => round($total, 1),
                'avg_monthly'    => $months > 0 ? round($total / $months, 1) : 0,
                'trend_direction'=> $m > 0.5 ? 'up' : ($m < -0.5 ? 'down' : 'stable'),
                'model'          => ['slope' => round($m, 3), 'intercept' => round($b, 2), 'r2' => $r2],
                'series'         => $series,
            ];
        }

        // Sort by total consumption descending
        usort($result, fn($a, $b) => $b['total'] <=> $a['total']);

        return response()->json($result);
    }

    /**
     * Current stock summary: counts by status + low/out-of-stock item list.
     *
     * GET /reports/analytics/inventory-stock
     */
    public function inventoryStockSummary(): JsonResponse
    {
        $items = Inventory::with('inventoryCategory')
            ->select('id', 'item_name', 'stock_level', 'min_stock_level',
                     'inventory_category_id', 'selling_price', 'supplier')
            ->get();

        $inStock    = 0;
        $lowStock   = 0;
        $outOfStock = 0;
        $alertItems = [];

        foreach ($items as $item) {
            $stock = (int) $item->stock_level;
            $min   = (int) $item->min_stock_level;

            if ($stock <= 0) {
                $outOfStock++;
                $alertItems[] = [
                    'id'         => $item->id,
                    'name'       => $item->item_name,
                    'category'   => $item->inventoryCategory?->name ?? 'Uncategorized',
                    'stock'      => $stock,
                    'min_stock'  => $min,
                    'deficit'    => $min + 1,
                    'status'     => 'out_of_stock',
                    'supplier'   => $item->supplier,
                ];
            } elseif ($stock <= $min) {
                $lowStock++;
                $alertItems[] = [
                    'id'         => $item->id,
                    'name'       => $item->item_name,
                    'category'   => $item->inventoryCategory?->name ?? 'Uncategorized',
                    'stock'      => $stock,
                    'min_stock'  => $min,
                    'deficit'    => max(0, $min - $stock + 1),
                    'status'     => 'low_stock',
                    'supplier'   => $item->supplier,
                ];
            } else {
                $inStock++;
            }
        }

        // Sort: out_of_stock first, then by deficit descending
        usort($alertItems, fn($a, $b) => $b['deficit'] <=> $a['deficit']);

        return response()->json([
            'summary' => [
                'total'       => $items->count(),
                'in_stock'    => $inStock,
                'low_stock'   => $lowStock,
                'out_of_stock'=> $outOfStock,
            ],
            'alert_items' => $alertItems,
        ]);
    }
}

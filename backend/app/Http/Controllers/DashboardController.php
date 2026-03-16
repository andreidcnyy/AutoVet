<?php

namespace App\Http\Controllers;

use App\Models\Invoice;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    /**
     * Get AI Sales Forecast using Simple Linear Regression.
     */
    public function getSalesForecast(Request $request)
    {
        $monthsToFetch = $request->query('range', 6) == 'Year' ? 12 : 6;
        $futureMonths = 2; // Predict next 2 months

        // Generate the last N months and next 2 months for the timeline
        $timeline = [];
        $now = Carbon::now()->startOfMonth();
        
        $startMonth = $now->copy()->subMonths($monthsToFetch - 1);
        
        for ($i = 0; $i < $monthsToFetch; $i++) {
            $timeline[] = [
                'date' => $startMonth->copy()->addMonths($i),
                'is_future' => false
            ];
        }
        
        for ($i = 1; $i <= $futureMonths; $i++) {
            $timeline[] = [
                'date' => $now->copy()->addMonths($i),
                'is_future' => true
            ];
        }

        // Fetch actual revenue data grouped by month
        $invoices = Invoice::where('status', '!=', 'Cancelled')
            ->where('created_at', '>=', $startMonth)
            ->select(
                DB::raw('YEAR(created_at) as year'),
                DB::raw('MONTH(created_at) as month'),
                DB::raw('SUM(total) as total_revenue')
            )
            ->groupBy('year', 'month')
            ->orderBy('year')
            ->orderBy('month')
            ->get();

        $actualData = [];
        foreach ($invoices as $inv) {
            $key = $inv->year . '-' . str_pad($inv->month, 2, '0', STR_PAD_LEFT);
            $actualData[$key] = (float) $inv->total_revenue;
        }

        // Prepare data for Linear Regression
        $xValues = [];
        $yValues = [];
        $n = 0;

        foreach ($timeline as $index => $item) {
            if (!$item['is_future']) {
                $key = $item['date']->format('Y-m');
                $revenue = $actualData[$key] ?? 0;
                
                $xValues[] = $index;
                $yValues[] = $revenue;
                $n++;
            }
        }

        // Simple Linear Regression: y = mx + b
        // m = (N * Sum(xy) - Sum(x) * Sum(y)) / (N * Sum(x^2) - Sum(x)^2)
        // b = (Sum(y) - m * Sum(x)) / N
        $sumX = array_sum($xValues);
        $sumY = array_sum($yValues);
        
        $sumXY = 0;
        $sumX2 = 0;
        
        for ($i = 0; $i < $n; $i++) {
            $sumXY += ($xValues[$i] * $yValues[$i]);
            $sumX2 += ($xValues[$i] * $xValues[$i]);
        }

        $denominator = ($n * $sumX2) - ($sumX * $sumX);
        
        // If denominator is 0 (e.g., only 1 data point), m = 0
        $m = ($denominator != 0) ? (($n * $sumXY) - ($sumX * $sumY)) / $denominator : 0;
        $b = ($n != 0) ? ($sumY - ($m * $sumX)) / $n : 0;

        // Construct final data structure
        $results = [];
        
        foreach ($timeline as $index => $item) {
            $key = $item['date']->format('Y-m');
            $monthLabel = $item['date']->format('M');
            
            $forecastValue = ($m * $index) + $b;
            // Ensure forecast is not negative
            if ($forecastValue < 0) {
                $forecastValue = 0;
            }

            if ($item['is_future']) {
                $results[] = [
                    'month' => $monthLabel,
                    'actual' => null,
                    'forecast' => round($forecastValue, 2)
                ];
            } else {
                $results[] = [
                    'month' => $monthLabel,
                    'actual' => $actualData[$key] ?? 0,
                    'forecast' => round($forecastValue, 2)
                ];
            }
        }

        return response()->json($results);
    }
}

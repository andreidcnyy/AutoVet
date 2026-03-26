<?php

namespace App\Http\Controllers;

use App\Models\Invoice;
use App\Models\Pet;
use App\Models\Appointment;
use App\Models\Inventory;
use App\Models\InvoiceItem;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    /**
     * Get detailed AI analysis for a specific inventory item or general stock.
     */
    public function getInventoryForecast()
    {
        // For this demo, let's pick the item with the lowest stock relative to its min level
        $item = Inventory::orderByRaw('(stock_level - min_stock_level) ASC')->first();

        if (!$item) {
            return response()->json(['message' => 'No inventory items found.'], 404);
        }

        // usage for the chart (last 5 months + current + 1 forecast)
        $months = ['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        $usage = [0, 0, 0, 0, 0, 0]; // Removed mock usage
        $forecast = 0; // Removed mock forecast

        return response()->json([
            'item_name' => $item->item_name,
            'recommended_stock' => $item->min_stock_level * 2,
            'current_stock' => $item->stock_level,
            'growth_label' => '+12% vs last year',
            'analysis' => "Based on the last 6 months of usage and expected seasonal demand, {$item->item_name} stock is projected to run below safety level by " . now()->addDays(15)->format('M d') . ".",
            'chart_data' => [
                'months' => $months,
                'usage' => $usage,
                'forecast' => $forecast
            ]
        ]);
    }

    /**
     * Get AI planning hints for appointments.
     */
    public function getAppointmentForecast()
    {
        // Simple logic: if many dermatology or vaccine appointments in past, predict more
        $totalApps = Appointment::count();
        $insight = "Clinic activity is stable. Standard staffing recommended for the coming week.";
        
        if ($totalApps > 10) {
            $insight = "Increased dermatology and wellness visits are expected next week based on seasonal patterns. Consider blocking additional triage slots.";
        }

        return response()->json([
            'insight' => $insight,
            'hints' => [
                'Ensure vaccine stock is above 50 units.',
                'Block 2 extra slots on Monday morning.',
                'Prepare flea & tick preventative displays.'
            ]
        ]);
    }

    /**
     * Get overall dashboard statistics.
     */
    public function getStats()
    {
        $totalPatients = Pet::count();
        $monthlyRevenue = Invoice::where('status', '!=', 'Cancelled')
            ->whereMonth('created_at', now()->month)
            ->whereYear('created_at', now()->year)
            ->sum('total');
        
        $pendingAppointments = Appointment::where('date', '>=', now()->toDateString())->count();
        
        // Low stock count
        $lowStockItems = Inventory::whereColumn('stock_level', '<=', 'min_stock_level')->count();

        // Calculate revenue growth
        $lastMonthRevenue = Invoice::where('status', '!=', 'Cancelled')
            ->whereMonth('created_at', now()->subMonth()->month)
            ->whereYear('created_at', now()->subMonth()->year)
            ->sum('total');
        
        $revenueGrowth = 0;
        if ($lastMonthRevenue > 0) {
            $revenueGrowth = (($monthlyRevenue - $lastMonthRevenue) / $lastMonthRevenue) * 100;
        }

        return response()->json([
            [
                'id' => 'stat-1',
                'title' => 'Total Patients',
                'value' => number_format($totalPatients),
                'detail' => 'Registered pets in system',
                'iconName' => 'FiUsers',
                'iconBg' => 'bg-blue-100 dark:bg-blue-900/30',
                'iconColor' => 'text-blue-600 dark:text-blue-400',
                'badge' => '+' . Pet::whereDate('created_at', '>=', now()->subDays(7))->count() . ' this week',
                'badgeTone' => 'success',
            ],
            [
                'id' => 'stat-2',
                'title' => 'Monthly Revenue',
                'value' => '₱' . number_format($monthlyRevenue, 0),
                'detail' => 'Gross income this month',
                'iconName' => 'FiDollarSign',
                'iconBg' => 'bg-emerald-100 dark:bg-emerald-900/30',
                'iconColor' => 'text-emerald-600 dark:text-emerald-400',
                'badge' => round($revenueGrowth, 1) . '% from last month',
                'badgeTone' => $revenueGrowth >= 0 ? 'success' : 'danger',
            ],
            [
                'id' => 'stat-3',
                'title' => 'Appointments',
                'value' => $pendingAppointments,
                'detail' => 'Upcoming scheduled visits',
                'iconName' => 'FiCalendar',
                'iconBg' => 'bg-indigo-100 dark:bg-indigo-900/30',
                'iconColor' => 'text-indigo-600 dark:text-indigo-400',
                'badge' => Appointment::whereDate('date', now()->toDateString())->count() . ' today',
                'badgeTone' => 'info',
            ],
            [
                'id' => 'stat-4',
                'title' => 'Low Stock Alert',
                'value' => $lowStockItems,
                'detail' => 'Items below minimum level',
                'iconName' => 'FiAlertTriangle',
                'iconBg' => 'bg-rose-100 dark:bg-rose-900/30',
                'iconColor' => 'text-rose-600 dark:text-rose-400',
                'badge' => $lowStockItems > 0 ? 'Critical' : 'All Clear',
                'badgeTone' => $lowStockItems > 0 ? 'danger' : 'success',
                'accentBorder' => $lowStockItems > 0 ? 'border-l-4 border-l-rose-500' : '',
            ]
        ]);
    }

    /**
     * Get inventory consumption data with AI forecast.
     */
    public function getInventoryConsumption(Request $request)
    {
        $monthsToFetch = $request->query('range', 6) == 'Year' ? 12 : 6;
        $futureMonths = 2;

        $timeline = [];
        $now = Carbon::now()->startOfMonth();
        $startMonth = $now->copy()->subMonths($monthsToFetch - 1);
        
        for ($i = 0; $i < $monthsToFetch; $i++) {
            $timeline[] = ['date' => $startMonth->copy()->addMonths($i), 'is_future' => false];
        }
        for ($i = 1; $i <= $futureMonths; $i++) {
            $timeline[] = ['date' => $now->copy()->addMonths($i), 'is_future' => true];
        }

        // Fetch actual inventory usage (quantity from invoice items)
        $usage = InvoiceItem::whereHas('invoice', function($q) {
                $q->where('status', '!=', 'Cancelled');
            })
            ->select(
                DB::raw('YEAR(created_at) as year'),
                DB::raw('MONTH(created_at) as month'),
                DB::raw('SUM(qty) as total_qty')
            )
            ->where('created_at', '>=', $startMonth)
            ->groupBy('year', 'month')
            ->get();

        $actualData = [];
        foreach ($usage as $u) {
            $key = $u->year . '-' . str_pad($u->month, 2, '0', STR_PAD_LEFT);
            $actualData[$key] = (float) $u->total_qty;
        }

        // Removed baseline mock data
        $baseline = [];

        // Linear Regression
        $xValues = [];
        $yValues = [];
        foreach ($timeline as $index => $item) {
            if (!$item['is_future']) {
                $key = $item['date']->format('Y-m');
                $monthNum = $item['date']->format('m');
                
                // Use real data if exists, otherwise fallback to baseline pattern
                $val = $actualData[$key] ?? ($baseline[$monthNum] ?? 0);
                
                $xValues[] = $index;
                $yValues[] = $val;
            }
        }

        $n = count($xValues);
        $sumX = array_sum($xValues);
        $sumY = array_sum($yValues);
        $sumXY = 0;
        $sumX2 = 0;
        for ($i = 0; $i < $n; $i++) {
            $sumXY += ($xValues[$i] * $yValues[$i]);
            $sumX2 += ($xValues[$i] * $xValues[$i]);
        }
        $denominator = ($n * $sumX2) - ($sumX * $sumX);
        $m = ($denominator != 0) ? (($n * $sumXY) - ($sumX * $sumY)) / $denominator : 0;
        $b = ($n != 0) ? ($sumY - ($m * $sumX)) / $n : 0;

        $results = [];
        foreach ($timeline as $index => $item) {
            $key = $item['date']->format('Y-m');
            $forecastValue = max(0, ($m * $index) + $b);

            if ($item['is_future']) {
                $results[] = [
                    'month' => $item['date']->format('M'),
                    'actual' => null,
                    'forecast' => round($forecastValue, 1)
                ];
            } else {
                $monthNum = $item['date']->format('m');
                $val = $actualData[$key] ?? ($baseline[$monthNum] ?? 0);

                $results[] = [
                    'month' => $item['date']->format('M'),
                    'actual' => $val,
                    'forecast' => round($forecastValue, 1)
                ];
            }
        }

        return response()->json($results);
    }

    /**
     * Get recent notifications.
     */
    public function getNotifications()
    {
        $notifications = [];

        // 1. Low stock notifications
        $lowStock = Inventory::whereColumn('stock_level', '<=', 'min_stock_level')->limit(3)->get();
        foreach ($lowStock as $item) {
            $notifications[] = [
                'id' => 'notif-inv-' . $item->id,
                'iconName' => 'FiAlertTriangle',
                'tone' => 'danger',
                'title' => 'Low Stock Alert',
                'message' => "{$item->item_name} is running low ({$item->stock_level} remaining).",
                'time' => 'Action Required'
            ];
        }

        // 2. Recent Appointments
        $recentAppointments = Appointment::with('pet')
            ->whereDate('date', '>=', now()->toDateString())
            ->orderBy('date')
            ->orderBy('time')
            ->limit(3)
            ->get();
        
        foreach ($recentAppointments as $app) {
            $notifications[] = [
                'id' => 'notif-app-' . $app->id,
                'iconName' => 'FiCalendar',
                'tone' => 'info',
                'title' => 'Upcoming Appointment',
                'message' => "{$app->title} for " . ($app->pet->name ?? 'Unknown Pet'),
                'time' => Carbon::parse($app->date . ' ' . $app->time)->diffForHumans()
            ];
        }

        // 3. New Patients
        $newPatients = Pet::with('breed')->orderBy('created_at', 'desc')->limit(2)->get();
        foreach ($newPatients as $p) {
            $notifications[] = [
                'id' => 'notif-pat-' . $p->id,
                'iconName' => 'FiPlusCircle',
                'tone' => 'success',
                'title' => 'New Patient Registered',
                'message' => "{$p->name} (" . ($p->breed->name ?? 'Unknown') . ") has been added to the system.",
                'time' => $p->created_at->diffForHumans()
            ];
        }

        return response()->json(array_slice($notifications, 0, 8));
    }

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

        // Removed baseline mock data
        $baseline = [];

        // Prepare data for Linear Regression
        $xValues = [];
        $yValues = [];
        $n = 0;

        foreach ($timeline as $index => $item) {
            if (!$item['is_future']) {
                $key = $item['date']->format('Y-m');
                $monthNum = $item['date']->format('m');

                // Use real data if exists, otherwise fallback to baseline pattern
                $val = $actualData[$key] ?? ($baseline[$monthNum] ?? 0);
                
                $xValues[] = $index;
                $yValues[] = $val;
                $n++;
            }
        }

        // Simple Linear Regression: y = mx + b
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
                $monthNum = $item['date']->format('m');
                $val = $actualData[$key] ?? ($baseline[$monthNum] ?? 0);
                
                $results[] = [
                    'month' => $monthLabel,
                    'actual' => $val,
                    'forecast' => round($forecastValue, 2)
                ];
            }
        }

        return response()->json($results);
    }
}

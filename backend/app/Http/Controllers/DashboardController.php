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
        $item = Inventory::orderByRaw('(stock_level - min_stock_level) ASC')->first();

        if (!$item) {
            return response()->json(['message' => 'No inventory items found.'], 404);
        }

        $monthsToFetch = 6;
        $timeline = [];
        $now = Carbon::now()->startOfMonth();
        $startMonth = $now->copy()->subMonths($monthsToFetch - 1);
        
        for ($i = 0; $i < $monthsToFetch; $i++) {
            $timeline[] = ['date' => $startMonth->copy()->addMonths($i)];
        }

        $usageRecords = InvoiceItem::whereHas('invoice', function($q) {
                $q->whereIn('status', ['Finalized', 'Paid', 'Partially Paid']);
            })
            ->where('inventory_id', $item->id)
            ->where('created_at', '>=', $startMonth)
            ->select(
                DB::raw('YEAR(created_at) as year'),
                DB::raw('MONTH(created_at) as month'),
                DB::raw('SUM(qty) as total_qty')
            )
            ->groupBy('year', 'month')
            ->get();

        $actualData = [];
        foreach ($usageRecords as $u) {
            $key = $u->year . '-' . str_pad($u->month, 2, '0', STR_PAD_LEFT);
            $actualData[$key] = (float) $u->total_qty;
        }

        $months = [];
        $usage = [];
        
        $xValues = [];
        $yValues = [];

        foreach ($timeline as $index => $t) {
            $key = $t['date']->format('Y-m');
            $months[] = $t['date']->format('M');
            
            $val = $actualData[$key] ?? 0;
            $usage[] = $val;
            
            $xValues[] = $index;
            $yValues[] = $val;
        }

        // Simple Linear Regression
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

        $forecast = max(0, round(($m * $n) + $b, 1));
        $months[] = $now->copy()->addMonths(1)->format('M');

        $growth = 0;
        if (count($usage) >= 2) {
            $lastIndex = count($usage) - 1;
            $prev = $usage[$lastIndex - 1];
            $curr = $usage[$lastIndex];
            if ($prev > 0) {
                $growth = (($curr - $prev) / $prev) * 100;
            }
        }
        $growthLabel = ($growth >= 0 ? '+' : '') . round($growth, 1) . '% vs last month';

        $stockoutWarning = '';
        if ($item->stock_level < $forecast && $forecast > 0) {
            $daysLeft = max(1, round(($item->stock_level / $forecast) * 30));
            $stockoutWarning = " Based on the next month's forecasted usage of {$forecast} units, {$item->item_name} is projected to run out in approximately {$daysLeft} days.";
        } else {
            $stockoutWarning = " Current stock level is sufficient to meet the forecasted usage of {$forecast} units for next month.";
        }

        return response()->json([
            'item_name' => $item->item_name,
            'recommended_stock' => $item->min_stock_level * 2,
            'current_stock' => $item->stock_level,
            'growth_label' => $growthLabel,
            'analysis' => "Analyzed the last 6 months of sales data." . $stockoutWarning,
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
        $lastWeekCount = Appointment::whereBetween('date', [now()->subDays(7)->toDateString(), now()->toDateString()])->count();
        $nextWeekCount = Appointment::whereBetween('date', [now()->addDay()->toDateString(), now()->addDays(8)->toDateString()])->count();
        $totalApps = Appointment::count();

        $insight = "Clinic appointment volume is stable. Standard operations recommended for the coming week.";
        $hints = [];

        if ($nextWeekCount > $lastWeekCount * 1.2) {
            $insight = "A " . round((($nextWeekCount - $lastWeekCount) / max(1, $lastWeekCount)) * 100) . "% increase in appointments is expected next week compared to the last 7 days.";
            $hints[] = "Consider scheduling additional staff or extending hours.";
        } elseif ($nextWeekCount < $lastWeekCount * 0.8) {
            $insight = "Upcoming scheduled appointments are lower than usual. Consider sending reminder campaigns to clients.";
            $hints[] = "Great time to perform facility maintenance or staff training.";
        } else {
            $hints[] = "Maintain standard staffing levels.";
        }

        // Check if there are many overdue followups
        $overdueFollowups = \App\Models\MedicalRecord::whereNotNull('follow_up_date')
            ->where('follow_up_date', '<', now()->toDateString())
            ->count();
        if ($overdueFollowups > 5) {
            $hints[] = "There are {$overdueFollowups} overdue patient follow-ups. Assign staff to call owners.";
        }

        // Low inventory check again for hints
        $lowStock = Inventory::whereColumn('stock_level', '<=', 'min_stock_level')->count();
        if ($lowStock > 0) {
            $hints[] = "Ensure to refill {$lowStock} low-stock items before the busy periods.";
        }

        if (empty($hints)) {
            $hints[] = "No specific warnings. Great job!";
        }

        return response()->json([
            'insight' => $insight,
            'hints' => $hints
        ]);
    }

    /**
     * Get overall dashboard statistics.
     */
    public function getStats()
    {
        $totalPets = Pet::count();
        $totalOwners = \App\Models\Owner::count();
        $monthlyRevenue = Invoice::whereIn('status', ['Finalized', 'Paid', 'Partially Paid'])
            ->whereMonth('created_at', now()->month)
            ->whereYear('created_at', now()->year)
            ->sum('total');
        
        $pendingAppointments = Appointment::where('date', '>=', now()->toDateString())->count();
        
        // Low stock count
        $lowStockItems = Inventory::whereColumn('stock_level', '<=', 'min_stock_level')->count();

        // Calculate revenue growth
        $lastMonthRevenue = Invoice::whereIn('status', ['Finalized', 'Paid', 'Partially Paid'])
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
                'title' => 'Total Pets',
                'value' => number_format($totalPets),
                'detail' => 'Active patients in care',
                'iconName' => 'FiHeart',
                'iconBg' => 'bg-blue-100 dark:bg-blue-900/30',
                'iconColor' => 'text-blue-600 dark:text-blue-400',
                'badge' => '+' . Pet::whereDate('created_at', '>=', now()->subDays(7))->count() . ' this week',
                'badgeTone' => 'success',
            ],
            [
                'id' => 'stat-owners',
                'title' => 'Total Clients',
                'value' => number_format($totalOwners),
                'detail' => 'Registered pet owners',
                'iconName' => 'FiUsers',
                'iconBg' => 'bg-purple-100 dark:bg-purple-900/30',
                'iconColor' => 'text-purple-600 dark:text-purple-400',
                'badge' => '+' . \App\Models\Owner::whereDate('created_at', '>=', now()->subDays(7))->count() . ' this week',
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
                $q->whereIn('status', ['Finalized', 'Paid', 'Partially Paid']);
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
    public function getNotifications(Request $request)
    {
        $query = \App\Models\Notification::whereNull('read_at')->orderBy('created_at', 'desc');
        
        if ($request->user()) {
            $query->where(function ($q) use ($request) {
                $q->whereNull('user_id')->orWhere('user_id', $request->user()->id);
            });
        }

        $dbNotifications = $query->limit(8)->get();
        $notifications = [];

        foreach ($dbNotifications as $notif) {
            $iconName = 'FiBell';
            $tone = 'info';

            if ($notif->type === 'LowStockAlert') {
                $iconName = 'FiAlertTriangle';
                $tone = 'danger';
            } elseif (str_contains($notif->type, 'Patient')) {
                $iconName = 'FiPlusCircle';
                $tone = 'success';
            } elseif (str_contains($notif->type, 'Appointment')) {
                $iconName = 'FiCalendar';
                $tone = 'info';
            }

            $notifications[] = [
                'id' => 'notif-' . $notif->id,
                'db_id' => $notif->id,
                'iconName' => $iconName,
                'tone' => $tone,
                'title' => $notif->title,
                'message' => $notif->message,
                'time' => $notif->created_at->diffForHumans()
            ];
        }

        return response()->json($notifications);
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
        $invoices = Invoice::whereIn('status', ['Finalized', 'Paid', 'Partially Paid'])
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

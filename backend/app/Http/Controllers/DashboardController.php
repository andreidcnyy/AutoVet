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
        $data = \Illuminate\Support\Facades\Cache::remember('dashboard_inventory_forecast', 300, function () {
            $item = Inventory::orderByRaw('(stock_level - min_stock_level) ASC')->first();

            if (!$item) {
                return null;
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

            return [
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
            ];
        });

        if (!$data) {
            return response()->json(['message' => 'No inventory items found.'], 404);
        }
        
        return response()->json($data);
    }


    /**
     * Get AI planning hints for appointments.
     */
    public function getAppointmentForecast()
    {
        return response()->json(\Illuminate\Support\Facades\Cache::remember('dashboard_appointment_forecast', 300, function () {
            // Get last 8 weeks of appointment counts
            $startDate = now()->startOfWeek()->subWeeks(7);
            $counts = \App\Models\Appointment::where('date', '>=', $startDate->toDateString())
                ->select(DB::raw('date'), DB::raw('count(*) as count'))
                ->groupBy('date')
                ->get()
                ->pluck('count', 'date');

            $weeklyData = [];
            for ($i = 7; $i >= 0; $i--) {
                $weekStart = now()->startOfWeek()->subWeeks($i);
                $weekEnd = $weekStart->copy()->endOfWeek();
                
                $count = 0;
                $current = $weekStart->copy();
                while ($current <= $weekEnd) {
                    $count += $counts[$current->toDateString()] ?? 0;
                    $current->addDay();
                }
                $weeklyData[] = $count;
            }

            // Linear Regression on weekly appointment counts (x = week index, y = count)
            $n = count($weeklyData);
            $xValues = range(0, $n - 1);
            $yValues = $weeklyData;
            $sumX = array_sum($xValues);
            $sumY = array_sum($yValues);
            $sumXY = 0; $sumX2 = 0;
            for ($i = 0; $i < $n; $i++) {
                $sumXY += $xValues[$i] * $yValues[$i];
                $sumX2 += $xValues[$i] * $xValues[$i];
            }
            $denom = ($n * $sumX2) - ($sumX * $sumX);
            $m = $denom != 0 ? (($n * $sumXY) - ($sumX * $sumY)) / $denom : 0;
            $b = ($sumY - ($m * $sumX)) / $n;

            // R² for appointment model
            $meanY = $sumY / $n;
            $ssTot = array_sum(array_map(fn($y) => pow($y - $meanY, 2), $yValues));
            $ssRes = 0;
            for ($i = 0; $i < $n; $i++) {
                $ssRes += pow($yValues[$i] - ($m * $xValues[$i] + $b), 2);
            }
            $r2 = $ssTot > 0 ? round(1 - ($ssRes / $ssTot), 4) : 0;

            // Forecast next 2 weeks
            $forecastNext1 = max(0, round($m * $n + $b));
            $forecastNext2 = max(0, round($m * ($n + 1) + $b));

            // Build week labels for chart (last 8 weeks + 2 forecast weeks)
            $weekLabels = [];
            for ($i = 7; $i >= 0; $i--) {
                $weekLabels[] = 'W' . now()->startOfWeek()->subWeeks($i)->format('M d');
            }
            $weekLabels[] = 'Next wk';
            $weekLabels[] = 'Wk +2';

            $chartData = array_merge($weeklyData, [$forecastNext1, $forecastNext2]);

            // Per-day appointment counts for the current + next 7 days (for bar chart)
            $days = [];
            for ($i = 0; $i < 7; $i++) {
                $date = now()->addDays($i);
                $count = $counts[$date->toDateString()] ?? \App\Models\Appointment::whereDate('date', $date->toDateString())->count();
                $days[] = [
                    'label' => $date->format('D'),
                    'date'  => $date->toDateString(),
                    'count' => $count,
                ];
            }

            // Insight text from regression
            $lastWeekCount = $weeklyData[count($weeklyData) - 1];
            $insight = 'Clinic appointment volume is stable. Standard operations recommended.';
            if ($m > 1) {
                $pct = round(($forecastNext1 - max(1, $lastWeekCount)) / max(1, $lastWeekCount) * 100);
                $insight = "Appointments are trending upward. Model projects {$forecastNext1} appointments next week" . ($pct > 0 ? " (+{$pct}% vs this week)." : '.');
            } elseif ($m < -1) {
                $insight = "Appointment volume is trending downward. Consider sending client reminders to fill the schedule.";
            }

            // Hints
            $hints = [];
            if ($forecastNext1 > $lastWeekCount * 1.2) {
                $hints[] = "Consider scheduling additional staff or extending hours next week.";
            }
            $overdueFollowups = \App\Models\MedicalRecord::whereNotNull('follow_up_date')
                ->where('follow_up_date', '<', now()->toDateString())
                ->count();
            if ($overdueFollowups > 0) {
                $hints[] = "There are {$overdueFollowups} overdue patient follow-ups. Assign staff to contact owners.";
            }
            $lowStock = \App\Models\Inventory::whereColumn('stock_level', '<=', 'min_stock_level')->count();
            if ($lowStock > 0) {
                $hints[] = "Refill {$lowStock} low-stock items before busy appointment days.";
            }
            if (empty($hints)) {
                $hints[] = "No critical warnings. Clinic is operating normally.";
            }

            return [
                'insight'         => $insight,
                'hints'           => $hints,
                'model'           => [
                    'slope'            => round($m, 4),
                    'intercept'        => round($b, 4),
                    'r2'               => $r2,
                    'forecast_week_1'  => $forecastNext1,
                    'forecast_week_2'  => $forecastNext2,
                    'algorithm'        => 'Simple Linear Regression',
                ],
                'weekly_chart'    => [
                    'labels' => $weekLabels,
                    'data'   => $chartData,
                ],
                'daily_next7'     => $days,
            ];
        }));
    }


    public function getPatientVisitPredictions()
    {
        return response()->json(\Illuminate\Support\Facades\Cache::remember('dashboard_patient_visit_predictions', 300, function () {
            // Overdue follow-ups: follow_up_date is in the past, load pet + owner
            $overdue = \App\Models\MedicalRecord::with(['pet.owner'])
                ->whereNotNull('follow_up_date')
                ->where('follow_up_date', '<', now()->toDateString())
                ->orderBy('follow_up_date', 'asc')
                ->limit(10)
                ->get();

            // Upcoming follow-ups: follow_up_date within next 30 days
            $upcoming = \App\Models\MedicalRecord::with(['pet.owner'])
                ->whereNotNull('follow_up_date')
                ->whereBetween('follow_up_date', [now()->toDateString(), now()->addDays(30)->toDateString()])
                ->orderBy('follow_up_date', 'asc')
                ->limit(10)
                ->get();

            $formatRecord = function ($record, $tone) {
                $daysAgo = now()->diffInDays($record->follow_up_date, false);
                if ($tone === 'danger') {
                    $statusLabel = abs((int)$daysAgo) . 'd overdue';
                } else {
                    $statusLabel = (int)$daysAgo . 'd away';
                }
                return [
                    'pet'          => $record->pet->name ?? 'Unknown',
                    'owner'        => $record->pet->owner->last_name ?? ($record->pet->owner->name ?? 'Unknown'),
                    'follow_up'    => $record->follow_up_date?->toDateString(),
                    'status_label' => $statusLabel,
                    'tone'         => $tone,
                    'diagnosis'    => $record->diagnosis ?? null,
                ];
            };

            $results = [];
            foreach ($overdue as $r)  { $results[] = $formatRecord($r, 'danger'); }
            foreach ($upcoming as $r) {
                $days = now()->diffInDays($r->follow_up_date, false);
                $tone = $days <= 5 ? 'warning' : ($days <= 14 ? 'info' : 'success');
                $results[] = $formatRecord($r, $tone);
            }

            $totalOverdue = \App\Models\MedicalRecord::whereNotNull('follow_up_date')
                ->where('follow_up_date', '<', now()->toDateString())
                ->count();

            return [
                'patients'      => $results,
                'total_overdue' => $totalOverdue,
                'total_upcoming'=> $upcoming->count(),
                'summary'       => $totalOverdue > 0
                    ? "{$totalOverdue} pets are overdue for follow-up visits."
                    : "No overdue follow-ups. All patients are on schedule.",
            ];
        }));
    }

    /**
     * Get overall dashboard statistics.
     */
    public function getStats()
    {
        return response()->json(\Illuminate\Support\Facades\Cache::remember('dashboard_stats', 300, function () {
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

            return [
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
                    'iconName' => 'FiTrendingUp',
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
            ];
        }));
    }

    /**
     * Get inventory consumption data with AI forecast.
     */
    public function getInventoryConsumption(Request $request)
    {
        $range = $request->query('range', 6);
        return response()->json(\Illuminate\Support\Facades\Cache::remember("dashboard_inventory_consumption_{$range}", 300, function () use ($range) {
            $monthsToFetch = $range == 'Year' ? 12 : 6;
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

            // Linear Regression
            $xValues = [];
            $yValues = [];
            foreach ($timeline as $index => $item) {
                if (!$item['is_future']) {
                    $key = $item['date']->format('Y-m');
                    $val = $actualData[$key] ?? 0;
                    
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
                    $val = $actualData[$key] ?? 0;

                    $results[] = [
                        'month' => $item['date']->format('M'),
                        'actual' => $val,
                        'forecast' => round($forecastValue, 1)
                    ];
                }
            }

            return $results;
        }));
    }


    /**
     * Get recent notifications.
     */
    public function getNotifications(Request $request)
    {
        $userId = $request->user()?->id;
        return response()->json(\Illuminate\Support\Facades\Cache::remember("dashboard_notifications_{$userId}", 60, function () use ($request) {
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

                if ($notif->type === 'LowStockAlert' || $notif->type === 'StockAdjustment') {
                    $iconName = ($notif->type === 'LowStockAlert') ? 'FiAlertTriangle' : 'FiPackage';
                    $tone = ($notif->type === 'LowStockAlert' || (isset($notif->data['quantity']) && $notif->data['quantity'] < 0)) ? 'danger' : 'success';
                    
                    // Fine-tune tone for StockAdjustment based on message if data is not explicit
                    if ($notif->type === 'StockAdjustment') {
                        if (str_contains($notif->message, 'decreased') || str_contains($notif->message, 'deducted')) {
                            $tone = 'danger';
                        } else {
                            $tone = 'success';
                        }
                    }
                } elseif (str_contains($notif->type, 'Patient')) {
                    $iconName = 'FiPlusCircle';
                    $tone = 'success';
                } elseif (str_contains($notif->type, 'Appointment')) {
                    $iconName = 'FiCalendar';
                    if ($notif->type === 'AppointmentPending') $tone = 'info';
                    if ($notif->type === 'AppointmentApproved') $tone = 'success';
                    if ($notif->type === 'AppointmentDeclined') $tone = 'danger';
                } elseif ($notif->type === 'InvoiceFinalized') {
                    $iconName = 'FiFileText';
                    $tone = 'success';
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
            return $notifications;
        }));
    }


    public function markNotificationsRead(Request $request)
    {
        $query = \App\Models\Notification::whereNull('read_at');
        
        if ($request->user()) {
            $query->where(function ($q) use ($request) {
                $q->whereNull('user_id')->orWhere('user_id', $request->user()->id);
            });
        }

        $query->update(['read_at' => now()]);

        return response()->json(['status' => 'success']);
    }

    public function dismissNotification(Request $request, $id)
    {
        // Strip 'notif-' prefix if present
        $dbId = str_replace('notif-', '', $id);
        
        $notification = \App\Models\Notification::where('id', $dbId);
        
        if ($request->user()) {
            $notification->where(function ($q) use ($request) {
                $q->whereNull('user_id')->orWhere('user_id', $request->user()->id);
            });
        }

        $notification->update(['read_at' => now()]);

        return response()->json(['status' => 'success']);
    }

    /**
     * Get AI Sales Forecast using Simple Linear Regression.
     */
    public function getSalesForecast(Request $request)
    {
        $range = $request->query('range', 6);
        return response()->json(\Illuminate\Support\Facades\Cache::remember("dashboard_sales_forecast_{$range}", 300, function () use ($range) {
            $monthsToFetch = $range == 'Year' ? 12 : 6;
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

            // Prepare data for Linear Regression
            $xValues = [];
            $yValues = [];
            $n = 0;

            foreach ($timeline as $index => $item) {
                if (!$item['is_future']) {
                    $key = $item['date']->format('Y-m');
                    $val = $actualData[$key] ?? 0;
                    
                    $xValues[] = $index;
                    $yValues[] = $val;
                    $n++;
                }
            }

            // Not enough data to run regression meaningfully
            if ($n < 2) {
                return [
                    'data' => [],
                    'model' => null,
                    'insights' => [
                        ['type' => 'info', 'text' => 'Not enough invoice data yet to run the forecast model. Record at least 2 months of sales to activate AI forecasting.']
                    ],
                ];
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

            // 1. R² calculation
            $meanY = $n > 0 ? $sumY / $n : 0;
            $ssTot = 0;
            foreach ($yValues as $y) {
                $ssTot += ($y - $meanY) ** 2;
            }
            $ssRes = 0;
            for ($i = 0; $i < $n; $i++) {
                $ssRes += ($yValues[$i] - ($m * $xValues[$i] + $b)) ** 2;
            }
            $r2 = ($ssTot > 0) ? round(1 - ($ssRes / $ssTot), 4) : 0;

            // 2. Standard error for confidence band
            $standardError = ($n > 2) ? round(sqrt($ssRes / ($n - 2)), 2) : 0;
            $confidenceMargin = round($standardError * 1.5, 2);

            // 3. Next month forecast value
            $nextMonthForecast = round(max(0, ($m * $n) + $b), 2);

            // 4. AI Insights array
            $aiInsights = [];
            if ($m > 0) {
                $aiInsights[] = ['type' => 'success', 'text' => "Revenue is growing at +₱" . number_format(round($m), 0) . "/month. The model projects ₱" . number_format($nextMonthForecast, 0) . " next month."];
            } elseif ($m < -1) {
                $aiInsights[] = ['type' => 'warning', 'text' => "Revenue shows a declining trend of ₱" . number_format(abs(round($m)), 0) . "/month. Review pricing or service volume."];
            } else {
                $aiInsights[] = ['type' => 'info', 'text' => "Revenue trend is flat. The model needs more monthly data points to detect a growth direction."];
            }

            if ($r2 >= 0.75) {
                $aiInsights[] = ['type' => 'success', 'text' => "Model confidence is strong (R²=" . $r2 . "). The forecast is based on consistent historical patterns."];
            } elseif ($r2 >= 0.4) {
                $aiInsights[] = ['type' => 'warning', 'text' => "Model confidence is moderate (R²=" . $r2 . "). Forecast accuracy improves with more historical invoice data."];
            } else {
                $aiInsights[] = ['type' => 'warning', 'text' => "Model is still learning (R²=" . $r2 . ")."];
            }

            $lowStock = \App\Models\Inventory::whereColumn('stock_level', '<=', 'min_stock_level')->count();
            if ($lowStock > 0) {
                $aiInsights[] = ['type' => 'danger', 'text' => $lowStock . " inventory items are critically low. Restock before peak appointment days."];
            }

            $overdueFollowups = \App\Models\MedicalRecord::whereNotNull('follow_up_date')->where('follow_up_date', '<', now()->toDateString())->count();
            if ($overdueFollowups > 0) {
                $aiInsights[] = ['type' => 'info', 'text' => $overdueFollowups . " pets are overdue for follow-up visits. Auto-reminders can be sent from the Notifications module."];
            }

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
                    $val = $actualData[$key] ?? 0;
                    
                    $results[] = [
                        'month' => $monthLabel,
                        'actual' => $val,
                        'forecast' => round($forecastValue, 2)
                    ];
                }
            }

            return [
                'data' => $results,
                'model' => [
                    'slope' => round($m, 2),
                    'intercept' => round($b, 2),
                    'r2' => $r2,
                    'standard_error' => $standardError,
                    'confidence_margin' => $confidenceMargin,
                    'training_months' => $n,
                    'next_month_forecast' => $nextMonthForecast,
                    'algorithm' => 'Simple Linear Regression',
                ],
                'insights' => $aiInsights,
            ];
        }));
    }

}

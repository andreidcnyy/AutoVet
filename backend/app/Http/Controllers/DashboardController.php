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
use Illuminate\Support\Facades\Log;

use App\Services\InventoryForecastService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Artisan;

class DashboardController extends Controller
{
    protected $inventoryForecastService;

    public function __construct(InventoryForecastService $inventoryForecastService)
    {
        $this->inventoryForecastService = $inventoryForecastService;
    }

    public function getPortalOverview(Request $request)
    {
        $userId = $request->user()?->id;

        return response()->json(Cache::remember("portal_overview_{$userId}", 60, function () use ($request) {
            $petController = app(\App\Http\Controllers\PetController::class);
            $apptController = app(\App\Http\Controllers\AppointmentController::class);
            
            // Re-use existing controller logic to respect traits and filters
            $pets = $petController->index($request)->original;
            
            $apptRequest = new Request(['upcoming' => true]);
            $apptRequest->setUserResolver(fn() => $request->user());
            $appointments = $apptController->index($apptRequest)->original;
            
            $notifications = $this->getNotifications($request)->original;

            return [
                'pets' => $pets,
                'appointments' => $appointments,
                'notifications' => $notifications,
            ];
        }));
    }

    public function getOverview(Request $request)
    {
        $userId = $request->user()?->id;
        $range = $request->query('range', '6 Months');
        $monthsToFetch = $range == 'Year' ? 12 : 6;

        return response()->json(Cache::remember("dashboard_overview_{$userId}_{$monthsToFetch}", 300, function () use ($request, $range, $monthsToFetch) {
            return [
                'status' => [
                    'message' => 'AutoVet Laravel API is up and running!',
                    'database' => 'connected',
                    'environment' => app()->environment(),
                    'timestamp' => now()->toIso8601String(),
                ],
                'stats' => $this->getStats()->original,
                'salesForecast' => $this->getSalesForecast($request)->original,
                'inventoryConsumption' => $this->getInventoryConsumption($request)->original,
                'notifications' => $this->getNotifications($request)->original,
                'inventoryForecast' => $this->getInventoryForecast()->original,
                'appointmentForecast' => $this->getAppointmentForecast()->original,
            ];
        }));
    }

    /**
     * Get detailed AI analysis for a specific inventory item or general stock.
     */
    public function getInventoryForecast()
    {
        $data = \Illuminate\Support\Facades\Cache::remember('dashboard_inventory_forecast', 3600, function () {
            // Find the most critical inventory item based on highest risk saved forecast
            $savedForecast = \App\Models\InventoryForecast::with('inventory')
                ->orderByRaw("FIELD(forecast_status, 'Critical', 'Reorder Soon', 'Safe', 'Insufficient Data')")
                ->orderBy('days_until_stockout', 'ASC')
                ->first();

            if ($savedForecast && $savedForecast->inventory) {
                $item = $savedForecast->inventory;
                $forecastStatus = $savedForecast->forecast_status;

                $analysisMessage = "AI Insight: " . ($savedForecast->notes ?? "Model indicates a {$forecastStatus} status.");
                if ($savedForecast->prediction_source === 'dataset') {
                    $analysisMessage .= " (Dataset Prediction Active)";
                }

                $growthLabel = "Avg: " . round($savedForecast->average_daily_consumption, 1) . " unit/day";

                return [
                    'item_name' => $item->item_name,
                    'recommended_stock' => $savedForecast->suggested_reorder_quantity ?? ($item->min_stock_level * 2),
                    'current_stock' => $item->stock_level,
                    'growth_label' => $growthLabel,
                    'analysis' => $analysisMessage,
                    'prediction_status' => $savedForecast->prediction_source === 'dataset' ? 'Using dataset-based prediction' : 'Live Sync',
                    'average_daily_consumption' => $savedForecast->average_daily_consumption,
                    'days_until_stockout' => $savedForecast->days_until_stockout,
                    'chart_data' => null // Can be populated if chart is strictly required
                ];
            }

            // Fallback if no forecast exists: pick item with lowest stock
            $item = Inventory::orderByRaw('(stock_level - min_stock_level) ASC')->first();

            if (!$item) {
                return null;
            }

            return [
                'item_name' => $item->item_name,
                'recommended_stock' => $item->min_stock_level * 2,
                'current_stock' => $item->stock_level,
                'growth_label' => 'No Data',
                'analysis' => "No AI forecast records found for this item yet. Record sales to activate.",
                'prediction_status' => 'Insufficient Data',
                'average_daily_consumption' => 0,
                'days_until_stockout' => null,
                'chart_data' => null
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
        return response()->json(\Illuminate\Support\Facades\Cache::remember("dashboard_inventory_consumption_{$range}", 3600, function () use ($range) {
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
            $isDataset = false;

            if ($usage->count() > 0) {
                foreach ($usage as $u) {
                    $key = $u->year . '-' . str_pad($u->month, 2, '0', STR_PAD_LEFT);
                    $actualData[$key] = (float) $u->total_qty;
                }
            } else {
                // Dataset Fallback
                $datasetPath = base_path('storage/datasets/inventory.csv');
                if (file_exists($datasetPath)) {
                    $handle = fopen($datasetPath, 'r');
                    $header = fgetcsv($handle);
                    
                    // Column indices: index 3 is usage_date, index 4 is quantity_used
                    while (($row = fgetcsv($handle)) !== FALSE) {
                        try {
                            $dateStr = $row[3];
                            $qtyUsed = (float)($row[4] ?? 0);
                            
                            // Expected format: DD/MM/YYYY
                            $date = Carbon::createFromFormat('d/m/Y', $dateStr);
                            $key = $date->format('Y-m');
                            
                            if (!isset($actualData[$key])) {
                                $actualData[$key] = 0;
                            }
                            $actualData[$key] += $qtyUsed;
                        } catch (\Exception $e) {
                            continue;
                        }
                    }
                    fclose($handle);
                    
                    // Only flag as dataset if we actually got data
                    if (!empty($actualData)) {
                        $isDataset = true;
                    }
                }
            }

            // Linear Regression
            $xValues = [];
            $yValues = [];
            foreach ($timeline as $index => $item) {
                if (!$item['is_future']) {
                    $key = $item['date']->format('Y-m');
                    // If using dataset, we might need to map to the historical months if the timeline is modern
                    // But usually the dataset contains data for specific years.
                    // If the clinic is "new", the timeline is current months. 
                    // If the dataset is from 2025 and it's 2026, we should probably return the "best fit" from dataset or just the fixed labels.
                    // For the demo, if actualData has keys, we use them.
                    $val = $actualData[$key] ?? 0;
                    
                    // If fallback is on, but the keys don't match the current timeline (e.g. dataset is old),
                    // we pick the "last available" N months from the dataset to show *something* on the chart.
                    if ($isDataset && $val == 0) {
                        // Attempt to find ANY data in the dataset to fill the chart
                        // For demo purposes, we'll map the dataset's available months to the chart's indices
                        $allKeys = array_keys($actualData);
                        sort($allKeys);
                        $targetMonthKey = $allKeys[($index % count($allKeys))] ?? null;
                        if ($targetMonthKey) {
                            $val = $actualData[$targetMonthKey];
                        }
                    }

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

            $results = [
                'data' => [],
                'is_dataset_prediction' => $isDataset,
                'prediction_source' => $isDataset ? 'dataset' : 'live'
            ];

            foreach ($timeline as $index => $item) {
                $key = $item['date']->format('Y-m');
                $forecastValue = max(0, ($m * $index) + $b);

                if ($item['is_future']) {
                    $results['data'][] = [
                        'month' => $item['date']->format('M'),
                        'actual' => null,
                        'forecast' => round($forecastValue, 1)
                    ];
                } else {
                    $val = isset($yValues[$index]) ? $yValues[$index] : 0;

                    $results['data'][] = [
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
                } elseif ($notif->type === 'AiForecastUpdate') {
                    $iconName = 'FiActivity';
                    $status = $notif->data['status'] ?? 'Safe';
                    $tone = ($status === 'Critical') ? 'danger' : (($status === 'Reorder Soon') ? 'warning' : 'info');
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
        $rangeParam = $request->query('range', '6 Months');
        $monthsToFetch = $rangeParam == 'Year' ? 12 : 6;

        return response()->json(\Illuminate\Support\Facades\Cache::remember("dashboard_sales_forecast_{$monthsToFetch}", 3600, function () use ($monthsToFetch) {
            $now = Carbon::now()->startOfMonth();
            $timeline = [];
            
            // Generate historical month slots
            for ($i = ($monthsToFetch - 1); $i >= 0; $i--) {
                $timeline[] = ['date' => $now->copy()->subMonths($i), 'is_future' => false];
            }
            // Generate future forecast slots
            for ($i = 1; $i <= 2; $i++) {
                $timeline[] = ['date' => $now->copy()->addMonths($i), 'is_future' => true];
            }

            $invoices = Invoice::whereIn('status', ['Finalized', 'Paid', 'Partially Paid'])
                ->select(
                    DB::raw('YEAR(created_at) as year'),
                    DB::raw('MONTH(created_at) as month'),
                    DB::raw('SUM(total) as total_revenue')
                )
                ->where('created_at', '>=', $now->copy()->subMonths(12)) // Training window is always up to 12m
                ->groupBy('year', 'month')
                ->orderBy('year')
                ->orderBy('month')
                ->get();

            $actualData = [];
            foreach ($invoices as $inv) {
                $key = $inv->year . '-' . str_pad($inv->month, 2, '0', STR_PAD_LEFT);
                $actualData[$key] = (float) $inv->total_revenue;
            }

            $modelDataPoints = []; 
            foreach ($actualData as $key => $val) {
                if ($val > 0) $modelDataPoints[] = $val;
            }

            $nLiveMonths = count($modelDataPoints);

            // Level 2: Dataset Fallback if live data is insufficient (< 2 months of history)
            if ($nLiveMonths < 2) {
                $datasetResult = $this->inventoryForecastService->runGlobalSalesForecast('storage/datasets/sales.csv', 'revenue', $monthsToFetch);
                
                if ($datasetResult && isset($datasetResult['chart_data'])) {
                    $aiInsights = [
                        ['type' => 'info', 'text' => $datasetResult['trend_description'] ?? "Using dataset-based prediction while clinic history builds."],
                    ];
                    
                    if ($datasetResult['model']['slope'] > 0) {
                        $aiInsights[] = ['type' => 'success', 'text' => "Historical data shows a healthy growth trend of +₱" . number_format($datasetResult['model']['slope'], 0) . "/month."];
                    }

                    Log::info("[AI SALES FORECAST] Fallback used. Source: Dataset. R2: {$datasetResult['model']['r2']} Slope: {$datasetResult['model']['slope']}");
                    
                    return [
                        'data' => $datasetResult['chart_data'],
                        'model' => array_merge($datasetResult['model'], [
                            'algorithm' => 'Historical Regression (Dataset Fallback)',
                            'prediction_source' => 'dataset_fallback',
                            'last_updated' => now()->toDateTimeString(),
                            'ai_predicted_monthly_revenue' => $datasetResult['model']['next_forecast'] ?? 0
                        ]),
                        'insights' => $aiInsights,
                        'is_dataset_prediction' => true,
                        'prediction_source' => 'dataset'
                    ];
                }

                return [
                    'data' => [],
                    'model' => null,
                    'insights' => [['type' => 'info', 'text' => 'Not enough revenue history for forecasting.']]
                ];
            }

            // Level 1: Live Data Regression
            $xValues = [];
            $yValues = [];
            $modelInputRaw = array_values($actualData);
            
            // Slice model input to match requested range if we want the slope to reflect the window
            $slicedModelInput = array_slice($modelInputRaw, -$monthsToFetch);
            $n = count($slicedModelInput);

            for ($i = 0; $i < $n; $i++) {
                $xValues[] = $i;
                $yValues[] = $slicedModelInput[$i];
            }

            $sumX = array_sum($xValues);
            $sumY = array_sum($yValues);
            $sumXY = 0; $sumX2 = 0;
            for ($i = 0; $i < $n; $i++) {
                $sumXY += ($xValues[$i] * $yValues[$i]);
                $sumX2 += ($xValues[$i] * $xValues[$i]);
            }
            $denominator = ($n * $sumX2) - ($sumX * $sumX);
            $m = ($denominator != 0) ? (($n * $sumXY) - ($sumX * $sumY)) / $denominator : 0;
            $b = ($n != 0) ? ($sumY - ($m * $sumX)) / $n : 0;

            $meanY = $n > 0 ? $sumY / $n : 0;
            $ssTot = 0; $ssRes = 0;
            for ($i = 0; $i < $n; $i++) {
                $ssTot += pow($yValues[$i] - $meanY, 2);
                $ssRes += pow($yValues[$i] - ($m * $xValues[$i] + $b), 2);
            }
            $r2 = ($ssTot > 0) ? round(1 - ($ssRes / $ssTot), 4) : 0;

            // Generate results mapping to timeline
            $results = [];
            $startRelIdx = ($n - 1) - ($monthsToFetch - 1);

            foreach ($timeline as $idx => $item) {
                $monthLabel = $item['date']->format('M');
                $key = $item['date']->format('Y-m');
                
                $modelRelIdx = $startRelIdx + $idx;
                $forecastValue = max(0, ($m * $modelRelIdx) + $b);

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

            $aiInsights = [];
            if ($m > 0) {
                $aiInsights[] = ['type' => 'success', 'text' => "Live trends show an upward movement of +₱" . number_format(round($m), 0) . " per month."];
            } else if ($m < -100) {
                $aiInsights[] = ['type' => 'warning', 'text' => "Revenue shows a slight declining trend of ₱" . number_format(abs(round($m)), 0) . "/month."];
            } else {
                $aiInsights[] = ['type' => 'info', 'text' => "Revenue is stable based on the selected period."];
            }

            Log::info("[AI SALES FORECAST] Live data used (Range: {$monthsToFetch}m). R2: {$r2} Slope: {$m}");

            $aiPredictedMonthlyRevenue = \App\Models\InventoryForecast::join('inventories', 'inventory_forecasts.inventory_id', '=', 'inventories.id')
                ->select(\Illuminate\Support\Facades\DB::raw('SUM(inventory_forecasts.average_daily_consumption * inventories.selling_price * 30) as predicted_revenue'))
                ->value('predicted_revenue') ?? 0;

            return [
                'data' => $results,
                'model' => [
                    'slope' => round($m, 2),
                    'intercept' => round($b, 2),
                    'r2' => $r2,
                    'algorithm' => 'Linear Regression (Live)',
                    'prediction_source' => 'live',
                    'last_updated' => now()->toDateTimeString(),
                    'training_months' => $n,
                    'ai_predicted_monthly_revenue' => round($aiPredictedMonthlyRevenue, 2),
                    'next_month_forecast' => round(($m * $n) + $b, 2),
                    'config_range' => $monthsToFetch
                ],
                'insights' => $aiInsights,
                'is_dataset_prediction' => false,
                'prediction_source' => 'live'
            ];
        }));
    }

    /**
     * Trigger a synchronous AI forecast refresh for all applicable inventory items.
     * This iterates through items with a 'code' and runs the forecasting engine.
     */
    /**
     * Trigger a background AI forecast refresh for all applicable inventory items.
     * This dispatches a batch job to handle analysis asynchronously.
     */
    public function runForecastSync(): JsonResponse
    {
        try {
            $inventoryIds = Inventory::whereNotNull('code')->pluck('id')->toArray();
            
            if (empty($inventoryIds)) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'No inventory items with valid codes found for AI analysis.'
                ], 400);
            }

            // Dispatch background job
            \App\Jobs\RefreshInventoryForecast::dispatch($inventoryIds, 'dashboard_sync');

            return response()->json([
                'status' => 'success',
                'message' => 'AI Batch Forecast started in background. The dashboard will update as processing continues.',
                'total_items' => count($inventoryIds)
            ]);

        } catch (\Throwable $e) {
            Log::error("[AI-CONTROLLER-ERROR] Failed to dispatch sync forecast: " . $e->getMessage());

            return response()->json([
                'status' => 'error',
                'message' => 'Failed to initiate AI analysis.',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Return the current background forecast batch status for frontend polling.
     */
    public function getForecastStatus(): JsonResponse
    {
        $status = \Illuminate\Support\Facades\Cache::get('forecast_batch_status');
        
        return response()->json($status ?: [
            'is_running' => false,
            'message' => 'No active analysis in progress.',
            'percent' => 0
        ]);
    }

}

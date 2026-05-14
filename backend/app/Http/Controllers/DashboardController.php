<?php

namespace App\Http\Controllers;

use App\Models\Invoice;
use App\Models\Pet;
use App\Models\Appointment;
use App\Models\Inventory;
use App\Models\InvoiceItem;
use App\Models\Service;
use App\Models\Owner;
use Illuminate\Support\Facades\Cache;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use App\Services\InventoryForecastService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Artisan;
use App\Traits\IdentifiesPortalOwner;
use App\Models\ClientNotification;

class DashboardController extends Controller
{
    use IdentifiesPortalOwner;

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
            // Fetch 16 weeks for training; chart displays the most recent 8
            $startDate = now()->startOfWeek()->subWeeks(15);
            $counts = \App\Models\Appointment::where('date', '>=', $startDate->toDateString())
                ->select(DB::raw('date'), DB::raw('count(*) as count'))
                ->groupBy('date')
                ->get()
                ->pluck('count', 'date');

            $allWeeklyData = [];
            for ($i = 15; $i >= 0; $i--) {
                $weekStart = now()->startOfWeek()->subWeeks($i);
                $weekEnd = $weekStart->copy()->endOfWeek();
                $count = 0;
                $current = $weekStart->copy();
                while ($current <= $weekEnd) {
                    $count += $counts[$current->toDateString()] ?? 0;
                    $current->addDay();
                }
                $allWeeklyData[] = $count;
            }

            // Last 8 weeks used for chart display and insight text
            $weeklyData = array_slice($allWeeklyData, -8);

            // Linear regression helper: returns [slope, intercept, r2]
            $fitLR = function(array $x, array $y): array {
                $n = count($x);
                $sumX = array_sum($x); $sumY = array_sum($y);
                $sumXY = 0; $sumX2 = 0;
                for ($i = 0; $i < $n; $i++) {
                    $sumXY += $x[$i] * $y[$i];
                    $sumX2 += $x[$i] * $x[$i];
                }
                $denom = ($n * $sumX2) - ($sumX * $sumX);
                $m = $denom != 0 ? (($n * $sumXY) - ($sumX * $sumY)) / $denom : 0;
                $b = ($sumY - ($m * $sumX)) / $n;
                $meanY = $n > 0 ? $sumY / $n : 0;
                $ssTot = array_sum(array_map(fn($yi) => pow($yi - $meanY, 2), $y));
                $ssRes = 0;
                for ($i = 0; $i < $n; $i++) {
                    $ssRes += pow($y[$i] - ($m * $x[$i] + $b), 2);
                }
                $r2 = $ssTot > 0 ? round(1 - ($ssRes / $ssTot), 4) : 0.0;
                return [$m, $b, $r2];
            };

            // 80/20 holdout: eval model scored on hidden 20%; production model trains on 100%
            $n = count($allWeeklyData);
            $xValues = range(0, $n - 1);
            $yValues = $allWeeklyData;

            $_MIN_SPLIT = 10;
            if ($n >= $_MIN_SPLIT) {
                $split = (int)floor($n * 0.8);
                $xTrain = array_slice($xValues, 0, $split);
                $yTrain = array_slice($yValues, 0, $split);
                $xTest  = array_slice($xValues, $split);
                $yTest  = array_slice($yValues, $split);

                [$evalM, $evalB] = $fitLR($xTrain, $yTrain);

                // Score eval model on held-out test weeks
                $meanYTest = array_sum($yTest) / count($yTest);
                $ssTotTest = array_sum(array_map(fn($yi) => pow($yi - $meanYTest, 2), $yTest));
                $ssResTest = 0;
                foreach ($xTest as $idx => $xi) {
                    $ssResTest += pow($yTest[$idx] - ($evalM * $xi + $evalB), 2);
                }
                $testR2 = $ssTotTest > 0 ? round(1 - ($ssResTest / $ssTotTest), 4) : 0.0;
                $validationMethod = '80/20 holdout';

                [$m, $b, $r2] = $fitLR($xValues, $yValues);
            } else {
                [$m, $b, $r2] = $fitLR($xValues, $yValues);
                $testR2 = null;
                $validationMethod = 'in-sample (insufficient data for split)';
            }

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

            // AI Intelligence Progress (Threshold: 3 weeks with data)
            $weeksWithData = count(array_filter($weeklyData, fn($val) => $val > 0));
            $progressPercent = min(100, round(($weeksWithData / 3) * 100));
            $needed = max(0, 3 - $weeksWithData);

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
                'ai_intelligence_progress' => $progressPercent,
                'message' => $progressPercent < 100 
                    ? "AI Intelligence: {$progressPercent}% — Need {$needed} more week" . ($needed > 1 ? 's' : '') . " of data for live projection."
                    : "AI Analysis Active.",
                'model'           => [
                    'slope'             => round($m, 4),
                    'intercept'         => round($b, 4),
                    'r2'                => $r2,
                    'test_r2'           => $testR2,
                    'validation_method' => $validationMethod,
                    'forecast_week_1'   => $forecastNext1,
                    'forecast_week_2'   => $forecastNext2,
                    'algorithm'         => 'Simple Linear Regression',
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
        // No cache for real-time data accuracy
        $tz = 'Asia/Manila';
        $totalPets = Pet::count();
        
        $totalOwners = \App\Models\Owner::count();

        $today = \Carbon\Carbon::now($tz)->toDateString();
        $tomorrow = \Carbon\Carbon::now($tz)->addDay()->toDateString();

        // Unified Confirmed Statuses (Confirmed Appointments)
        // USER REQUEST: Only show APPROVED status for today.
        $confirmedStatuses = ['Approved', 'approved'];
        
        $apptsToday = Appointment::whereDate('date', $today)
            ->whereIn('status', $confirmedStatuses)
            ->whereHas('pet.owner', fn($q) => $q->realClients())
            ->count();

        $apptsUpcoming = Appointment::whereDate('date', $tomorrow)
            ->whereIn('status', $confirmedStatuses)
            ->whereHas('pet.owner', fn($q) => $q->realClients())
            ->count();

        $cancelledDeclined = Appointment::whereDate('date', $today)
            ->whereIn('status', ['cancelled', 'declined', 'Cancelled', 'Declined', 'Declined (System)', 'Rejected'])
            ->whereHas('pet.owner', fn($q) => $q->realClients())
            ->count();

        return response()->json([
            [
                'id' => 'stat-pets',
                'title' => 'Total Pets',
                'value' => number_format($totalPets),
                'detail' => 'Active patients',
                'iconName' => 'FiHeart',
                'iconBg' => 'bg-blue-100 dark:bg-blue-900/30',
                'iconColor' => 'text-blue-600 dark:text-blue-400',
            ],
            [
                'id' => 'stat-owners',
                'title' => 'Total Clients',
                'value' => number_format($totalOwners),
                'detail' => 'Registered owners',
                'iconName' => 'FiUsers',
                'iconBg' => 'bg-purple-100 dark:bg-purple-900/30',
                'iconColor' => 'text-purple-600 dark:text-purple-400',
            ],
            [
                'id' => 'stat-appts-today',
                'title' => 'Appointments Today',
                'value' => $apptsToday,
                'detail' => 'Confirmed for ' . \Carbon\Carbon::now($tz)->format('M d'),
                'iconName' => 'FiCalendar',
                'iconBg' => 'bg-emerald-100 dark:bg-emerald-900/30',
                'iconColor' => 'text-emerald-600 dark:text-emerald-400',
            ],
            [
                'id' => 'stat-appts-upcoming',
                'title' => "Appointments Tomorrow",
                'value' => $apptsUpcoming,
                'detail' => 'Confirmed for ' . \Carbon\Carbon::now($tz)->addDay()->format('M d'),
                'iconName' => 'FiClock',
                'iconBg' => 'bg-indigo-100 dark:bg-indigo-900/30',
                'iconColor' => 'text-indigo-600 dark:text-indigo-400',
            ],
            [
                'id' => 'stat-cancelled',
                'title' => 'Cancelled / Declined',
                'value' => $cancelledDeclined,
                'detail' => 'Inactive for ' . \Carbon\Carbon::now($tz)->format('M d'),
                'iconName' => 'FiXCircle',
                'iconBg' => 'bg-rose-100 dark:bg-rose-900/30',
                'iconColor' => 'text-rose-600 dark:text-rose-400',
            ]
        ]);
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
        $user = $request->user();
        if (!$user) return response()->json([]);
        
        $userId = $user->id;
        $showAll = $request->query('all') === '1';
        $cacheKey = "dashboard_notifications_{$userId}" . ($showAll ? "_all" : "");

        return response()->json(\Illuminate\Support\Facades\Cache::remember($cacheKey, 60, function () use ($request, $user, $showAll) {
            if ($user->isOwner()) {
                $ownerId = $this->getPortalOwnerId();
                if (!$ownerId) return [];

                $notifications = [];

                // 1. Fetch from ClientNotification
                $query = ClientNotification::where('owner_id', $ownerId);
                if (!$showAll) {
                    $query->whereNull('read_at');
                }
                
                $dbNotifications = $query->latest()->limit($showAll ? 50 : 8)->get();

                foreach ($dbNotifications as $notif) {
                    $iconName = 'FiBell';
                    $tone = 'info';

                    $titleLower = strtolower($notif->title);
                    if (str_contains($titleLower, 'approved')) {
                        $iconName = 'FiCheckCircle';
                        $tone = 'success';
                    } elseif (str_contains($titleLower, 'declined') || str_contains($titleLower, 'cancelled')) {
                        $iconName = 'FiAlertCircle';
                        $tone = 'danger';
                    } elseif (str_contains($titleLower, 'invoice')) {
                        $iconName = 'FiFileText';
                        $tone = 'success';
                    } elseif (str_contains($titleLower, 'reminder')) {
                        $iconName = 'FiClock';
                        $tone = 'warning';
                    }

                    $notifications[] = [
                        'id' => 'notif-' . $notif->id,
                        'db_id' => $notif->id,
                        'iconName' => $iconName,
                        'tone' => $tone,
                        'title' => $notif->title,
                        'message' => $notif->message,
                        'read_at' => $notif->read_at,
                        'time' => $notif->created_at->diffForHumans(),
                        'created_at' => $notif->created_at->toDateTimeString()
                    ];
                }

                if (!$showAll) {
                    // 2. Virtual: Overdue follow-ups
                    $overdueFollowups = \App\Models\MedicalRecord::whereHas('pet', function($q) use ($ownerId) {
                            $q->where('owner_id', $ownerId);
                        })
                        ->whereNotNull('follow_up_date')
                        ->where('follow_up_date', '<', now()->toDateString())
                        ->with('pet')
                        ->get();
                    
                    foreach ($overdueFollowups as $record) {
                        $notifications[] = [
                            'id' => 'followup-' . $record->id,
                            'db_id' => $record->id,
                            'iconName' => 'FiPlusCircle',
                            'tone' => 'danger',
                            'title' => 'Follow-up Overdue',
                            'message' => "{$record->pet->name} is overdue for a follow-up visit (since " . $record->follow_up_date->format('M d') . ").",
                            'time' => $record->follow_up_date->diffForHumans(),
                            'created_at' => $record->follow_up_date->toDateTimeString()
                        ];
                    }
                }

                // Sort by created_at desc
                usort($notifications, function($a, $b) {
                    return strcmp($b['created_at'], $a['created_at']);
                });

                return array_slice($notifications, 0, $showAll ? 50 : 8);
            }

            // Admin Logic
            $query = \App\Models\Notification::orderBy('created_at', 'desc');
            
            if (!$showAll) {
                $query->whereNull('read_at');
            }

            // Super admins only see notifications addressed to them directly;
            // clinic-level broadcasts (user_id = NULL) belong to clinic admins.
            if ($user->role === 'super_admin') {
                $query->where('user_id', $user->id);
            } else {
                $query->where(function ($q) use ($user) {
                    $q->whereNull('user_id')->orWhere('user_id', $user->id);
                });
            }

            $dbNotifications = $query->limit($showAll ? 50 : 8)->get();
            $notifications = [];

            foreach ($dbNotifications as $notif) {
                $iconName = 'FiBell';
                $tone = 'info';

                if ($notif->type === 'LowStockAlert' || $notif->type === 'StockAdjustment') {
                    $iconName = ($notif->type === 'LowStockAlert') ? 'FiAlertTriangle' : 'FiPackage';
                    $tone = ($notif->type === 'LowStockAlert' || (isset($notif->data['quantity']) && $notif->data['quantity'] < 0)) ? 'danger' : 'success';
                    
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
                    'read_at' => $notif->read_at,
                    'time' => $notif->created_at->diffForHumans(),
                    'created_at' => $notif->created_at->toDateTimeString()
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
        try {
            // Strip 'notif-' prefix if present
            $dbId = str_replace('notif-', '', $id);
            
            $notification = \App\Models\Notification::where('id', $dbId);
            
            if ($request->user()) {
                $notification->where(function ($q) use ($request) {
                    $q->whereNull('user_id')->orWhere('user_id', $request->user()->id);
                });
            }

            $notification->update(['read_at' => now()]);
            
            // Clear cache
            if ($request->user()) {
                \Illuminate\Support\Facades\Cache::forget("dashboard_notifications_{$request->user()->id}");
            }

            return response()->json(['status' => 'success']);
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error("Failed to dismiss notification: " . $e->getMessage());
            return response()->json(['error' => 'Internal Server Error', 'details' => $e->getMessage()], 500);
        }
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
    /**
     * Mark all notifications as read for the authenticated admin.
     */
    public function markAllRead()
    {
        try {
            $userId = auth()->id();
            if (!$userId) return response()->json(['error' => 'Unauthorized'], 401);

            \Illuminate\Support\Facades\DB::table('notifications')
                ->where(function($q) use ($userId) {
                    $q->where('user_id', $userId)->orWhereNull('user_id');
                })
                ->whereNull('read_at')
                ->update(['read_at' => now()]);
            
            // Clear caches
            \Illuminate\Support\Facades\Cache::forget("dashboard_notifications_{$userId}");
            \Illuminate\Support\Facades\Cache::forget("dashboard_notifications_{$userId}_all");

            return response()->json(['message' => 'All notifications marked as read.']);
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error("Failed to mark notifications as read: " . $e->getMessage());
            return response()->json(['error' => 'Internal Server Error', 'details' => $e->getMessage()], 500);
        }
    }

    /**
     * Clear all notifications (Mark as Read) for the authenticated admin.
     */
    public function clearAll()
    {
        try {
            $userId = auth()->id();
            if (!$userId) return response()->json(['error' => 'Unauthorized'], 401);

            // Mark both personal and system alerts as read
            \Illuminate\Support\Facades\DB::table('notifications')
                ->where(function($q) use ($userId) {
                    $q->where('user_id', $userId)->orWhereNull('user_id');
                })
                ->whereNull('read_at')
                ->update(['read_at' => now()]);

            // Clear caches
            \Illuminate\Support\Facades\Cache::forget("dashboard_notifications_{$userId}");
            \Illuminate\Support\Facades\Cache::forget("dashboard_notifications_{$userId}_all");

            return response()->json(['message' => 'Notifications cleared from dashboard. History preserved.']);
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error("Failed to clear notifications: " . $e->getMessage());
            return response()->json(['error' => 'Internal Server Error', 'details' => $e->getMessage()], 500);
        }
    }

    public function appointmentsToday(Request $request): JsonResponse
    {
        $tz = 'Asia/Manila';
        $today = \Carbon\Carbon::now($tz)->toDateString();
        $perPage = $request->query('per_page', 10);
        // USER REQUEST: Only show APPROVED status for today
        $confirmedStatuses = ['Approved', 'approved'];

        $appointments = Appointment::with(['pet.owner', 'service'])
            ->whereDate('date', $today)
            ->whereIn('status', $confirmedStatuses)
            ->whereHas('pet.owner', function($q) {
                $q->realClients();
            })
            ->orderBy('time', 'asc')
            ->paginate($perPage);

        $items = collect($appointments->items())->map(fn($a) => [
            'id'          => $a->id,
            'time'        => Carbon::parse($a->time)->format('h:i A'),
            'pet_name'    => optional($a->pet)->name        ?? 'N/A',
            'owner_name'  => optional($a->pet?->owner)->name ?? 'N/A',
            'service'     => optional($a->service)->name    ?? 'N/A',
            'category'    => optional($a->service)->category ?? 'N/A',
            'status'      => $a->status,
        ]);

        return response()->json([
            'label'        => 'Appointments Today',
            'date'         => \Carbon\Carbon::now($tz)->format('F d, Y'),
            'count'        => $appointments->total(),
            'appointments' => $items,
            'pagination'   => [
                'current_page' => $appointments->currentPage(),
                'last_page'    => $appointments->lastPage(),
                'per_page'     => $appointments->perPage(),
                'total'        => $appointments->total(),
            ],
        ]);
    }

    public function appointmentsUpcoming(Request $request): JsonResponse
    {
        $tz = 'Asia/Manila';
        $tomorrow = \Carbon\Carbon::now($tz)->addDay()->toDateString();
        $perPage = $request->query('per_page', 10);
        // USER REQUEST: Only show APPROVED status for tomorrow
        $confirmedStatuses = ['Approved', 'approved'];

        $appointments = Appointment::with(['pet.owner', 'service'])
            ->whereDate('date', $tomorrow)
            ->whereIn('status', $confirmedStatuses)
            ->whereHas('pet.owner', function($q) {
                $q->realClients();
            })
            ->orderBy('date', 'asc')
            ->orderBy('time', 'asc')
            ->paginate($perPage);

        $items = collect($appointments->items())->map(fn($a) => [
            'id'         => $a->id,
            'date'       => Carbon::parse($a->date)->format('M d, Y'),
            'time'       => Carbon::parse($a->time)->format('h:i A'),
            'pet_name'   => optional($a->pet)->name    ?? 'N/A',
            'owner_name' => optional($a->pet?->owner)->name  ?? 'N/A',
            'service'    => optional($a->service)->name    ?? 'N/A',
            'category'   => optional($a->service)->category ?? 'N/A',
            'status'     => $a->status,
        ]);

        return response()->json([
            'label'        => 'Appointments Tomorrow',
            'date'         => \Carbon\Carbon::now($tz)->addDay()->format('F d, Y'),
            'count'        => $appointments->total(),
            'appointments' => $items,
            'pagination'   => [
                'current_page' => $appointments->currentPage(),
                'last_page'    => $appointments->lastPage(),
                'per_page'     => $appointments->perPage(),
                'total'        => $appointments->total(),
            ],
        ]);
    }

    public function petsList(Request $request): JsonResponse
    {
        $perPage = $request->query('per_page', 10);
        $pets = Pet::with(['owner', 'species', 'breed'])
            ->whereHas('owner', function($q) {
                $q->where('email', '!=', 'dataset.seeder@autovet.ai');
            })
            ->orderBy('name', 'asc')
            ->paginate($perPage);

        $items = collect($pets->items())->map(fn($p) => [
            'id'         => $p->id,
            'name'       => $p->name,
            'species'    => optional($p->species)->name ?? 'N/A',
            'breed'      => optional($p->breed)->name   ?? 'N/A',
            'owner_name' => optional($p->owner)->name   ?? 'N/A',
        ]);

        return response()->json([
            'label' => 'Total Pets',
            'count' => $pets->total(),
            'pets'  => $items,
            'pagination'   => [
                'current_page' => $pets->currentPage(),
                'last_page'    => $pets->lastPage(),
                'per_page'     => $pets->perPage(),
                'total'        => $pets->total(),
            ],
        ]);
    }

    public function clientsList(Request $request): JsonResponse
    {
        $perPage = $request->query('per_page', 10);
        $clients = Owner::withCount('pets')
            ->where('email', '!=', 'dataset.seeder@autovet.ai')
            ->orderBy('name', 'asc')
            ->paginate($perPage);

        $items = collect($clients->items())->map(fn($o) => [
            'id'        => $o->id,
            'name'      => $o->name,
            'email'     => $o->email    ?? 'N/A',
            'phone'     => $o->phone    ?? 'N/A',
            'pet_count' => $o->pets_count,
        ]);

        return response()->json([
            'label'   => 'Total Clients',
            'count'   => $clients->total(),
            'clients' => $items,
            'pagination'   => [
                'current_page' => $clients->currentPage(),
                'last_page'    => $clients->lastPage(),
                'per_page'     => $clients->perPage(),
                'total'        => $clients->total(),
            ],
        ]);
    }

    public function appointmentsCancelled(Request $request): JsonResponse
    {
        $tz = 'Asia/Manila';
        $today = \Carbon\Carbon::now($tz)->toDateString();
        $perPage = $request->query('per_page', 10);
        $cancelledDeclinedStatuses = ['cancelled', 'declined', 'Cancelled', 'Declined', 'Declined (System)', 'Rejected'];

        $appointments = Appointment::with(['pet.owner', 'service'])
            ->whereDate('date', $today)
            ->whereIn('status', $cancelledDeclinedStatuses)
            ->whereHas('pet.owner', function($q) {
                $q->where('email', '!=', 'dataset.seeder@autovet.ai');
            })
            ->orderBy('updated_at', 'desc')
            ->paginate($perPage);

        $items = collect($appointments->items())->map(fn($a) => [
            'id'             => $a->id,
            'date'           => Carbon::parse($a->date)->format('M d, Y'),
            'time'           => $a->time ? Carbon::parse($a->time)->format('h:i A') : 'N/A',
            'pet_name'       => optional($a->pet)->name   ?? 'N/A',
            'owner_name'     => optional($a->pet?->owner)->name ?? 'N/A',
            'service'        => optional($a->service)->name ?? 'N/A',
            'status'         => $a->status,
            'decline_reason' => $a->notes ?? null,
        ]);

        return response()->json([
            'label'        => 'Cancelled / Declined',
            'date'         => \Carbon\Carbon::now($tz)->format('F d, Y'),
            'count'        => $appointments->total(),
            'appointments' => $items,
            'pagination'   => [
                'current_page' => $appointments->currentPage(),
                'last_page'    => $appointments->lastPage(),
                'per_page'     => $appointments->perPage(),
                'total'        => $appointments->total(),
            ],
        ]);
    }

    public function getForecastStatus(): JsonResponse
    {
        $status = \Illuminate\Support\Facades\Cache::get('forecast_batch_status');
        
        return response()->json($status ?: [
            'is_running' => false,
            'message' => 'No active analysis in progress.',
            'percent' => 0
        ]);
    }


    /**
     * Monthly new client (owner) registrations — last 12 months.
     * Falls back to the 12 months around the oldest registration if none are recent.
     */
    public function getMonthlyClients(): JsonResponse
    {
        $months = 12;
        $start = Carbon::now()->startOfMonth()->subMonths($months - 1);

        $rows = Owner::where('created_at', '>=', $start)
            ->select(
                DB::raw("DATE_FORMAT(created_at, '%Y-%m') as month"),
                DB::raw('COUNT(*) as total')
            )
            ->groupBy('month')
            ->orderBy('month')
            ->pluck('total', 'month');

        $hasData = $rows->sum() > 0;

        if (!$hasData) {
            // Fallback: use the actual date range of owner registrations
            $oldest = Owner::min('created_at');
            if ($oldest) {
                $start = Carbon::parse($oldest)->startOfMonth();
                $rows = Owner::where('created_at', '>=', $start)
                    ->select(
                        DB::raw("DATE_FORMAT(created_at, '%Y-%m') as month"),
                        DB::raw('COUNT(*) as total')
                    )
                    ->groupBy('month')
                    ->orderBy('month')
                    ->pluck('total', 'month');
                $months = $rows->count() > 0 ? min($rows->count(), 12) : 12;
                $keys = $rows->keys()->toArray();
                if (count($keys) >= 1) {
                    $start = Carbon::createFromFormat('Y-m', $keys[0]);
                }
            }
        }

        $series = [];
        for ($i = 0; $i < $months; $i++) {
            $key = $start->copy()->addMonths($i)->format('Y-m');
            $series[] = [
                'month' => Carbon::createFromFormat('Y-m', $key)->format('M Y'),
                'total' => (int) ($rows[$key] ?? 0),
            ];
        }

        return response()->json($series);
    }

    /**
     * Total items used per inventory category.
     * Primary: inventory_usage_history. Fallback: invoice_items from finalized invoices.
     */
    public function getItemsByCategory(): JsonResponse
    {
        $data = DB::table('inventory_usage_history')
            ->join('inventories', 'inventory_usage_history.inventory_id', '=', 'inventories.id')
            ->leftJoin('mdm_inventory_categories', 'inventories.inventory_category_id', '=', 'mdm_inventory_categories.id')
            ->select(
                DB::raw("COALESCE(mdm_inventory_categories.name, 'Uncategorized') as category"),
                DB::raw('SUM(inventory_usage_history.quantity_used) as total_qty')
            )
            ->groupBy('category')
            ->orderByDesc('total_qty')
            ->get();

        if ($data->isNotEmpty()) {
            return response()->json($data);
        }

        // Fallback: derive from invoice_items when usage history is not yet populated
        $fallback = DB::table('invoice_items')
            ->join('invoices', 'invoice_items.invoice_id', '=', 'invoices.id')
            ->join('inventories', 'invoice_items.inventory_id', '=', 'inventories.id')
            ->leftJoin('mdm_inventory_categories', 'inventories.inventory_category_id', '=', 'mdm_inventory_categories.id')
            ->whereIn('invoices.status', ['Finalized', 'Paid', 'Partially Paid'])
            ->whereNotNull('invoice_items.inventory_id')
            ->select(
                DB::raw("COALESCE(mdm_inventory_categories.name, 'Uncategorized') as category"),
                DB::raw('SUM(invoice_items.qty) as total_qty')
            )
            ->groupBy('category')
            ->orderByDesc('total_qty')
            ->get();

        return response()->json($fallback);
    }
}
<?php

namespace App\Services;

use App\Models\Inventory;
use App\Models\InventoryForecast;
use App\Models\InventoryUsageHistory;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Process;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Cache;
use App\Traits\HasInternalNotifications;

class InventoryForecastService
{
    use HasInternalNotifications;
    /**
     * Generate a forecast on-demand (returns array, does NOT persist).
     * Used by the dashboard/API for live reads.
     */
    public function getStockoutForecast(int $inventoryId, int $historyDays = 30, string $triggerSource = 'manual'): array
    {
        $inventory = Inventory::find($inventoryId);

        if (!$inventory) {
            return ['error' => 'Inventory item not found.'];
        }

        $insufficientDataResponse = [
            'prediction_status' => 'Insufficient Data',
            'message'           => 'Not enough sales history. At least 3 verified usage records are needed to generate a forecast.',
            'current_stock'     => $inventory->stock_level,
            'min_stock_level'   => $inventory->min_stock_level,
            'item_name'         => $inventory->item_name,
        ];

        // Require at least 3 verified sale rows (forecasting-safe sources only)
        $usageCount = InventoryUsageHistory::forecastingSafe()
            ->where('inventory_id', $inventoryId)
            ->count();
            
        if ($usageCount < 3) {
            // FALLBACK 1: Active dataset check
            $datasetPath = base_path('storage/datasets/inventory.csv');
            if (file_exists($datasetPath)) {
                $result = $this->runPythonForecast($inventory, $historyDays, $datasetPath);
                
                // If Python found data in the CSV, return it as "Dataset Prediction"
                if ($result && isset($result['prediction_status']) && $result['prediction_status'] !== 'Insufficient Data' && $result['prediction_status'] !== 'No Data') {
                    $result['prediction_status'] = 'Using dataset-based prediction';
                    $result['message']           = "This prediction is generated from the historical dataset provided for your system defense.";
                    $this->saveForecast($inventoryId, $result, $triggerSource);
                    return $result;
                }
            }

            // FALLBACK 2: Check if a saved forecast exists from a previous dataset sync
            $saved = $this->getLatestSavedForecast($inventoryId);
            if ($saved) {
                return [
                    'prediction_status' => 'Synced Dataset Insight',
                    'forecast_status'   => $saved->forecast_status ?: 'Safe',
                    'message'           => "Based on the latest synchronized dataset.",
                    'current_stock'     => $inventory->stock_level,
                    'min_stock_level'   => $inventory->min_stock_level,
                    'item_name'         => $inventory->item_name,
                    'days_until_stockout' => $saved->days_until_stockout ?? 0,
                    'predicted_stockout_date' => $saved->predicted_stockout_date ? $saved->predicted_stockout_date->format('Y-m-d') : null,
                    'average_daily_consumption' => $saved->average_daily_consumption ?? 0,
                    'predicted_daily_sales' => $saved->predicted_daily_sales ?? 0,
                    'predicted_weekly_sales' => $saved->predicted_weekly_sales ?? 0,
                    'predicted_monthly_sales' => $saved->predicted_monthly_sales ?? 0,
                    'last_recorded_date' => $saved->generated_at->format('Y-m-d H:i'),
                ];
            }
            return $insufficientDataResponse;
        }

        $result = $this->runPythonForecast($inventory, $historyDays);
        if ($result && !isset($result['error']) && ($result['prediction_status'] ?? '') !== 'Insufficient Data') {
            $this->saveForecast($inventoryId, $result, $triggerSource);
            return $result;
        }

        // Live data returned Insufficient Data (e.g. few unique daily points) — try dataset fallback
        Log::info("[FORECAST FALLBACK] Inventory ID {$inventoryId}: live data insufficient, trying dataset CSV.");

        $datasetPath = base_path('storage/datasets/inventory.csv');
        if (file_exists($datasetPath)) {
            $datasetResult = $this->runPythonForecast($inventory, $historyDays, $datasetPath);
            if ($datasetResult && isset($datasetResult['prediction_status'])
                && $datasetResult['prediction_status'] !== 'Insufficient Data'
                && $datasetResult['prediction_status'] !== 'No Data'
                && !isset($datasetResult['error'])
            ) {
                $datasetResult['prediction_status'] = 'Using dataset-based prediction';
                $datasetResult['message']           = 'Prediction generated from historical dataset (live data has too few daily movement points).';
                $this->saveForecast($inventoryId, $datasetResult, $triggerSource);
                Log::info("[FORECAST FALLBACK SUCCESS] Inventory ID {$inventoryId}: dataset fallback returned result.");
                return $datasetResult;
            }
            Log::info("[FORECAST FALLBACK MISS] Inventory ID {$inventoryId}: dataset also insufficient.");
        }

        return $insufficientDataResponse;
    }

    /**
     * Generate forecast from usage history and persist result to inventory_forecasts.
     * Called by RefreshInventoryForecast job after invoice finalization.
     */
    public function refreshAndSaveForecast(int $inventoryId, int $historyDays = 30, string $triggerSource = 'manual'): void
    {
        $lockKey = "inventory_forecast_lock_{$inventoryId}";
        
        // Prevent overlapping forecast runs for the same item (Part 3.3)
        if (Cache::has($lockKey)) {
            Log::info("InventoryForecastService: Forecast for ID {$inventoryId} is already in progress. Skipping.");
            return;
        }

        Cache::put($lockKey, true, 300); // 5 minute lock

        try {
            $inventory = Inventory::find($inventoryId);
            if (!$inventory) {
                Log::warning("InventoryForecastService: inventory ID {$inventoryId} not found.");
                return;
            }

            $usageCount = InventoryUsageHistory::forecastingSafe()
                ->where('inventory_id', $inventoryId)
                ->count();
                
            if ($usageCount < 3) {
                // FALLBACK: Active dataset check for background jobs
                $datasetPath = base_path('storage/datasets/inventory.csv');
                if (file_exists($datasetPath)) {
                    $result = $this->runPythonForecast($inventory, $historyDays, $datasetPath);
                    if ($result && isset($result['prediction_status']) && $result['prediction_status'] !== 'Insufficient Data' && $result['prediction_status'] !== 'No Data') {
                        $result['prediction_status'] = 'Using dataset-based prediction';
                        $result['message']           = 'Prediction generated from historical dataset fallback.';
                        $this->saveForecast($inventoryId, $result, $triggerSource);
                        Log::info("[FORECAST FALLBACK SUCCESS] Inventory ID {$inventoryId}: Dataset fallback used (usageCount < 3).");
                        return;
                    }
                }

                Log::info("[FORECAST STATUS] Inventory ID {$inventoryId} has insufficient history and no matching dataset. Marking as Insufficient Data.");
                $this->saveForecast($inventoryId, [
                    'prediction_status' => 'Insufficient Data',
                    'forecast_status' => 'Insufficient Data',
                    'message' => 'Not enough sales history (need 3+ records) to generate a reliable AI forecast.'
                ], $triggerSource);
                return;
            }

            Log::info("[FORECAST STARTED] Processing AI model for Inventory ID {$inventoryId} ({$usageCount} records). Trigger: {$triggerSource}");
            $result = $this->runPythonForecast($inventory, $historyDays);

            // Handle unique days < 3 case from Live Python
            if ($result && !isset($result['error']) && ($result['prediction_status'] ?? '') === 'Insufficient Data') {
                Log::info("[FORECAST FALLBACK] Inventory ID {$inventoryId}: live data unique points insufficient, trying dataset CSV.");
                $datasetPath = base_path('storage/datasets/inventory.csv');
                if (file_exists($datasetPath)) {
                    $datasetResult = $this->runPythonForecast($inventory, $historyDays, $datasetPath);
                    if ($datasetResult && isset($datasetResult['prediction_status']) && $datasetResult['prediction_status'] !== 'Insufficient Data' && $datasetResult['prediction_status'] !== 'No Data') {
                        $datasetResult['prediction_status'] = 'Using dataset-based prediction';
                        $datasetResult['message']           = 'Prediction generated from historical dataset fallback (live data too few unique days).';
                        $this->saveForecast($inventoryId, $datasetResult, $triggerSource);
                        Log::info("[FORECAST FALLBACK SUCCESS] Inventory ID {$inventoryId}: Dataset fallback used (live points insufficient).");
                        return;
                    }
                }
            }

            if ($result === null || isset($result['error'])) {
                Log::warning("[FORECAST FAILED] Inventory ID {$inventoryId}: Python script failed or returned null.");
                return;
            }

            $this->saveForecast($inventoryId, $result, $triggerSource);
            Log::info("[FORECAST COMPLETED] Inventory ID {$inventoryId}: results saved.", [
                'days_until_stockout'      => $result['days_until_stockout'] ?? null,
                'predicted_stockout_date'  => $result['predicted_stockout_date'] ?? null,
                'model_used'               => $result['model_used'] ?? 'python_forecast',
                'trigger'                  => $triggerSource
            ]);
        } finally {
            Cache::forget($lockKey);
        }
    }

    /**
     * Persist a forecast result array into inventory_forecasts.
     */
    public function saveForecast(int $inventoryId, array $forecastResult, string $triggerSource = 'manual'): void
    {
        $inventory = Inventory::find($inventoryId);
        $unitPrice = $inventory ? ($inventory->selling_price ?? 0) : 0;
        
        $monthlySales = $forecastResult['predicted_monthly_sales'] ?? 0;
        $estimatedRevenue = $monthlySales * $unitPrice;

        $isDataset = (isset($forecastResult['prediction_status']) && 
                     ($forecastResult['prediction_status'] === 'Using dataset-based prediction' || 
                      strpos($forecastResult['prediction_status'], 'Dataset') !== false));

        InventoryForecast::create([
            'inventory_id'              => $inventoryId,
            'predicted_demand'          => $forecastResult['average_daily_consumption'] ?? null,
            'average_daily_consumption' => $forecastResult['average_daily_consumption'] ?? null,
            'days_until_stockout'       => $forecastResult['days_until_stockout'] ?? null,
            'predicted_stockout_date'   => $forecastResult['predicted_stockout_date'] ?? null,
            'suggested_reorder_quantity' => $forecastResult['suggested_reorder_quantity'] ?? null,
            'forecast_status'           => $forecastResult['forecast_status'] ?? 'Safe',
            'generated_at'              => now(),
            'model_used'                => $forecastResult['model_used'] ?? 'python_forecast',
            'prediction_source'         => $isDataset ? 'dataset' : 'live',
            'trigger_source'            => $triggerSource,
            'notes'                     => $forecastResult['message'] ?? null,
            'predicted_daily_sales'     => $forecastResult['predicted_daily_sales'] ?? null,
            'predicted_weekly_sales'    => $forecastResult['predicted_weekly_sales'] ?? null,
            'predicted_monthly_sales'   => $forecastResult['predicted_monthly_sales'] ?? null,
            'estimated_monthly_revenue' => $estimatedRevenue,
        ]);

        // Generate AI Forecast Notification
        $this->generateAiNotification($inventory, $forecastResult);
    }

    /**
     * Generate a user-friendly AI insight notification.
     */
    protected function generateAiNotification(Inventory $inventory, array $result): void
    {
        $status = $result['forecast_status'] ?? 'Safe';
        $days = $result['days_until_stockout'] ?? null;
        $itemName = $inventory->item_name;
        
        $message = "AI Update: '{$itemName}' is currently stable.";
        
        if ($status === 'Critical') {
            $message = "Critical: '{$itemName}' may run out in " . ($days ?? 'less than 7') . " days. Immediate reorder recommended.";
        } elseif ($status === 'Reorder Soon') {
            $message = "Advisory: '{$itemName}' is depleting. Reorder suggested within " . ($days ?? '14') . " days.";
        }

        if (isset($result['predicted_weekly_sales']) && $result['predicted_weekly_sales'] > 0) {
            $message .= " Weekly sales forecast: ₱" . number_format($result['predicted_weekly_sales'], 2) . ".";
        }

        $this->createInternalNotification(
            'AiForecastUpdate',
            'AI Forecast Update',
            $message,
            [
                'inventory_id' => $inventory->id,
                'status' => $status,
                'days' => $days,
                'predicted_weekly_sales' => $result['predicted_weekly_sales'] ?? 0
            ]
        );
    }

    /**
     * Return the latest saved forecast for an inventory item, or null if none exists.
     */
    public function getLatestSavedForecast(int $inventoryId): ?InventoryForecast
    {
        return InventoryForecast::where('inventory_id', $inventoryId)
            ->orderByDesc('generated_at')
            ->first();
    }

    /**
     * Return all forecast rows for an inventory item, newest first.
     * Supports audit trail / prediction drift analysis.
     *
     * @return \Illuminate\Database\Eloquent\Collection<InventoryForecast>
     */
    public function getForecastHistory(int $inventoryId, int $limit = 20)
    {
        return InventoryForecast::where('inventory_id', $inventoryId)
            ->orderByDesc('generated_at')
            ->limit($limit)
            ->get();
    }

    // -------------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------------

    /**
     * Run the sales_forecast.py script against the global sales dataset for a given code.
     * Returns the sales prediction fields merged into the forecast array, or empty array on failure.
     */
    private function runSalesForecast(string $inventoryCode): array
    {
        $salesCsvPath = base_path('storage/datasets/sales.csv');
        if (!file_exists($salesCsvPath)) {
            Log::warning("InventoryForecastService: sales.csv not found at {$salesCsvPath}.");
            return [];
        }

        $salesScriptPath = base_path('ai/sales_forecast.py');
        if (!file_exists($salesScriptPath)) {
            Log::warning("InventoryForecastService: sales_forecast.py not found at {$salesScriptPath}.");
            return [];
        }

        $pythonExecutable = env('PYTHON_BIN_PATH')
            ?: (strtoupper(substr(PHP_OS, 0, 3)) === 'WIN' ? 'python' : 'python3');

        $command = $pythonExecutable
            . ' ' . escapeshellarg($salesScriptPath)
            . ' ' . escapeshellarg($salesCsvPath)
            . ' ' . escapeshellarg("--code={$inventoryCode}");

        $process = Process::run($command);

        if ($process->failed()) {
            Log::warning("InventoryForecastService: sales_forecast.py failed for code {$inventoryCode}: " . $process->errorOutput());
            return [];
        }

        $result = json_decode($process->output(), true);
        if (json_last_error() !== JSON_ERROR_NONE || isset($result['error'])) {
            Log::warning("InventoryForecastService: sales forecast error for code {$inventoryCode}: " . ($result['error'] ?? json_last_error_msg()));
            return [];
        }

        return [
            'predicted_daily_sales'   => $result['predicted_daily_sales'] ?? null,
            'predicted_weekly_sales'  => $result['predicted_weekly_sales'] ?? null,
            'predicted_monthly_sales' => $result['predicted_monthly_sales'] ?? null,
        ];
    }

    /**
     * Export daily depletion CSV from inventory_usage_history and run Python forecast.
     * Returns parsed forecast array on success, null on failure.
     */
    private function runPythonForecast(Inventory $inventory, int $historyDays, ?string $customCsvPath = null): ?array
    {
        $inventoryId = $inventory->id;
        $csvFilename = "inventory_{$inventoryId}_history_{$historyDays}_days.csv";
        $csvPath     = $customCsvPath ?? Storage::path($csvFilename);

        try {
            if (!$customCsvPath) {
                if (Storage::exists($csvFilename)) {
                    Storage::delete($csvFilename);
                }

                Artisan::call('app:export-inventory-history', [
                    'inventory_id' => $inventoryId,
                    '--days'       => $historyDays,
                ]);

                if (!Storage::exists($csvFilename)) {
                    Log::warning("InventoryForecastService: CSV export produced no file for inventory ID {$inventoryId}.");
                    return null;
                }

                $fileContent = file($csvPath);
                if (!$fileContent || count($fileContent) < 3) {
                    return null; // header + fewer than 2 data rows
                }
            }

            $pythonScriptPath = base_path('ai/forecast.py');
            if (!file_exists($pythonScriptPath)) {
                Log::error("InventoryForecastService: Python forecast script not found at {$pythonScriptPath}.");
                return null;
            }

            $pythonExecutable = env('PYTHON_BIN_PATH')
                ?: (strtoupper(substr(PHP_OS, 0, 3)) === 'WIN' ? 'python' : 'python3');

            $inventoryCode = $inventory->code;
            if (!$inventoryCode) {
                Log::warning("InventoryForecastService: Skipping item ID {$inventoryId} because it has no unique code mapping.");
                return null;
            }

            $minStockLevel = $inventory->min_stock_level ?? 0;
            $command       = $pythonExecutable
                . ' ' . escapeshellarg($pythonScriptPath)
                . ' ' . escapeshellarg($csvPath)
                . ' ' . escapeshellarg($minStockLevel)
                . ' ' . escapeshellarg("--code={$inventoryCode}");

            $process = Process::run($command);

            if ($process->failed()) {
                Log::error("InventoryForecastService: Python script error for inventory ID {$inventoryId}: " . $process->errorOutput());
                return null;
            }

            $forecastResult = json_decode($process->output(), true);
            if (json_last_error() !== JSON_ERROR_NONE) {
                Log::error("InventoryForecastService: JSON decode error for inventory ID {$inventoryId}: " . json_last_error_msg());
                return null;
            }

            // Merge Sales Forecast data
            $salesForecast = $this->runSalesForecast($inventoryCode);
            $forecastResult = array_merge($forecastResult, $salesForecast);

            $forecastResult['item_name']    = $inventory->item_name;
            $forecastResult['inventory_id'] = $inventory->id;

            return $forecastResult;

        } catch (\Throwable $e) {
            Log::error("InventoryForecastService: exception for inventory ID {$inventoryId}: " . $e->getMessage());
            return null;
        } finally {
            if (Storage::exists($csvFilename)) {
                Storage::delete($csvFilename);
            }
        }
    }
}

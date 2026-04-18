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
        try {
            $inventory = Inventory::find($inventoryId);

            if (!$inventory) {
                Log::error("[AI-ERROR] Inventory item not found for ID: {$inventoryId}");
                return ['error' => 'Inventory item not found.'];
            }

            // Pre-validation: Require item code for dataset mapping
            if (!$inventory->code) {
                Log::warning("[AI-VALIDATION] Item '{$inventory->item_name}' (ID: {$inventoryId}) is missing a unique code. Cannot map to AI datasets.");
                return [
                    'prediction_status' => 'Monitoring',
                    'message'           => 'Unique item code missing. Please update the product code to enable AI insights.',
                    'current_stock'     => $inventory->stock_level,
                    'item_name'         => $inventory->item_name,
                ];
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
                        $result['prediction_status'] = 'Using dataset-guided prediction';
                        $result['message']           = "Historical dataset is used to estimate demand behavior. Final stockout date is based on current live stock.";
                        $this->saveForecast($inventoryId, $result, $triggerSource);
                        return $result;
                    }
                }

                // FALLBACK 2: Check if a saved forecast exists from a previous dataset sync
                $saved = $this->getLatestSavedForecast($inventoryId);
                if ($saved && $saved->average_daily_consumption > 0) {
                    $currentStock = $inventory->stock_level;
                    $minStock = $inventory->min_stock_level ?? 0;
                    $avgDaily = $saved->average_daily_consumption;
                    
                    $daysLeft = ($currentStock > $minStock) 
                        ? ceil(($currentStock - $minStock) / $avgDaily) 
                        : 0;
                    
                    $predictedDate = now()->addDays($daysLeft);

                    return [
                        'prediction_status' => 'Synced Dataset Insight',
                        'forecast_status'   => ($daysLeft < 7) ? 'Critical' : (($daysLeft < 14) ? 'Reorder Soon' : 'Safe'),
                        'message'           => "Based on historical average consumption, adjusted for your current stock level.",
                        'current_stock'     => $currentStock,
                        'min_stock_level'   => $minStock,
                        'item_name'         => $inventory->item_name,
                        'days_until_stockout' => $daysLeft,
                        'predicted_stockout_date' => $predictedDate->format('Y-m-d'),
                        'average_daily_consumption' => $avgDaily,
                        'predicted_daily_sales' => $saved->predicted_daily_sales ?? 0,
                        'predicted_weekly_sales' => $saved->predicted_weekly_sales ?? 0,
                        'predicted_monthly_sales' => $saved->predicted_monthly_sales ?? 0,
                        'last_recorded_date' => $saved->generated_at->format('Y-m-d H:i'),
                        'is_live_recalculated' => true
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
            Log::info("[AI-FALLBACK] Inventory ID {$inventoryId}: live data insufficient, trying dataset CSV.");

            $datasetPath = base_path('storage/datasets/inventory.csv');
            if (file_exists($datasetPath)) {
                $datasetResult = $this->runPythonForecast($inventory, $historyDays, $datasetPath);
                if ($datasetResult && isset($datasetResult['prediction_status'])
                    && $datasetResult['prediction_status'] !== 'Insufficient Data'
                    && $datasetResult['prediction_status'] !== 'No Data'
                    && !isset($datasetResult['error'])
                ) {
                    $datasetResult['prediction_status'] = 'Using dataset-guided prediction';
                    $datasetResult['message']           = 'Historical dataset is used to estimate demand behavior (live data has too few daily movement points). Final stockout date is based on current live stock.';
                    $this->saveForecast($inventoryId, $datasetResult, $triggerSource);
                    Log::info("[AI-FALLBACK-SUCCESS] Inventory ID {$inventoryId}: dataset fallback returned result.");
                    return $datasetResult;
                }
                Log::info("[AI-FALLBACK-MISS] Inventory ID {$inventoryId}: dataset also insufficient.");
            }
            // FALLBACK 2: Check if a saved forecast exists from previous runs/syncs
            $saved = $this->getLatestSavedForecast($inventoryId);
            if ($saved && $saved->average_daily_consumption > 0) {
                // Determine days/date relative to LIVE stock
                $currentStock = $inventory->stock_level;
                $minStock = $inventory->min_stock_level ?? 0;
                $avgDaily = $saved->average_daily_consumption;

                $daysLeft = ($currentStock > $minStock) 
                    ? ceil(($currentStock - $minStock) / $avgDaily) 
                    : 0;
                
                $predictedDate = now()->addDays($daysLeft);

                return [
                    'prediction_status' => 'Synced Dataset Insight',
                    'forecast_status'   => ($daysLeft < 7) ? 'Critical' : (($daysLeft < 14) ? 'Reorder Soon' : 'Safe'),
                    'message'           => "Based on the latest synchronized dataset, adjusted for your current stock level.",
                    'current_stock'     => $currentStock,
                    'min_stock_level'   => $minStock,
                    'item_name'         => $inventory->item_name,
                    'days_until_stockout' => $daysLeft,
                    'predicted_stockout_date' => $predictedDate->format('Y-m-d'),
                    'average_daily_consumption' => $avgDaily,
                    'predicted_daily_sales' => $saved->predicted_daily_sales ?? 0,
                    'predicted_weekly_sales' => $saved->predicted_weekly_sales ?? 0,
                    'predicted_monthly_sales' => $saved->predicted_monthly_sales ?? 0,
                    'last_recorded_date' => $saved->generated_at->format('Y-m-d H:i'),
                    'is_live_recalculated' => true
                ];
            }

            return $insufficientDataResponse;
            
        } catch (\Throwable $e) {
            Log::error("[AI-EXCEPTION] Error during live forecast for item {$inventoryId}: " . $e->getMessage());
            return [
                'prediction_status' => 'Monitoring',
                'message' => 'Forecast system is currently analyzing trends. Check back soon.',
                'error' => $e->getMessage()
            ];
        }
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
                Log::warning("[AI-ERROR] Inventory ID {$inventoryId} not found in database.");
                return;
            }

            // Pre-validation: Require item code for background forecast
            if (!$inventory->code) {
                Log::info("[AI-SKIPPED] Item '{$inventory->item_name}' (ID: {$inventoryId}) skipped - needs code mapping.");
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
                        Log::info("[AI-REFRESH-SUCCESS] Inventory ID {$inventoryId}: Dataset fallback used.");
                        return;
                    }
                }

                Log::info("[AI-REFRESH-STATUS] Inventory ID {$inventoryId} insufficient history and no mapping found.");
                $this->saveForecast($inventoryId, [
                    'prediction_status' => 'Insufficient Data',
                    'forecast_status' => 'Insufficient Data',
                    'message' => 'Not enough sales history (need 3+ records) to generate a reliable AI forecast.'
                ], $triggerSource);
                return;
            }

            Log::info("[AI-REFRESH-START] Processing item ID {$inventoryId} ({$usageCount} records).");
            $result = $this->runPythonForecast($inventory, $historyDays);

            // Handle unique days < 3 case from Live Python
            if ($result && !isset($result['error']) && ($result['prediction_status'] ?? '') === 'Insufficient Data') {
                $datasetPath = base_path('storage/datasets/inventory.csv');
                if (file_exists($datasetPath)) {
                    $datasetResult = $this->runPythonForecast($inventory, $historyDays, $datasetPath);
                    if ($datasetResult && isset($datasetResult['prediction_status']) && $datasetResult['prediction_status'] !== 'Insufficient Data' && $datasetResult['prediction_status'] !== 'No Data') {
                        $datasetResult['prediction_status'] = 'Using dataset-guided prediction';
                        $datasetResult['message']           = 'Historical dataset is used to estimate demand behavior.';
                        $this->saveForecast($inventoryId, $datasetResult, $triggerSource);
                        Log::info("[AI-REFRESH-FALLBACK] Inventory ID {$inventoryId}: Dataset fallback used.");
                        return;
                    }
                }
            }

            if ($result === null || isset($result['error'])) {
                Log::warning("[AI-REFRESH-FAILED] Inventory ID {$inventoryId}: Model execution error.");
                return;
            }

            $this->saveForecast($inventoryId, $result, $triggerSource);
        } catch (\Throwable $e) {
            Log::error("[AI-REFRESH-EXCEPTION] Inventory ID {$inventoryId}: " . $e->getMessage());
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
        
        $avgDaily = $forecastResult['average_daily_consumption'] ?? 0;
        $monthlySales = $avgDaily * 30; // Enforce: est_monthly_need corresponds to daily usage rate
        $estimatedRevenue = $monthlySales * $unitPrice;

        $isDataset = (isset($forecastResult['prediction_status']) && 
                     ($forecastResult['prediction_status'] === 'Using dataset-guided prediction' || 
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
             // Use revenue formatting directly since weekly sales in inventory typically means units*price or just units depending on script
            $message .= " Weekly usage rate: " . number_format($result['predicted_weekly_sales'], 2) . " projected.";
        }

        $this->createInternalNotification(
            'AiForecastUpdate',
            'AI Forecast Update',
            $message,
            [
                'inventory_id' => $inventory->id,
                'item_name' => $itemName,
                'status' => $status,
                'days' => $days,
                'average_daily_consumption' => $result['average_daily_consumption'] ?? 0,
                'predicted_weekly_sales' => $result['predicted_weekly_sales'] ?? 0,
                'predicted_monthly_sales' => $result['predicted_monthly_sales'] ?? 0
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
                . ' ' . escapeshellarg("--code={$inventoryCode}")
                . ' ' . escapeshellarg("--current_stock={$inventory->stock_level}")
                . ' ' . escapeshellarg("--history_days={$historyDays}");

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

    /**
     * Run the sales_forecast.py script against a global dataset (e.g. sales.csv)
     */
    public function runGlobalSalesForecast(string $datasetRelativePath, string $mode = 'revenue', int $range = 6): ?array
    {
        $datasetPath = base_path($datasetRelativePath);
        if (!file_exists($datasetPath)) {
            Log::error("InventoryForecastService: Dataset not found for global sales forecast at {$datasetPath}.");
            return null;
        }

        $salesScriptPath = base_path('ai/sales_forecast.py');
        if (!file_exists($salesScriptPath)) {
            Log::error("InventoryForecastService: sales_forecast.py not found at {$salesScriptPath}.");
            return null;
        }

        $pythonExecutable = env('PYTHON_BIN_PATH')
            ?: (strtoupper(substr(PHP_OS, 0, 3)) === 'WIN' ? 'python' : 'python3');

        $command = $pythonExecutable
            . ' ' . escapeshellarg($salesScriptPath)
            . ' ' . escapeshellarg($datasetPath)
            . ' ' . escapeshellarg("--mode={$mode}")
            . ' ' . escapeshellarg("--range={$range}");

        $process = Process::run($command);

        if ($process->failed()) {
            Log::error("InventoryForecastService: Global sales forecast script failed: " . $process->errorOutput());
            return null;
        }

        $result = json_decode($process->output(), true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            Log::error("InventoryForecastService: JSON decode error in global sales forecast: " . json_last_error_msg());
            return null;
        }

        return $result;
    }

    /**
     * Run batch forecast for multiple items in a single process.
     */
    public function runBatchForecast(array $inventoryIds, int $historyDays = 365, string $triggerSource = 'manual'): void
    {
        $batchId = uniqid('forecast_batch_');
        $totalItems = count($inventoryIds);
        $this->updateBatchProgress($batchId, 0, $totalItems, 'Preparing inventory data...');

        try {
            $itemsToProcess = [];
            foreach ($inventoryIds as $id) {
                $inventory = Inventory::find($id);
                if ($inventory && $inventory->code) {
                    $itemsToProcess[] = [
                        'id' => $inventory->id,
                        'code' => $inventory->code,
                        'min_stock_level' => $inventory->min_stock_level,
                        'current_stock' => $inventory->stock_level,
                        'history_days' => $historyDays
                    ];
                }
            }

            if (empty($itemsToProcess)) {
                $this->updateBatchProgress($batchId, 100, 0, 'No items found with valid codes for analysis.');
                return;
            }

            // Write temporary JSON input for Python
            $tempDir = storage_path('app/temp');
            if (!is_dir($tempDir)) {
                mkdir($tempDir, 0755, true);
            }
            
            $inputPath = $tempDir . "/batch_input_{$batchId}.json";
            file_put_contents($inputPath, json_encode($itemsToProcess));

            $this->updateBatchProgress($batchId, 15, $totalItems, 'Executing AI Batch Model...');

            $pythonExecutable = env('PYTHON_BIN_PATH')
                ?: (strtoupper(substr(PHP_OS, 0, 3)) === 'WIN' ? 'python' : 'python3');
            $scriptPath = base_path('ai/batch_forecast.py');
            $datasetPath = base_path('storage/datasets/inventory.csv');

            $command = $pythonExecutable
                . ' ' . escapeshellarg($scriptPath)
                . ' ' . escapeshellarg($datasetPath)
                . ' ' . escapeshellarg($inputPath);

            // Using long timeout for batch process
            $process = Process::path(base_path())->timeout(300)->run($command);

            if ($process->failed()) {
                throw new \Exception("Batch Python script failed: " . $process->errorOutput());
            }

            $allResults = json_decode($process->output(), true);
            if (!$allResults || isset($allResults['error'])) {
                $errorMsg = $allResults['error'] ?? 'Invalid JSON output from AI script.';
                throw new \Exception($errorMsg);
            }

            $this->updateBatchProgress($batchId, 70, $totalItems, 'Syncing results to database...');

            $successCount = 0;
            foreach ($allResults as $inventoryId => $result) {
                if (isset($result['error']) || ($result['prediction_status'] ?? '') === 'Error') {
                    Log::warning("Batch forecast item failure ID {$inventoryId}: " . ($result['error'] ?? 'Unknown error'));
                    continue;
                }
                
                $this->saveForecast((int)$inventoryId, $result, $triggerSource);
                $successCount++;
            }

            // Cleanup
            if (file_exists($inputPath)) {
                @unlink($inputPath);
            }
            
            $this->updateBatchProgress($batchId, 100, $totalItems, "Analysis complete. Updated {$successCount} items.");
            Log::info("[AI-BATCH-SUCCESS] Processed {$totalItems} items, saved {$successCount} results.");

            // Clear relevant caches
            Cache::forget('dashboard_inventory_forecast');
            Cache::forget('dashboard_stats');
            Cache::forget('dashboard_inventory_consumption_6');
            Cache::forget('dashboard_inventory_consumption_12');

        } catch (\Throwable $e) {
            Log::error("[AI-BATCH-ERROR] " . $e->getMessage());
            $this->updateBatchProgress($batchId, 0, $totalItems, 'Error: ' . $e->getMessage());
        }
    }

    /**
     * Update progress status in cache for frontend polling.
     */
    protected function updateBatchProgress(string $batchId, int $percent, int $total, string $message): void
    {
        Cache::put("forecast_batch_status", [
            'batch_id' => $batchId,
            'percent' => $percent,
            'total' => $total,
            'message' => $message,
            'updated_at' => now()->toDateTimeString(),
            'is_running' => $percent < 100 && !str_starts_with($message, 'Error')
        ], 600);
    }
}

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

            // Require at least 3 verified sale rows (forecasting-safe sources only)
            $usageCount = InventoryUsageHistory::forecastingSafe()
                ->where('inventory_id', $inventoryId)
                ->count();
                
            $progressPercent = min(100, round(($usageCount / 3) * 100));
            $needed = max(0, 3 - $usageCount);

            $insufficientDataResponse = [
                'prediction_status' => 'Insufficient Data',
                'ai_intelligence_progress' => $progressPercent,
                'message'           => "AI Intelligence: {$progressPercent}% — Need {$needed} more completed transaction" . ($needed > 1 ? 's' : '') . " to generate a trend.",
                'current_stock'     => $inventory->stock_level,
                'min_stock_level'   => $inventory->min_stock_level,
                'item_name'         => $inventory->item_name,
            ];

            // No dataset fallback when live history is short. We surface
            // "Insufficient Data" honestly instead of substituting CSV-based or
            // last-saved values that look like a real prediction.
            if ($usageCount < 3) {
                return $insufficientDataResponse;
            }

            $result = $this->runPythonForecast($inventory, $historyDays);
            if ($result && !isset($result['error']) && ($result['prediction_status'] ?? '') !== 'Insufficient Data') {
                $this->saveForecast($inventoryId, $result, $triggerSource);
                return $result;
            }

            // No silent dataset retry here. If the live forecast did not produce
            // a usable result, surface "Insufficient Data" honestly so the panel
            // and users see exactly when AI is/isn't running.
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

            $usageCount = InventoryUsageHistory::forecastingSafe()
                ->where('inventory_id', $inventoryId)
                ->count();
                
            if ($usageCount < 3) {
                Log::info("[AI-REFRESH-STATUS] Inventory ID {$inventoryId} insufficient history.");
                $this->saveForecast($inventoryId, [
                    'prediction_status' => 'Insufficient Data',
                    'forecast_status' => 'Insufficient Data',
                    'message' => 'Not enough sales history (need 3+ records) to generate a reliable AI forecast.'
                ], $triggerSource);
                return;
            }

            Log::info("[AI-REFRESH-START] Processing item ID {$inventoryId} ({$usageCount} records).");
            $result = $this->runPythonForecast($inventory, $historyDays);

            if ($result === null || isset($result['error']) || ($result['prediction_status'] ?? '') === 'Insufficient Data') {
                Log::warning("[AI-REFRESH-FAILED] Inventory ID {$inventoryId}: Model execution error or insufficient data.");
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

        $avgDaily = $forecastResult['average_daily_consumption'] ?? 0;

        $isDataset = (isset($forecastResult['prediction_status']) &&
                     ($forecastResult['prediction_status'] === 'Using dataset-guided prediction' ||
                      strpos($forecastResult['prediction_status'], 'Dataset') !== false ||
                      strpos($forecastResult['prediction_status'], 'dataset') !== false));

        InventoryForecast::create([
            'inventory_id'              => $inventoryId,
            'predicted_demand'          => $avgDaily,
            'average_daily_consumption' => $avgDaily,
            'days_until_stockout'       => $forecastResult['days_until_stockout'] ?? null,
            'predicted_stockout_date'   => $forecastResult['predicted_stockout_date'] ?? null,
            'suggested_reorder_quantity' => $forecastResult['suggested_reorder_quantity'] ?? null,
            'forecast_status'           => $forecastResult['forecast_status'] ?? 'Safe',
            'generated_at'              => now(),
            'model_used'                => $forecastResult['model_used'] ?? 'python_forecast',
            'prediction_source'         => $isDataset ? 'dataset' : 'live',
            'trigger_source'            => $triggerSource,
            'notes'                     => $forecastResult['message'] ?? null,
            'trend_fit_score'           => $forecastResult['trend_fit_score'] ?? $forecastResult['confidence_score'] ?? null,
            'confidence_score'          => $forecastResult['confidence_score'] ?? $forecastResult['trend_fit_score'] ?? null,
        ]);

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

            $apiUrl = env('AI_API_URL');
            if ($apiUrl) {
                try {
                    $csvData = file_get_contents($csvPath);
                    $response = \Illuminate\Support\Facades\Http::timeout(90)->post("{$apiUrl}/forecast/inventory", [
                        'min_stock_level' => $inventory->min_stock_level ?? 0,
                        'csv_data' => $csvData,
                        'code' => $inventory->code,
                        'current_stock' => $inventory->stock_level,
                        'history_days' => $historyDays
                    ]);

                    if ($response->successful()) {
                        $forecastResult = $response->json();
                        $forecastResult['item_name']    = $inventory->item_name;
                        $forecastResult['inventory_id'] = $inventory->id;

                        return $forecastResult;
                    }
                } catch (\Exception $e) {
                    Log::error("AI API Inventory Forecast failed: " . $e->getMessage());
                }
            }

            $pythonScriptPath = base_path('ai/forecast.py');
            if (!file_exists($pythonScriptPath)) {
                Log::error("InventoryForecastService: Python forecast script not found at {$pythonScriptPath}.");
                return null;
            }

            $pythonExecutable = env('PYTHON_BIN_PATH')
                ?: (strtoupper(substr(PHP_OS, 0, 3)) === 'WIN' ? 'python' : 'python3');

            $minStockLevel = $inventory->min_stock_level ?? 0;
            $command       = $pythonExecutable
                . ' ' . escapeshellarg($pythonScriptPath)
                . ' ' . escapeshellarg($csvPath)
                . ' ' . escapeshellarg($minStockLevel)
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
                if ($inventory) {
                    $itemsToProcess[] = [
                        'id' => $inventory->id,
                        'code' => $inventory->code ?? $inventory->item_name,
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

            // Export live usage history to a temporary CSV for the batch job
            $batchCsvPath = $tempDir . "/batch_usage_{$batchId}.csv";
            $usageRows = InventoryUsageHistory::forecastingSafe()
                ->whereIn('inventory_id', $inventoryIds)
                ->where('usage_date', '>=', now()->subDays($historyDays)->toDateString())
                ->get(['inventory_id', 'usage_date', 'quantity_used']);

            $f = fopen($batchCsvPath, 'w');
            fputcsv($f, ['id', 'code', 'date', 'quantity_used']);
            
            // Map IDs back to codes for Python filtering
            $idToCode = [];
            foreach ($itemsToProcess as $item) { $idToCode[$item['id']] = $item['code']; }

            foreach ($usageRows as $row) {
                fputcsv($f, [
                    $row->inventory_id,
                    $idToCode[$row->inventory_id] ?? 'UNK',
                    $row->usage_date instanceof \Carbon\Carbon ? $row->usage_date->toDateString() : $row->usage_date,
                    $row->quantity_used
                ]);
            }
            fclose($f);

            $this->updateBatchProgress($batchId, 15, $totalItems, 'Executing AI Batch Model...');

            $pythonExecutable = env('PYTHON_BIN_PATH')
                ?: (strtoupper(substr(PHP_OS, 0, 3)) === 'WIN' ? 'python' : 'python3');
            $scriptPath = base_path('ai/batch_forecast.py');

            $command = $pythonExecutable
                . ' ' . escapeshellarg($scriptPath)
                . ' ' . escapeshellarg($batchCsvPath)
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

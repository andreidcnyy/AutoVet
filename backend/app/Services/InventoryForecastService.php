<?php

namespace App\Services;

use App\Models\Inventory;
use App\Models\InventoryForecast;
use App\Models\InventoryUsageHistory;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Process;
use Illuminate\Support\Facades\Storage;

class InventoryForecastService
{
    /**
     * Generate a forecast on-demand (returns array, does NOT persist).
     * Used by the dashboard/API for live reads.
     */
    public function getStockoutForecast(int $inventoryId, int $historyDays = 30): array
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
            return $insufficientDataResponse;
        }

        return $this->runPythonForecast($inventory, $historyDays) ?? $insufficientDataResponse;
    }

    /**
     * Generate forecast from usage history and persist result to inventory_forecasts.
     * Called by RefreshInventoryForecast job after invoice finalization.
     */
    public function refreshAndSaveForecast(int $inventoryId, int $historyDays = 30): void
    {
        $inventory = Inventory::find($inventoryId);
        if (!$inventory) {
            Log::warning("InventoryForecastService: inventory ID {$inventoryId} not found.");
            return;
        }

        $usageCount = InventoryUsageHistory::forecastingSafe()
            ->where('inventory_id', $inventoryId)
            ->count();
        if ($usageCount < 3) {
            Log::info("InventoryForecastService: insufficient verified usage history for inventory ID {$inventoryId} ({$usageCount} rows), skipping forecast.");
            return;
        }

        $result = $this->runPythonForecast($inventory, $historyDays);
        if ($result === null) {
            Log::warning("[FORECAST FAILED] inventory ID {$inventoryId}: Python forecast returned no result.");
            return;
        }

        $this->saveForecast($inventoryId, $result);
        Log::info("[FORECAST COMPLETED] inventory ID {$inventoryId}: forecast saved.", [
            'days_until_stockout'      => $result['days_until_stockout'] ?? null,
            'predicted_stockout_date'  => $result['predicted_stockout_date'] ?? null,
            'model_used'               => $result['model_used'] ?? 'python_forecast',
        ]);
    }

    /**
     * Persist a forecast result array into inventory_forecasts.
     */
    public function saveForecast(int $inventoryId, array $forecastResult): void
    {
        if (isset($forecastResult['error']) || ($forecastResult['prediction_status'] ?? null) === 'Insufficient Data') {
            return;
        }

        InventoryForecast::create([
            'inventory_id'              => $inventoryId,
            'predicted_demand'          => $forecastResult['predicted_daily_usage'] ?? null,
            'days_until_stockout'       => $forecastResult['days_until_stockout'] ?? null,
            'predicted_stockout_date'   => $forecastResult['predicted_stockout_date'] ?? null,
            'suggested_reorder_quantity' => $forecastResult['suggested_reorder_quantity'] ?? null,
            'generated_at'              => now(),
            'model_used'                => $forecastResult['model_used'] ?? 'python_forecast',
            'notes'                     => $forecastResult['message'] ?? null,
        ]);
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
    private function runPythonForecast(Inventory $inventory, int $historyDays): ?array
    {
        $inventoryId = $inventory->id;
        $csvFilename = "inventory_{$inventoryId}_history_{$historyDays}_days.csv";
        $csvPath     = Storage::path($csvFilename);

        try {
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
            if (!$fileContent || count($fileContent) < 4) {
                return null; // header + fewer than 3 data rows
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
                . ' ' . escapeshellarg($minStockLevel);

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
}

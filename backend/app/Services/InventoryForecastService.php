<?php

namespace App\Services;

use App\Models\Inventory;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Process;
use Illuminate\Support\Facades\Storage;

class InventoryForecastService
{
    public function getStockoutForecast(int $inventoryId, int $historyDays = 30): array
    {
        $inventory = Inventory::find($inventoryId);

        if (!$inventory) {
            return ['error' => 'Inventory item not found.'];
        }

        // 1. Export historical data using the Artisan command
        $csvFilename = "inventory_{$inventoryId}_history_{$historyDays}_days.csv";
        $csvPath = Storage::path($csvFilename);

        // Ensure the file is not stale or from a previous run
        if (Storage::exists($csvFilename)) {
            Storage::delete($csvFilename);
        }

        Artisan::call('app:export-inventory-history', [
            'inventory_id' => $inventoryId,
            '--days' => $historyDays
        ]);

        if (!Storage::exists($csvFilename)) {
            Log::error("Failed to generate CSV for inventory ID: {$inventoryId}. Check Artisan command output.");
            return ['error' => 'Failed to export historical data.'];
        }

        // 2. Execute Python script
        $pythonScriptPath = base_path('ai/forecast.py');
        $minStockLevel = $inventory->min_stock_level ?? 0; // Use min_stock_level from inventory

        if (!file_exists($pythonScriptPath)) {
            Log::error("Python forecast script not found at: {$pythonScriptPath}");
            return ['error' => 'AI forecasting script not found.'];
        }

        try {
            $command = "python3 " . escapeshellarg($pythonScriptPath) . " " . escapeshellarg($csvPath) . " " . escapeshellarg($minStockLevel);
            $process = Process::run($command);
            $output = $process->output();
            $errorOutput = $process->errorOutput();

            if ($process->failed()) {
                Log::error("Python script error for inventory ID {$inventoryId}: " . $errorOutput);
                return ['error' => 'AI script failed: ' . trim($errorOutput ?: $output)];
            }

            $forecastResult = json_decode($output, true);

            if (json_last_error() !== JSON_ERROR_NONE) {
                Log::error("Failed to decode JSON from Python script for inventory ID {$inventoryId}: " . json_last_error_msg() . "
Output: " . $output);
                return ['error' => 'Failed to parse AI script output.'];
            }

            return $forecastResult;

        } catch (\Exception $e) {
            Log::error("Exception running Python script for inventory ID {$inventoryId}: " . $e->getMessage());
            return ['error' => 'An unexpected error occurred during AI forecasting.'];
        } finally {
            // Clean up the generated CSV file
            if (Storage::exists($csvFilename)) {
                Storage::delete($csvFilename);
            }
        }
    }
}

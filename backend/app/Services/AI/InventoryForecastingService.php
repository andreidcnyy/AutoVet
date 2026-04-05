<?php

namespace App\Services\AI;

use App\Models\Inventory;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;
use Symfony\Component\Process\Exception\ProcessFailedException;
use Symfony\Component\Process\Process;

class InventoryForecastingService
{
    /**
     * Forecast when the given inventory item will run out.
     *
     * @param Inventory $inventory
     * @return array
     */
    public function forecast(Inventory $inventory): array
    {
        // 1. Gather historical data from transactions
        $transactions = $inventory->transactions()
            ->orderBy('created_at', 'asc')
            ->get(['created_at', 'new_stock']);

        $aggregatedData = $this->aggregateDailyStock($transactions);

        if (count($aggregatedData) < 2) {
            return [
                "prediction_status" => "No Stockout Predicted",
                "message" => "Not enough transaction history to make a prediction.",
                "current_stock" => $inventory->stock_level,
                "min_stock_level" => $inventory->min_stock_level,
            ];
        }

        // 2. Validate paths
        $scriptPath = base_path('ai/forecast.py');
        if (!file_exists($scriptPath)) {
            Log::error('Forecast Service: Python script not found at ' . $scriptPath);
            return ["error" => "Forecasting script not found. Please contact support."];
        }
        
        $pythonExecutable = env('PYTHON_BIN_PATH') ?: (strtoupper(substr(PHP_OS, 0, 3)) === 'WIN' ? 'python' : 'python3');

        // 3. Build and manage temporary CSV
        $tempFilePath = null;
        try {
            $tempFilePath = $this->createTempCsv($aggregatedData, $inventory->id);
            if (!$tempFilePath) {
                return ["error" => "Failed to generate temporary forecasting data."];
            }

            $minStockLevel = $inventory->min_stock_level ?? 0;
            if (!is_numeric($minStockLevel)) {
                $minStockLevel = 0;
            }

            // 4. Execute python process
            $process = new Process([$pythonExecutable, $scriptPath, $tempFilePath, $minStockLevel]);
            $process->setTimeout(60);
            
            $process->mustRun();
            $output = $process->getOutput();
            $result = json_decode($output, true);

            if (json_last_error() !== JSON_ERROR_NONE) {
                Log::error('Forecast Service JSON Decode Error', [
                    'output' => $output,
                    'error' => json_last_error_msg()
                ]);
                return ["error" => "Failed to parse forecast output."];
            }
            
            return $result;

        } catch (ProcessFailedException $e) {
            Log::error('Forecast Service Process Failed', [
                'exception' => $e->getMessage(),
                'stderr' => $e->getProcess()->getErrorOutput()
            ]);
            return ["error" => "Forecasting process failed or timed out."];
        } catch (\Throwable $e) {
            Log::error('Forecast Service Exception', [
                'exception' => $e->getMessage()
            ]);
            return ["error" => "An unexpected error occurred during forecasting."];
        } finally {
            // 5. Cleanup temporary CSV securely
            if ($tempFilePath !== null && file_exists($tempFilePath)) {
                @unlink($tempFilePath);
            }
        }
    }

    /**
     * Aggregates multiple transactions per day, returning the End of Day stock.
     */
    private function aggregateDailyStock(Collection $transactions): array
    {
        $dailyStock = [];

        foreach ($transactions as $tx) {
            if ($tx->new_stock === null || !is_numeric($tx->new_stock)) {
                continue;
            }

            $dateString = $tx->created_at->format('Y-m-d');
            // Overwrites previous entries for the same day, keeping the most recent (EOD)
            $dailyStock[$dateString] = $tx->new_stock;
        }

        return $dailyStock;
    }

    /**
     * Creates the temporary CSV payload for the Python script.
     * Returns the absolute path, or null on failure.
     */
    private function createTempCsv(array $aggregatedData, int $inventoryId): ?string
    {
        $csvData = "date,stock_level\n";
        foreach ($aggregatedData as $date => $stock) {
            $csvData .= "{$date},{$stock}\n";
        }

        $tempDir = storage_path('app/temp');

        if (!file_exists($tempDir)) {
            if (!@mkdir($tempDir, 0755, true) && !is_dir($tempDir)) {
                Log::error('Forecast Service: Failed to create temporary directory', ['path' => $tempDir]);
                return null;
            }
        }

        $tempFileName = 'forecast_' . $inventoryId . '_' . uniqid() . '.csv';
        $tempFilePath = $tempDir . DIRECTORY_SEPARATOR . $tempFileName;

        if (@file_put_contents($tempFilePath, $csvData) === false) {
             Log::error('Forecast Service: Failed to write temporary CSV', ['path' => $tempFilePath]);
             return null;
        }

        return $tempFilePath;
    }
}

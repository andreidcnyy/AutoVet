<?php

namespace App\Services\AI;

use App\Models\Inventory;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
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

        if ($transactions->count() < 2) {
            return [
                "prediction_status" => "No Stockout Predicted",
                "message" => "Not enough transaction history to make a prediction.",
                "current_stock" => $inventory->stock_level,
                "min_stock_level" => $inventory->min_stock_level,
            ];
        }

        // 2. Build temporary CSV
        $csvData = "date,stock_level\n";
        foreach ($transactions as $transaction) {
            $date = $transaction->created_at->format('Y-m-d');
            $stock = $transaction->new_stock;
            $csvData .= "{$date},{$stock}\n";
        }

        $tempFileName = 'forecast_' . $inventory->id . '_' . time() . '.csv';
        $tempFilePath = storage_path('app/temp/' . $tempFileName);
        
        // Ensure temp directory exists
        if (!file_exists(storage_path('app/temp'))) {
            mkdir(storage_path('app/temp'), 0755, true);
        }

        file_put_contents($tempFilePath, $csvData);

        // 3. Prepare python execution
        $pythonExecutable = env('PYTHON_BIN_PATH', 'python'); // or python3 depending on environment
        $scriptPath = base_path('ai/forecast.py');
        $minStockLevel = $inventory->min_stock_level ?? 0;

        $process = new Process([$pythonExecutable, $scriptPath, $tempFilePath, $minStockLevel]);
        $process->setTimeout(60);

        try {
            $process->mustRun();
            $output = $process->getOutput();
            $result = json_decode($output, true);

            if (json_last_error() !== JSON_ERROR_NONE) {
                Log::error('Forecast Service JSON Decode Error', [
                    'output' => $output,
                    'error' => json_last_error_msg()
                ]);
                $result = ["error" => "Failed to parse forecast output."];
            }

        } catch (ProcessFailedException $e) {
            Log::error('Forecast Service Process Failed', [
                'exception' => $e->getMessage()
            ]);
            $result = ["error" => "Forecasting process failed or timed out."];
        } finally {
            // 4. Cleanup temporary CSV
            if (file_exists($tempFilePath)) {
                unlink($tempFilePath);
            }
        }

        return $result;
    }
}

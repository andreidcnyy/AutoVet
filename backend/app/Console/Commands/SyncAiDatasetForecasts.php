<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

class SyncAiDatasetForecasts extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'app:sync-ai-dataset-forecasts {--dataset=inventory.csv : The dataset filename in storage/datasets}';
    protected $description = 'Maps AI forecasting datasets to live inventory records using unique codes and populates the database.';

    public function handle(): int
    {
        $dataset = $this->option('dataset');
        $csvPath = base_path("storage/datasets/{$dataset}");

        if (!file_exists($csvPath)) {
            $this->error("Dataset not found at {$csvPath}");
            return Command::FAILURE;
        }

        $this->info("Processing AI Dataset: {$dataset}");

        // 1. Get unique codes from the CSV
        $file = fopen($csvPath, 'r');
        $header = fgetcsv($file);
        $codeIndex = array_search('code', $header);

        if ($codeIndex === false) {
            $this->error("Dataset missing 'code' column. Use update_datasets.py to fix it.");
            fclose($file);
            return Command::FAILURE;
        }

        $codes = [];
        while (($row = fgetcsv($file)) !== false) {
            $codes[] = $row[$codeIndex];
        }
        fclose($file);

        $uniqueCodes = array_unique(array_filter($codes));
        $this->info("Found " . count($uniqueCodes) . " unique codes in dataset.");

        $inventoryForecastService = app(\App\Services\InventoryForecastService::class);
        $pythonScriptPath = base_path('ai/forecast.py');
        $pythonExecutable = env('PYTHON_BIN_PATH')
            ?: (strtoupper(substr(PHP_OS, 0, 3)) === 'WIN' ? 'python' : 'python3');

        $synced = 0;
        $unmatched = 0;

        foreach ($uniqueCodes as $code) {
            $inventory = \App\Models\Inventory::where('code', $code)->first();

            if (!$inventory) {
                $this->warn("  [UNMATCHED] Code {$code} does not exist in live inventory. Skipping.");
                $unmatched++;
                continue;
            }

            $this->line("  [MATCH] Code {$code} -> '{$inventory->item_name}' (ID: {$inventory->id})");

            // Run forecast on the global dataset file for this code
            $minStock = $inventory->min_stock_level ?? 10;
            $command = $pythonExecutable
                . ' ' . escapeshellarg($pythonScriptPath)
                . ' ' . escapeshellarg($csvPath)
                . ' ' . escapeshellarg($minStock)
                . ' ' . escapeshellarg("--code={$code}")
                . ' ' . escapeshellarg("--current_stock={$inventory->stock_level}");

            $process = \Illuminate\Support\Facades\Process::run($command);

            if ($process->failed()) {
                $this->error("    AI script failed for {$code}: " . $process->errorOutput());
                continue;
            }

            $result = json_decode($process->output(), true);
            if (!$result || isset($result['error'])) {
                $this->error("    AI result error for {$code}: " . ($result['error'] ?? 'Invalid JSON'));
                continue;
            }

            // Also run sales forecast via service
            $salesResult = $this->runSalesForecast($code);
            $result = array_merge($result, $salesResult);

            // Label correctly as dataset source (set AFTER merge to prevent overwriting)
            $result['prediction_status'] = 'Using dataset-guided prediction';
            $result['message']           = "Historical dataset is used to estimate demand behavior. Final stockout date is based on current live stock.";

            // Save forecast
            $inventoryForecastService->saveForecast($inventory->id, $result);
            $synced++;
        }

        $this->newLine();
        $this->info("Sync complete. Synced: {$synced}, Unmatched: {$unmatched}");
        
        return Command::SUCCESS;
    }

    /**
     * Helper to run sales forecast via CLI (matches service logic)
     */
    private function runSalesForecast(string $code): array
    {
        $salesCsvPath = base_path('storage/datasets/sales.csv');
        $salesScriptPath = base_path('ai/sales_forecast.py');
        $pythonExecutable = env('PYTHON_BIN_PATH') ?: (strtoupper(substr(PHP_OS, 0, 3)) === 'WIN' ? 'python' : 'python3');

        $command = $pythonExecutable
                 . ' ' . escapeshellarg($salesScriptPath)
                 . ' ' . escapeshellarg($salesCsvPath)
                 . ' ' . escapeshellarg("--code={$code}");

        $process = \Illuminate\Support\Facades\Process::run($command);
        if ($process->failed()) return [];

        $res = json_decode($process->output(), true);
        return (json_last_error() === JSON_ERROR_NONE && !isset($res['error'])) ? $res : [];
    }
}

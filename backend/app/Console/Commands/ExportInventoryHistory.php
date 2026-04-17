<?php

namespace App\Console\Commands;

use App\Models\Inventory;
use App\Models\InventoryUsageHistory;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class ExportInventoryHistory extends Command
{
    protected $signature = 'app:export-inventory-history {inventory_id} {--days=30 : Number of days of history to export}';
    protected $description = 'Exports a daily stock-depletion curve from verified sales usage history to CSV for AI forecasting.';

    public function handle(): int
    {
        $inventoryId = (int) $this->argument('inventory_id');
        $days = (int) $this->option('days');

        $inventory = Inventory::find($inventoryId);
        if (!$inventory) {
            $this->error("Inventory item with ID {$inventoryId} not found.");
            return Command::FAILURE;
        }

        $startDate = now()->subDays($days)->toDateString();
        $today = now()->toDateString();

        $usageRows = InventoryUsageHistory::forecastingSafe()
            ->where('inventory_id', $inventoryId)
            ->where('usage_date', '>=', $startDate)
            ->orderBy('usage_date')
            ->get(['usage_date', 'quantity_used']);

        if ($usageRows->isEmpty()) {
            $this->info("No usage history found for inventory ID {$inventoryId} in the last {$days} days. Outputting flat curve.");
        }

        // Aggregate total quantity used per day
        $dailyUsage = [];
        $dailyUsage[$today] = 0; // ensure boundary exists
        $dailyUsage[$startDate] = 0; // ensure boundary exists

        foreach ($usageRows as $row) {
            $date = $row->usage_date instanceof \Carbon\Carbon
                ? $row->usage_date->toDateString()
                : (string) $row->usage_date;

            $dailyUsage[$date] = ($dailyUsage[$date] ?? 0) + (float) $row->quantity_used;
        }

        // Reconstruct a running stock-level curve from current stock backwards.
        $dates = array_keys($dailyUsage);
        sort($dates);
        $currentStock = (float) $inventory->stock_level;
        $stockCurve = [];

        // Walk backwards from today to the oldest date
        $reverseDates = array_reverse($dates);
        $runningStock = $currentStock;

        foreach ($reverseDates as $date) {
            $stockCurve[$date] = max(0, $runningStock);
            $runningStock += $dailyUsage[$date]; // add back what was used that day
        }

        // Re-sort chronologically for the CSV
        ksort($stockCurve);

        $filename = "inventory_{$inventoryId}_history_{$days}_days.csv";
        $csvPath = Storage::path($filename);

        $file = fopen($csvPath, 'w');
        fputcsv($file, ['date', 'stock_level']);

        foreach ($stockCurve as $date => $stockLevel) {
            fputcsv($file, [$date, $stockLevel]);
        }

        fclose($file);

        $this->info("Daily stock depletion curve exported to {$csvPath}");
        Log::info("ExportInventoryHistory: exported {$days}-day depletion curve for inventory ID {$inventoryId} to {$csvPath}");

        return Command::SUCCESS;
    }
}

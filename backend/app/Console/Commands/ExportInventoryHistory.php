<?php

namespace App\Console\Commands;

use App\Models\Inventory;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage; // Added this line

class ExportInventoryHistory extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'app:export-inventory-history {inventory_id} {--days=30 : Number of days of history to export}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Exports historical inventory transactions for a given inventory item to CSV.';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $inventoryId = $this->argument('inventory_id');
        $days = $this->option('days');

        $inventory = Inventory::find($inventoryId);

        if (!$inventory) {
            $this->error("Inventory item with ID {$inventoryId} not found.");
            return Command::FAILURE;
        }

        $startDate = now()->subDays($days);

        // Fetch transactions for the inventory item
        // Assuming 'transactions' is a relationship defined in the Inventory model
        $transactions = $inventory->transactions()
            ->where('created_at', '>=', $startDate)
            ->orderBy('created_at')
            ->get();

        if ($transactions->isEmpty()) {
            $this->info("No transactions found for inventory item ID {$inventoryId} in the last {$days} days.");
            return Command::SUCCESS;
        }

        $headers = ['date', 'stock_level'];
        $dailyStock = [];

        // Group by day to get the end-of-day stock level
        foreach ($transactions as $transaction) {
            $date = $transaction->created_at->format('Y-m-d');
            // Keep the latest stock for the day
            $dailyStock[$date] = $transaction->new_stock;
        }

        $filename = "inventory_{$inventoryId}_history_{$days}_days.csv";
        $csvPath = Storage::path($filename); // Using Storage::path to get full path

        // Ensure the directory exists
        $directory = dirname($csvPath);
        if (!Storage::exists($directory)) {
            Storage::makeDirectory($directory);
        }

        $file = fopen($csvPath, 'w');
        fputcsv($file, $headers);

        foreach ($dailyStock as $date => $stockLevel) {
            fputcsv($file, [$date, $stockLevel]);
        }

        fclose($file);

        $this->info("Historical inventory data exported to {$csvPath}");
        Log::info("Historical inventory data for item {$inventoryId} exported to {$csvPath}");

        return Command::SUCCESS;
    }
}

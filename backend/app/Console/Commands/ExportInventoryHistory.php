<?php

namespace App\Console\Commands;

use App\Models\Inventory;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

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

        $transactions = $inventory->transactions()
            ->where('created_at', '>=', $startDate)
            ->orderBy('created_at')
            ->get();

        if ($transactions->isEmpty()) {
            $this->info("No transactions found for inventory item ID {$inventoryId} in the last {$days} days.");
            return Command::SUCCESS;
        }

        $headers = ['date', 'stock_level'];
        $data = [];
        // Group by day to get the end-of-day stock level
        $dailyStock = [];
        foreach ($transactions as $transaction) {
            $date = $transaction->created_at->format('Y-m-d');
            $dailyStock[$date] = $transaction->new_stock; // Keep the latest stock for the day
        }

        foreach ($dailyStock as $date => $stock) {
            $data[] = [$date, $stock];
        }

        $filename = "inventory_{$inventoryId}_history_{$days}_days.csv";
        $filePath = storage_path('app/' . $filename);

        $file = fopen($filePath, 'w');
        fputcsv($file, $headers);
        foreach ($data as $row) {
            fputcsv($file, $row);
        }
        fclose($file);

        $this->info("Inventory history exported to: {$filePath}");
        Log::info("Inventory history for item {$inventoryId} exported to {$filePath}");

        return Command::SUCCESS;
    }
}

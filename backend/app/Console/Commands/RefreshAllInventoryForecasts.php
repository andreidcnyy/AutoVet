<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

class RefreshAllInventoryForecasts extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'app:refresh-all-inventory-forecasts';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Triggers an AI forecast refresh for all active inventory items.';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info('Starting global AI forecast refresh...');

        $inventoryIds = \App\Models\Inventory::pluck('id')->toArray();
        $count = count($inventoryIds);

        if ($count === 0) {
            $this->warn('No inventory items found to refresh.');
            return;
        }

        $this->info("Queueing forecast refresh for {$count} items...");

        // Dispatch in chunks to avoid overwhelming the queue if the catalog is huge
        foreach (array_chunk($inventoryIds, 10) as $chunk) {
            \App\Jobs\RefreshInventoryForecast::dispatch($chunk, 'scheduled');
        }

        $this->info('Forecast refresh jobs have been dispatched successfully.');
    }
}

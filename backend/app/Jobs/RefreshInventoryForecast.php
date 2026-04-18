<?php

namespace App\Jobs;

use App\Models\Inventory;
use App\Services\InventoryForecastService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class RefreshInventoryForecast implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public int $timeout = 300;

    /**
     * @param array<int> $inventoryIds
     */
    public function __construct(
        private array $inventoryIds,
        private string $triggerSource = 'manual'
    ) {
        // This job now runs on the 'default' queue for simpler worker management.
        // You can still scale by running: php artisan queue:work --queue=default
    }

    public function handle(InventoryForecastService $forecastService): void
    {
        Log::info("RefreshInventoryForecast: Starting batch refresh for " . count($this->inventoryIds) . " items.");
        
        // We use the new batch logic to process all items in a single pass
        $forecastService->runBatchForecast($this->inventoryIds, 365, $this->triggerSource);
    }
}

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
    public function __construct(private array $inventoryIds)
    {
        // Dedicated queue so forecast jobs never block normal app jobs.
        // Run with: php artisan queue:work --queue=forecasting,default
        $this->onQueue('forecasting');
    }

    public function handle(InventoryForecastService $forecastService): void
    {
        foreach ($this->inventoryIds as $inventoryId) {
            $inventory = Inventory::find($inventoryId);

            if (!$inventory) {
                Log::warning("RefreshInventoryForecast: inventory ID {$inventoryId} not found, skipping.");
                continue;
            }

            try {
                $forecastService->refreshAndSaveForecast($inventoryId);
            } catch (\Throwable $e) {
                Log::error("[FORECAST FAILED] inventory ID {$inventoryId}: " . $e->getMessage(), [
                    'inventory_id' => $inventoryId,
                    'exception'    => $e->getMessage(),
                ]);
            }
        }
    }
}

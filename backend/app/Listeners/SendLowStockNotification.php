<?php

namespace App\Listeners;

use App\Events\LowStockDetected;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Support\Facades\Log;

class SendLowStockNotification
{
    /**
     * Create the event listener.
     */
    public function __construct()
    {
        //
    }

    /**
     * Handle the event.
     */
    public function handle(LowStockDetected $event): void
    {
        $item = $event->inventoryItem;
        Log::warning("Low Stock Alert: {$item->item_name} (SKU: {$item->sku}) has reached {$item->stock_level} (Threshold: {$item->min_stock_level})");
    }
}

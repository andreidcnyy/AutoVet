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
        \App\Models\Notification::create([
            'type' => 'LowStockAlert',
            'title' => 'Low Stock Alert',
            'message' => "{$item->item_name} (SKU: {$item->sku}) has reached {$item->stock_level} (Threshold: {$item->min_stock_level})",
            'data' => [
                'inventory_id' => $item->id,
                'stock_level' => $item->stock_level,
                'min_stock_level' => $item->min_stock_level,
            ]
        ]);
    }
}

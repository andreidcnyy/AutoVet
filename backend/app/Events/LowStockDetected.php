<?php

namespace App\Events;

use App\Models\Inventory;
use App\Support\Channels;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class LowStockDetected implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $inventoryItem;

    /**
     * Create a new event instance.
     */
    public function __construct(Inventory $inventoryItem)
    {
        $this->inventoryItem = $inventoryItem;
    }

    /**
     * Get the channels the event should broadcast on.
     *
     * @return array<int, Channel>
     */
    public function broadcastOn(): array
    {
        return [
            Channels::admin('inventory', $this->inventoryItem->clinic_id),
        ];
    }

    /**
     * The event's broadcast name.
     */
    public function broadcastAs(): string
    {
        return 'inventory.low_stock';
    }
}

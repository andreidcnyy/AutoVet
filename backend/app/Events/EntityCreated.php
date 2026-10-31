<?php

namespace App\Events;

use App\Support\Channels;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class EntityCreated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $entityType;

    public $data;

    protected $clinicId;

    /**
     * Create a new event instance.
     *
     * @param  string  $entityType  e.g., 'pet', 'owner'
     * @param  mixed  $data
     */
    public function __construct($entityType, $data = null)
    {
        $this->entityType = $entityType;
        $this->data = $data;
        $this->clinicId = auth()->user()?->clinic_id;
    }

    /**
     * Get the channels the event should broadcast on.
     */
    public function broadcastOn(): array
    {
        return [
            Channels::admin('notifications', $this->clinicId),
        ];
    }

    /**
     * The event's broadcast name.
     */
    public function broadcastAs(): string
    {
        return 'entity.created';
    }
}

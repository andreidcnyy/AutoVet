<?php

namespace App\Events;

use App\Models\Appointment;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class AppointmentCreated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $appointment;

    /**
     * Create a new event instance.
     */
    public function __construct(Appointment $appointment)
    {
        // Only the vet's name: this payload also reaches the client's channel.
        $this->appointment = $appointment->load(['pet.owner', 'service', 'vet:id,name']);
    }

    /**
     * Get the channels the event should broadcast on.
     *
     * @return array<int, \Illuminate\Broadcasting\Channel>
     */
    public function broadcastOn(): array
    {
        $channels = [
            \App\Support\Channels::admin('appointments', $this->appointment->clinic_id),
        ];

        if ($this->appointment->pet?->owner?->user_id) {
            $channels[] = new PrivateChannel('client.appointments.' . $this->appointment->pet->owner->user_id);
        }

        return $channels;
    }

    /**
     * The event's broadcast name.
     */
    public function broadcastAs(): string
    {
        return 'appointment.created';
    }
}

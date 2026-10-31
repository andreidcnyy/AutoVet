<?php

namespace App\Events;

use App\Models\Appointment;
use App\Support\Channels;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class AppointmentStatusUpdated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $appointment;

    /**
     * Create a new event instance.
     */
    public function __construct(Appointment $appointment)
    {
        $this->appointment = $appointment->load(['pet.owner', 'service', 'vet']);
    }

    /**
     * Get the channels the event should broadcast on.
     *
     * @return array<int, Channel>
     */
    public function broadcastOn(): array
    {
        $channels = [
            Channels::admin('appointments', $this->appointment->clinic_id),
        ];

        // Also broadcast to the specific client if they have a portal user account
        if ($this->appointment->pet && $this->appointment->pet->owner && $this->appointment->pet->owner->user_id) {
            $channels[] = new PrivateChannel('client.appointments.'.$this->appointment->pet->owner->user_id);
        }

        return $channels;
    }

    /**
     * The event's broadcast name.
     */
    public function broadcastAs(): string
    {
        return 'appointment.status.updated';
    }
}

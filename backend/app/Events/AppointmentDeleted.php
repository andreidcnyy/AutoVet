<?php

namespace App\Events;

use App\Models\Appointment;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class AppointmentDeleted implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $appointmentId;
    public $portalUserId;
    protected $clinicId;

    public function __construct($appointmentId, $portalUserId = null)
    {
        $this->appointmentId = $appointmentId;
        $this->portalUserId  = $portalUserId;
        $this->clinicId      = auth()->user()?->clinic_id;
    }

    public function broadcastOn(): array
    {
        $channels = [\App\Support\Channels::admin('appointments', $this->clinicId)];
        if ($this->portalUserId) {
            $channels[] = new PrivateChannel('client.appointments.' . $this->portalUserId);
        }
        return $channels;
    }

    /**
     * The event's broadcast name.
     */
    public function broadcastAs(): string
    {
        return 'appointment.deleted';
    }
}

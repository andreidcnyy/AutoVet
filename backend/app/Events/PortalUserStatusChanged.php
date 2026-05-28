<?php

namespace App\Events;

use App\Models\PortalUser;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class PortalUserStatusChanged implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public int $portalUserId;
    public string $status;
    public string $message;

    public function __construct(PortalUser $portalUser, string $status, string $message)
    {
        $this->portalUserId = $portalUser->id;
        $this->status       = $status;
        $this->message      = $message;
    }

    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('client.portal.' . $this->portalUserId),
            new PrivateChannel('admin.notifications'),
        ];
    }

    public function broadcastAs(): string
    {
        return 'portal.status.changed';
    }
}

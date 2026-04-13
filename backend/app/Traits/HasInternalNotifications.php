<?php

namespace App\Traits;

use App\Models\Notification;

trait HasInternalNotifications
{
    /**
     * Create an internal admin notification.
     *
     * @param string $type The notification type (e.g., 'AppointmentPending', 'StockAdded')
     * @param string $title
     * @param string $message
     * @param array|null $data Additional contextual data
     * @param int|null $userId Target user ID (null for all admins)
     * @return Notification
     */
    protected function createInternalNotification(string $type, string $title, string $message, array $data = null, int $userId = null)
    {
        return Notification::create([
            'type' => $type,
            'title' => $title,
            'message' => $message,
            'data' => $data,
            'user_id' => $userId,
            'read_at' => null,
        ]);
    }
}

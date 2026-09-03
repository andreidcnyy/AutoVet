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
        // A repeat alert about the same item replaces the previous one rather
        // than stacking beside it. These fire on a schedule, so without this a
        // few watched items bury everything else in the bell within a day.
        if (in_array($type, Notification::SELF_CLEARING_TYPES, true)) {
            Notification::supersedeUnreadFor($type, $data['clinic_id'] ?? null, $data['inventory_id'] ?? null);
        }

        $notification = Notification::create([
            'type' => $type,
            'title' => $title,
            'message' => $message,
            'data' => $data,
            'user_id' => $userId,
            'read_at' => null,
        ]);

        // Broadcast notification creation
        event(new \App\Events\NotificationCreated($notification));

        return $notification;
    }
}

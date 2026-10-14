<?php

namespace App\Support;

use Illuminate\Broadcasting\PrivateChannel;

/**
 * Names of the staff broadcast channels.
 *
 * They used to be global ("admin.appointments"), so every clinic's staff
 * received every other clinic's appointments, invoices and stock events.
 * Each clinic now has its own set: "admin.{clinicId}.{topic}", authorised
 * in routes/channels.php for staff of that clinic (and super admins).
 */
class Channels
{
    public static function admin(string $topic, $clinicId = null): PrivateChannel
    {
        $clinicId ??= auth()->user()?->clinic_id;

        return new PrivateChannel('admin.' . ($clinicId ?: 'none') . '.' . $topic);
    }
}

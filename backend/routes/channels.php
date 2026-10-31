<?php

use App\Enums\Roles;
use App\Models\Admin;
use Illuminate\Support\Facades\Broadcast;

// Staff and portal clients come from different tables whose ids overlap, so
// every id-based channel also checks which kind of account is asking.
// Without that, client #5 could subscribe to staff member #5's channel.

Broadcast::channel('App.Models.Admin.{id}', function ($user, $id) {
    return $user instanceof Admin && (int) $user->id === (int) $id;
});

Broadcast::channel('notifications.{id}', function ($user, $id) {
    return $user instanceof Admin && (int) $user->id === (int) $id;
});

// Staff channels are per clinic (see App\Support\Channels). A super admin
// may listen to any clinic.
Broadcast::channel('admin.{clinicId}.{topic}', function ($user, $clinicId, $topic) {
    if (! $user instanceof Admin || ! in_array($topic, ['appointments', 'inventory', 'notifications', 'invoices'], true)) {
        return false;
    }

    return $user->role === Roles::SUPER_ADMIN->value || (string) $user->clinic_id === (string) $clinicId;
});

Broadcast::channel('client.appointments.{id}', function ($user, $id) {
    return $user->isOwner() && (int) $user->id === (int) $id;
});

Broadcast::channel('client.portal.{id}', function ($user, $id) {
    return $user->isOwner() && (int) $user->id === (int) $id;
});

Broadcast::channel('client.invoices.{id}', function ($user, $id) {
    return $user->isOwner() && (int) $user->id === (int) $id;
});

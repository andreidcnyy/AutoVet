<?php

use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('App.Models.User.{id}', function ($user, $id) {
    return (int) $user->id === (int) $id;
});

Broadcast::channel('admin.appointments', function ($user) {
    return $user->isFullAdmin() || $user->isClinical();
});

Broadcast::channel('client.appointments.{id}', function ($user, $id) {
    return $user->isOwner() && (int) $user->id === (int) $id;
});

Broadcast::channel('admin.inventory', function ($user) {
    return $user->isFullAdmin() || $user->isClinical() || $user->isStaff();
});

Broadcast::channel('admin.notifications', function ($user) {
    return $user->isFullAdmin() || $user->isClinical() || $user->isStaff();
});

Broadcast::channel('notifications.{id}', function ($user, $id) {
    return (int) $user->id === (int) $id;
});

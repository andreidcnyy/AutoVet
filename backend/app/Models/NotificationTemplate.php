<?php

namespace App\Models;

use App\Traits\HasClinic;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class NotificationTemplate extends Model
{
    use HasFactory, HasClinic;

    protected $fillable = [
        'clinic_id',
        'name',
        'channel',
        'event_key',
        'subject',
        'body',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];
}

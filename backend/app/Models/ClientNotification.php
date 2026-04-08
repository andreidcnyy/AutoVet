<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ClientNotification extends Model
{
    use HasFactory;

    protected $fillable = [
        'owner_id',
        'channel',
        'type',
        'title',
        'message',
        'status',
        'related_type',
        'related_id',
        'sent_at',
        'failed_at',
        'error_message',
    ];

    protected $casts = [
        'sent_at' => 'datetime',
        'failed_at' => 'datetime',
    ];

    public function owner()
    {
        return $this->belongsTo(Owner::class);
    }

    public function related()
    {
        return $this->morphTo();
    }
}

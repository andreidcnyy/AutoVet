<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

use App\Traits\HasClinic;

class Notification extends Model
{
    use HasClinic;

    protected $fillable = [
        'clinic_id',
        'user_id',
        'type',
        'title',
        'message',
        'data',
        'read_at',
    ];

    protected $casts = [
        'data' => 'array',
        'read_at' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(Admin::class);
    }
}

<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class VetSchedule extends Model
{
    protected $fillable = [
        'user_id', 'day_of_week', 'start_time', 'end_time',
        'break_start', 'break_end', 'is_available', 'max_appointments'
    ];

    public function vet()
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}

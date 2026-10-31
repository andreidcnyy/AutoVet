<?php

namespace App\Models;

use App\Traits\HasClinic;
use Illuminate\Database\Eloquent\Model;

class VetSchedule extends Model
{
    use HasClinic;

    protected $fillable = [
        'clinic_id', 'user_id', 'day_of_week', 'start_time', 'end_time',
        'break_start', 'break_end', 'is_available', 'max_appointments',
    ];

    public function vet()
    {
        return $this->belongsTo(Admin::class, 'user_id');
    }
}

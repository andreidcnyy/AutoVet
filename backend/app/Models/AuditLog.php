<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

use App\Traits\HasClinic;

class AuditLog extends Model
{
    use HasClinic;

    protected $fillable = [
        'clinic_id',
        'user_id',
        'action',
        'model_type',
        'model_id',
        'old_values',
        'new_values',
        'ip_address',
        'user_agent',
    ];

    protected $casts = [
        'old_values' => 'array',
        'new_values' => 'array',
    ];

    public function user()
    {
        return $this->belongsTo(Admin::class, 'user_id');
    }
}

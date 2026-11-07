<?php

namespace App\Models;

use App\Support\AuditLogger;
use App\Traits\HasClinic;
use Illuminate\Database\Eloquent\Model;

class AuditLog extends Model
{
    use HasClinic;

    protected $fillable = [
        'clinic_id',
        'user_id',
        'actor_type',
        'actor_name',
        'actor_role',
        'action',
        'model_type',
        'model_id',
        'label',
        'old_values',
        'new_values',
        'request_id',
        'ip_address',
        'user_agent',
    ];

    protected $casts = [
        'old_values' => 'array',
        'new_values' => 'array',
    ];

    /**
     * Never trust what is already stored: rows written before secrets were
     * filtered out still pass through the same filter on the way out.
     */
    public function getOldValuesAttribute($value): ?array
    {
        return self::cleanJson($value);
    }

    public function getNewValuesAttribute($value): ?array
    {
        return self::cleanJson($value);
    }

    private static function cleanJson($value): ?array
    {
        if (is_array($value)) {
            return AuditLogger::redact($value);
        }
        $decoded = is_string($value) && $value !== '' ? json_decode($value, true) : null;

        return is_array($decoded) ? AuditLogger::redact($decoded) : null;
    }

    public function user()
    {
        return $this->belongsTo(Admin::class, 'user_id');
    }
}

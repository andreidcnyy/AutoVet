<?php

namespace App\Traits;

use App\Models\AuditLog;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Request;

trait HasAuditTrail
{
    public static function bootHasAuditTrail()
    {
        static::created(function ($model) {
            self::logAudit($model, 'created');
        });

        static::updated(function ($model) {
            self::logAudit($model, 'updated');
        });

        static::deleted(function ($model) {
            self::logAudit($model, 'deleted');
        });

        if (method_exists(static::class, 'restored')) {
            static::restored(function ($model) {
                self::logAudit($model, 'restored');
            });
        }
    }

    protected static function logAudit($model, $action)
    {
        try {
            $oldValues = [];
            $newValues = [];

            if ($action === 'updated') {
                $oldValues = array_intersect_key($model->getOriginal(), $model->getDirty());
                $newValues = $model->getDirty();
            } elseif ($action === 'created') {
                $newValues = $model->getAttributes();
            } elseif ($action === 'deleted') {
                $oldValues = $model->getAttributes();
            }

            // Exclude hidden fields from logs like passwords
            $hidden = $model->getHidden();
            if (!empty($hidden)) {
                $oldValues = array_diff_key($oldValues, array_flip($hidden));
                $newValues = array_diff_key($newValues, array_flip($hidden));
            }

            AuditLog::create([
                'user_id' => Auth::id(),
                'action' => $action,
                'model_type' => get_class($model),
                'model_id' => $model->getKey(),
                'old_values' => empty($oldValues) ? null : json_encode($oldValues),
                'new_values' => empty($newValues) ? null : json_encode($newValues),
                'ip_address' => Request::ip(),
                'user_agent' => Request::userAgent(),
            ]);
        } catch (\Exception $e) {
            // Do not break the main transaction if audit logging fails
            \Illuminate\Support\Facades\Log::error('Failed to log audit: ' . $e->getMessage());
        }
    }
}

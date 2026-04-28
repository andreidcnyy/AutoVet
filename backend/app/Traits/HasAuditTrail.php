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
            $model->logAudit('created', null, $model->getAttributes());
        });

        static::updated(function ($model) {
            $model->logAudit('updated', $model->getOriginal(), $model->getAttributes());
        });

        static::deleted(function ($model) {
            $model->logAudit('deleted', $model->getOriginal(), null);
        });
    }

    protected function logAudit($action, $old, $new)
    {
        try {
            $user = Auth::user();
            $userId = null;

            // Only log user_id if the authenticated user is an Admin
            // because audit_logs.user_id points to the admins table.
            if ($user instanceof \App\Models\Admin) {
                $userId = $user->id;
            }

            // Derive clinic_id: prefer the audited model's own clinic_id,
            // fall back to the authenticated user's clinic_id. Skip the
            // audit insert entirely if we can't determine one (audit_logs.clinic_id
            // is NOT NULL, so a missing value would throw and we'd lose nothing
            // observable by suppressing the row).
            $clinicId = $this->clinic_id ?? ($user->clinic_id ?? null);
            if ($clinicId === null) {
                return;
            }

            AuditLog::create([
                'clinic_id' => $clinicId,
                'user_id' => $userId,
                'action' => $action,
                'model_type' => get_class($this),
                'model_id' => $this->id,
                'old_values' => $old,
                'new_values' => $new,
                'ip_address' => Request::ip(),
                'user_agent' => Request::userAgent(),
            ]);
        } catch (\Exception $e) {
            // Do not break the main transaction if audit logging fails
            \Illuminate\Support\Facades\Log::error('Failed to log audit: ' . $e->getMessage());
        }
    }
}

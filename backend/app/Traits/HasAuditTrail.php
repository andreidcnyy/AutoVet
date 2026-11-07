<?php

namespace App\Traits;

use App\Support\AuditLogger;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Writes an audit row when the model is created, changed, removed, restored
 * or permanently deleted. Updates record only the fields that changed, and an
 * update that touched nothing but timestamps is not recorded at all.
 */
trait HasAuditTrail
{
    public static function bootHasAuditTrail()
    {
        static::created(function ($model) {
            AuditLogger::record('created', $model, null, $model->getAttributes());
        });

        static::updated(function ($model) {
            if ($diff = AuditLogger::diff($model)) {
                AuditLogger::record('updated', $model, $diff[0], $diff[1]);
            }
        });

        static::deleted(function ($model) {
            $soft = in_array(SoftDeletes::class, class_uses_recursive($model), true) && ! $model->isForceDeleting();
            AuditLogger::record($soft ? 'archived' : 'deleted', $model, $model->getOriginal(), null);
        });

        if (in_array(SoftDeletes::class, class_uses_recursive(static::class), true)) {
            static::restored(function ($model) {
                AuditLogger::record('restored', $model, null, ['deleted_at' => null]);
            });
        }
    }
}

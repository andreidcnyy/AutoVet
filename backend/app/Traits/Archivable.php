<?php

namespace App\Traits;

use Illuminate\Support\Facades\Auth;

trait Archivable
{
    public static function bootArchivable()
    {
        static::deleting(function ($model) {
            if (!$model->isForceDeleting() && in_array('deleted_by', $model->getFillable()) && auth()->check()) {
                $model->deleted_by = Auth::id();
                $model->restore_until = now()->addDays(30);
                $model->saveQuietly(); // save without triggering other events just to persist these fields
            }
        });

        static::forceDeleting(function ($model) {
            if (method_exists($model, 'preventPermanentDeletionIfReferenced')) {
                $model->preventPermanentDeletionIfReferenced();
            }
        });

        static::restored(function ($model) {
            if (in_array('deleted_by', $model->getFillable())) {
                $model->deleted_by = null;
                $model->restore_until = null;
                $model->saveQuietly();
            }
        });
    }

    public function deleter()
    {
        return $this->belongsTo(\App\Models\User::class, 'deleted_by');
    }
}

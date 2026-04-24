<?php

namespace App\Traits;

use App\Models\Clinic;
use App\Models\Scopes\ClinicScope;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

trait HasClinic
{
    /**
     * Boot the trait to automatically apply the ClinicScope.
     */
    protected static function bootHasClinic(): void
    {
        static::addGlobalScope(new ClinicScope());

        // Automatically set clinic_id on creation
        static::creating(function ($model) {
            if (!$model->clinic_id && auth()->check()) {
                $model->clinic_id = auth()->user()->clinic_id;
            }
        });
    }

    public function clinic(): BelongsTo
    {
        return $this->belongsTo(Clinic::class);
    }
}

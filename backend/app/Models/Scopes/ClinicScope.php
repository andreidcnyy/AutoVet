<?php

namespace App\Models\Scopes;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Scope;
use Illuminate\Support\Facades\Auth;
use App\Enums\Roles;

class ClinicScope implements Scope
{
    /**
     * Apply the scope to a given Eloquent query builder.
     */
    public function apply(Builder $builder, Model $model): void
    {
        // If we are in console (Artisan commands, Jobs), we might not have a user.
        // In that case, we should manually set the clinic context if needed, 
        // or bypass if it's a global operation.
        if (app()->runningInConsole()) {
            return;
        }

        $user = Auth::user();

        if ($user) {
            // Super admins are system owners, they should NOT see clinic-specific 
            // data (appointments, pets, etc.) by default. 
            // They should manage clinics from the platform dashboard.
            if (method_exists($user, 'hasRole') && $user->hasRole(Roles::SUPER_ADMIN->value)) {
                // Return no results for clinic-specific models when accessed by super_admin
                $builder->whereRaw('1 = 0'); 
                return;
            }

            // Everyone else is restricted to their clinic
            if (isset($user->clinic_id)) {
                $builder->where($model->getTable() . '.clinic_id', $user->clinic_id);
            }
        }
    }
}

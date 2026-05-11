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
            // Check for super_admin role more robustly
            $role = null;
            if (isset($user->role)) {
                $role = $user->role;
            }

            // Super admins should see ALL data across ALL clinics.
            if ($role === Roles::SUPER_ADMIN->value) {
                return;
            }

            // Everyone else is restricted to their clinic
            if (isset($user->clinic_id)) {
                $builder->where($model->getTable() . '.clinic_id', '=', $user->clinic_id);
            } else {
                // If user is authenticated but has no clinic_id and is not super_admin, 
                // this might be an edge case or misconfiguration.
                // We should probably still restrict them to nothing or log it.
                // For now, if they are not super admin and have no clinic, they see nothing from clinic-scoped tables.
                $builder->whereRaw('1 = 0');
                
                // Only log if not in a high-volume context to avoid log flooding
                if (!app()->isProduction()) {
                    \Illuminate\Support\Facades\Log::warning("ClinicScope applied to user without clinic_id: " . $user->id);
                }
            }
        }
    }
}

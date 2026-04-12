<?php

namespace App\Policies;

use App\Models\MedicalRecord;
use App\Enums\Roles;
use Illuminate\Auth\Access\Response;
use Illuminate\Contracts\Auth\Authenticatable;

class MedicalRecordPolicy
{
    /**
     * Perform pre-authorization checks.
     */
    public function before(Authenticatable $user, string $ability): bool|null
    {
        if (method_exists($user, 'isFullAdmin') && $user->isFullAdmin()) {
            return true;
        }

        return null;
    }

    /**
     * Determine whether the user can view any models.
     */
    public function viewAny(Authenticatable $user): bool
    {
        if (method_exists($user, 'hasRole')) {
            return $user->hasRole(...Roles::all());
        }
        return true;
    }

    /**
     * Determine whether the user can view the model.
     */
    public function view(Authenticatable $user, MedicalRecord $medicalRecord): bool
    {
        if (method_exists($user, 'hasRole') && $user->hasRole(...Roles::employeeRoles())) {
            return true;
        }

        if (method_exists($user, 'isOwner') && $user->isOwner()) {
            return $user->owner?->id === $medicalRecord->pet?->owner_id;
        }

        return false;
    }

    /**
     * Determine whether the user can create models.
     */
    public function create(Authenticatable $user): bool
    {
        if (method_exists($user, 'hasRole')) {
            return $user->hasRole(...Roles::clinicalRoles());
        }
        return false;
    }

    /**
     * Determine whether the user can update the model.
     */
    public function update(Authenticatable $user, MedicalRecord $medicalRecord): bool
    {
        if (method_exists($user, 'hasRole')) {
            return $user->hasRole(...Roles::clinicalRoles());
        }
        return false;
    }

    /**
     * Determine whether the user can delete the model.
     */
    public function delete(Authenticatable $user, MedicalRecord $medicalRecord): bool
    {
        if (method_exists($user, 'isClinical')) {
            return $user->isClinical();
        }
        return false;
    }

    /**
     * Determine whether the user can restore the model.
     */
    public function restore(Authenticatable $user, MedicalRecord $medicalRecord): bool
    {
        if (method_exists($user, 'isAdmin')) {
            return $user->isAdmin();
        }
        return false;
    }

    /**
     * Determine whether the user can permanently delete the model.
     */
    public function forceDelete(Authenticatable $user, MedicalRecord $medicalRecord): bool
    {
        if (method_exists($user, 'isAdmin')) {
            return $user->isAdmin();
        }
        return false;
    }
}

<?php

namespace App\Policies;

use App\Models\Pet;
use App\Enums\Roles;
use Illuminate\Auth\Access\Response;
use Illuminate\Contracts\Auth\Authenticatable;

class PetPolicy
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
        return true; // Default for portal users
    }

    /**
     * Determine whether the user can view the model.
     */
    public function view(Authenticatable $user, Pet $pet): bool
    {
        if (method_exists($user, 'hasRole') && $user->hasRole(...Roles::employeeRoles())) {
            return true;
        }

        if (method_exists($user, 'isOwner') && $user->isOwner()) {
            return $user->owner?->id === $pet->owner_id;
        }

        return false;
    }

    /**
     * Determine whether the user can create models.
     */
    public function create(Authenticatable $user): bool
    {
        if (method_exists($user, 'hasRole')) {
            return $user->hasRole(...Roles::employeeRoles());
        }
        return false;
    }

    /**
     * Determine whether the user can update the model.
     */
    public function update(Authenticatable $user, Pet $pet): bool
    {
        if (method_exists($user, 'hasRole') && $user->hasRole(...Roles::employeeRoles())) {
            return true;
        }

        // Owners can only update basic info of their own pets (if we want to allow that)
        if (method_exists($user, 'isOwner') && $user->isOwner()) {
            return $user->owner?->id === $pet->owner_id;
        }

        return false;
    }

    /**
     * Determine whether the user can delete the model.
     */
    public function delete(Authenticatable $user, Pet $pet): bool
    {
        return method_exists($user, 'isAdmin') && $user->isAdmin();
    }

    /**
     * Determine whether the user can restore the model.
     */
    public function restore(Authenticatable $user, Pet $pet): bool
    {
        return method_exists($user, 'isAdmin') && $user->isAdmin();
    }

    /**
     * Determine whether the user can permanently delete the model.
     */
    public function forceDelete(Authenticatable $user, Pet $pet): bool
    {
        return method_exists($user, 'isAdmin') && $user->isAdmin();
    }
}

<?php

namespace App\Policies;

use App\Models\Owner;
use App\Models\Admin;
use App\Models\PortalUser;
use App\Enums\Roles;
use Illuminate\Auth\Access\Response;
use Illuminate\Contracts\Auth\Authenticatable;

class OwnerPolicy
{
    /**
     * Perform pre-authorization checks.
     */
    public function before(Authenticatable $user, string $ability): bool|null
    {
        // Support our User proxy model and direct Admin model
        if (method_exists($user, 'isAdmin') && $user->isAdmin()) {
            return true;
        }

        return null;
    }

    /**
     * Determine whether the user can view any models.
     */
    public function viewAny(Authenticatable $user): bool
    {
        return true;
    }

    /**
     * Determine whether the user can view the model.
     */
    public function view(Authenticatable $user, Owner $owner): bool
    {
        return true;
    }

    /**
     * Determine whether the user can create models.
     */
    public function create(Authenticatable $user): bool
    {
        return true;
    }

    /**
     * Determine whether the user can update the model.
     */
    public function update(Authenticatable $user, Owner $owner): bool
    {
        return true;
    }

    /**
     * Determine whether the user can delete the model.
     */
    public function delete(Authenticatable $user, Owner $owner): bool
    {
        return true;
    }

    /**
     * Determine whether the user can restore the model.
     */
    public function restore(Authenticatable $user, Owner $owner): bool
    {
        return true;
    }

    /**
     * Determine whether the user can permanently delete the model.
     */
    public function forceDelete(Authenticatable $user, Owner $owner): bool
    {
        return true;
    }
}

<?php

namespace App\Policies;

use App\Models\Owner;
use App\Models\Admin;
use App\Models\PortalUser;
use App\Enums\Roles;
use Illuminate\Contracts\Auth\Authenticatable;

class OwnerPolicy
{
    /**
     * Admins and employees bypass all checks.
     */
    public function before(Authenticatable $user, string $ability): bool|null
    {
        if (method_exists($user, 'isAdmin') && $user->isAdmin()) {
            return true;
        }

        return null;
    }

    /**
     * Portal users can only list owners linked to their own account.
     * Admins/employees already bypassed via before().
     */
    public function viewAny(Authenticatable $user): bool
    {
        return method_exists($user, 'isOwner') && $user->isOwner();
    }

    /**
     * Portal users can only view their own owner record.
     */
    public function view(Authenticatable $user, Owner $owner): bool
    {
        if (method_exists($user, 'isOwner') && $user->isOwner()) {
            return $user->owner?->id === $owner->id;
        }

        return false;
    }

    /**
     * Only admins/employees can create owners (bypassed via before()).
     */
    public function create(Authenticatable $user): bool
    {
        return false;
    }

    /**
     * Portal users can only update their own owner record.
     */
    public function update(Authenticatable $user, Owner $owner): bool
    {
        if (method_exists($user, 'isOwner') && $user->isOwner()) {
            return $user->owner?->id === $owner->id;
        }

        return false;
    }

    /**
     * Only admins/employees can delete owners (bypassed via before()).
     */
    public function delete(Authenticatable $user, Owner $owner): bool
    {
        return false;
    }

    /**
     * Only admins/employees can restore owners (bypassed via before()).
     */
    public function restore(Authenticatable $user, Owner $owner): bool
    {
        return false;
    }

    /**
     * Only admins/employees can force-delete owners (bypassed via before()).
     */
    public function forceDelete(Authenticatable $user, Owner $owner): bool
    {
        return false;
    }
}

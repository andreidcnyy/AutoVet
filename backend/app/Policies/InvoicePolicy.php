<?php

namespace App\Policies;

use App\Enums\Roles;
use App\Models\Invoice;
use Illuminate\Contracts\Auth\Authenticatable;

class InvoicePolicy
{
    /**
     * Perform pre-authorization checks.
     */
    public function before(Authenticatable $user, string $ability): ?bool
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
    public function view(Authenticatable $user, Invoice $invoice): bool
    {
        if (method_exists($user, 'hasRole') && $user->hasRole(...Roles::employeeRoles())) {
            return true;
        }

        if (method_exists($user, 'isOwner') && $user->isOwner()) {
            // Drafts are the clinic's work in progress; the listing already
            // hides them from clients, and opening one by id must too.
            return $user->owner?->id === $invoice->pet?->owner_id
                && strtolower((string) $invoice->status) !== 'draft';
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
    public function update(Authenticatable $user, Invoice $invoice): bool
    {
        if (method_exists($user, 'hasRole')) {
            return $user->hasRole(...Roles::employeeRoles());
        }

        return false;
    }

    /**
     * Determine whether the user can delete the model.
     */
    public function delete(Authenticatable $user, Invoice $invoice): bool
    {
        return method_exists($user, 'isAdmin') && $user->isAdmin();
    }

    /**
     * Determine whether the user can restore the model.
     */
    public function restore(Authenticatable $user, Invoice $invoice): bool
    {
        return method_exists($user, 'isAdmin') && $user->isAdmin();
    }

    /**
     * Determine whether the user can permanently delete the model.
     */
    public function forceDelete(Authenticatable $user, Invoice $invoice): bool
    {
        return method_exists($user, 'isAdmin') && $user->isAdmin();
    }
}

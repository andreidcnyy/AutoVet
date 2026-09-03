<?php

namespace App\Traits;

use App\Models\Owner;
use Illuminate\Support\Facades\DB;

trait IdentifiesPortalOwner
{
    /**
     * Ensures the authenticated portal user has a linked owner record.
     * Returns the owner ID or null if not a portal user.
     */
    protected function getPortalOwnerId()
    {
        $user = auth()->user();
        if (!$user || !method_exists($user, 'isOwner') || !$user->isOwner()) {
            return null;
        }

        if (!$user->owner) {
            // Use a transaction + lock to prevent race conditions creating duplicate owners
            $owner = DB::transaction(function () use ($user) {
                $owner = $this->findExistingOwner('user_id', $user->id);
                if ($owner) return $this->reclaimOwner($owner, $user);

                $owner = $this->findExistingOwner('email', $user->email);
                if ($owner) return $this->reclaimOwner($owner, $user);

                return Owner::create([
                    'name'     => $user->name,
                    'email'    => $user->email,
                    'phone'    => $user->phone ?? '00000000000',
                    'address'  => $user->address ?? 'N/A',
                    'city'     => $user->city ?? 'N/A',
                    'province' => $user->province ?? 'N/A',
                    'zip'      => $user->zip ?? '0000',
                    'user_id'  => $user->id,
                ]);
            });
            $user->setRelation('owner', $owner);
        }

        return $user->owner?->id;
    }

    /**
     * Finds the owner record belonging to this portal user.
     *
     * Deliberately looks past both the soft-delete filter and ClinicScope. An
     * owner that an admin archived, or whose clinic_id differs from the portal
     * user's, is still that person's record — but the ordinary query cannot see
     * it, so the caller used to conclude no owner existed and create a second
     * one. That silently forked the account: the new pet landed on a duplicate
     * owner while the real record kept the existing pets, invoices and history.
     */
    private function findExistingOwner(string $column, $value): ?Owner
    {
        if ($value === null || $value === '') {
            return null;
        }

        return Owner::withTrashed()
            ->withoutGlobalScope(\App\Models\Scopes\ClinicScope::class)
            ->lockForUpdate()
            ->where($column, $value)
            ->first();
    }

    /**
     * Re-attaches a found owner to this portal user, un-archiving it if needed.
     * Re-linking also repairs a stale user_id left by a deleted portal account.
     */
    private function reclaimOwner(Owner $owner, $user): Owner
    {
        if ($owner->trashed()) {
            $owner->restore();
        }

        if ((int) $owner->user_id !== (int) $user->id) {
            $owner->user_id = $user->id;
            $owner->save();
        }

        return $owner;
    }

    /**
     * Invalidates the portal dashboard cache for a specific owner.
     */
    protected function invalidatePortalCache(?int $ownerId = null): void
    {
        if ($ownerId) {
            $owner = Owner::find($ownerId);
            if ($owner && $owner->user_id) {
                \Illuminate\Support\Facades\Cache::forget("portal_overview_{$owner->user_id}");
            }
        }

        // Also invalidate for the currently authenticated user if they are an owner
        $user = auth()->user();
        if ($user && method_exists($user, 'isOwner') && $user->isOwner()) {
            \Illuminate\Support\Facades\Cache::forget("portal_overview_{$user->id}");
        }
    }
}

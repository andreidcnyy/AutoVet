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
                $owner = Owner::lockForUpdate()->where('user_id', $user->id)->first();
                if ($owner) return $owner;

                $owner = Owner::lockForUpdate()->where('email', $user->email)->first();
                if ($owner) {
                    // Always re-link — handles stale user_id pointing to deleted portal users
                    $owner->update(['user_id' => $user->id]);
                    return $owner;
                }

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

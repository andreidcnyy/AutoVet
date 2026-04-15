<?php

namespace App\Traits;

use App\Models\Owner;

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
            // Defensive: ensure owner record exists for the portal user
            $owner = Owner::where('email', $user->email)->first();
            if ($owner) {
                if (!$owner->user_id) {
                    $owner->update(['user_id' => $user->id]);
                }
            } else {
                $owner = Owner::create([
                    'name' => $user->name,
                    'email' => $user->email,
                    'phone' => $user->phone ?? '00000000000',
                    'address' => $user->address ?? 'N/A',
                    'city' => $user->city ?? 'N/A',
                    'province' => $user->province ?? 'N/A',
                    'zip' => $user->zip ?? '0000',
                    'user_id' => $user->id,
                ]);
            }
            $user->setRelation('owner', $owner);
        }

        return $user->owner?->id;
    }
}

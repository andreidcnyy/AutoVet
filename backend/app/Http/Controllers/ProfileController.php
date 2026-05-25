<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use App\Models\Admin;
use App\Models\Owner;
use App\Models\PortalUser;

class ProfileController extends Controller
{
    public function show()
    {
        $user = auth()->user();
        if (!$user) {
            return response()->json(['error' => 'Unauthenticated.'], 401);
        }
        return response()->json($user);
    }

    public function devices(Request $request)
    {
        $user = $request->user();
        $currentTokenId = $user->currentAccessToken()->id;

        $devices = $user->tokens()
            ->select(['id', 'name', 'ip_address', 'user_agent', 'last_used_at', 'created_at'])
            ->latest()
            ->get()
            ->map(fn($token) => [
                'id'           => $token->id,
                'name'         => $token->name,
                'ip_address'   => $token->ip_address,
                'user_agent'   => $token->user_agent,
                'last_used_at' => $token->last_used_at,
                'created_at'   => $token->created_at,
                'is_current'   => $token->id === $currentTokenId,
            ]);

        return response()->json($devices);
    }

    public function revokeDevice(Request $request, $tokenId)
    {
        $user = $request->user();
        $currentTokenId = $user->currentAccessToken()->id;

        if ((int) $tokenId === $currentTokenId) {
            return response()->json(['error' => 'Cannot revoke your current session.'], 422);
        }

        $deleted = $user->tokens()->where('id', $tokenId)->delete();

        if (!$deleted) {
            return response()->json(['error' => 'Session not found.'], 404);
        }

        return response()->json(['message' => 'Device session revoked.']);
    }

    public function revokeOtherDevices(Request $request)
    {
        $user = $request->user();
        $currentTokenId = $user->currentAccessToken()->id;

        $count = $user->tokens()->where('id', '!=', $currentTokenId)->delete();

        return response()->json(['message' => "Revoked {$count} other session(s)."]);
    }

    public function completeProfile(Request $request)
    {
        $user = $request->user();

        $validated = $request->validate([
            'phone'    => 'required|string|size:11',
            'address'  => 'required|string|max:500',
            'province' => 'required|string|max:255',
            'city'     => 'required|string|max:255',
            'zip'      => 'nullable|string|max:10',
        ]);

        $user->update($validated);

        return response()->json([
            'status'  => 'success',
            'message' => 'Profile completed.',
            'user'    => $user->fresh(),
        ]);
    }

    public function deleteAccount(Request $request)
    {
        $user = $request->user();

        if (!($user instanceof PortalUser)) {
            return response()->json(['error' => 'Only portal users can delete their account.'], 403);
        }

        if ($user->deletion_requested_at) {
            return response()->json(['error' => 'Account deletion is already scheduled.'], 422);
        }

        // Mark for deletion — actual soft-delete happens after 30 days
        $user->forceFill(['deletion_requested_at' => now()])->save();

        // Revoke all tokens so they can't use the app anymore
        $user->tokens()->delete();

        return response()->json(['message' => 'Your account is scheduled for deletion in 30 days.']);
    }

    public function recoverAccount(Request $request)
    {
        $user = $request->user();

        if (!($user instanceof PortalUser)) {
            return response()->json(['error' => 'Unauthorized.'], 403);
        }

        $user->forceFill(['deletion_requested_at' => null])->save();

        return response()->json(['message' => 'Your account has been recovered successfully.']);
    }

    public function update(Request $request)
    {
        $user = auth()->user();
        if (!$user) {
            return response()->json(['error' => 'Unauthenticated.'], 401);
        }

        $table = ($user instanceof Admin) ? 'admins' : 'portal_users';

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|max:255|unique:' . $table . ',email,' . $user->id,
            // ~2MB base64 cap; must be a valid image data URI
            'avatar' => ['nullable', 'string', 'max:2800000', 'regex:/^data:image\/(jpeg|jpg|png|gif|webp);base64,[A-Za-z0-9+\/]+=*$/i']
        ]);

        $user->update($validated);

        // Sync name/email to linked Owner record so admin side reflects changes
        if ($user instanceof PortalUser) {
            $owner = Owner::where('user_id', $user->id)->first();
            if ($owner) {
                $syncData = array_filter([
                    'name'  => $validated['name']  ?? null,
                    'email' => $validated['email'] ?? null,
                ]);
                if ($syncData) $owner->update($syncData);
            }
            Cache::forget("portal_overview_{$user->id}");
        }

        // Return the full user object for frontend sync
        return response()->json([
            'status' => 'success',
            'message' => 'Profile updated successfully',
            'user' => $user->fresh()
        ]);
    }
}

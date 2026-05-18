<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Admin;
use App\Models\PortalUser;

class ProfileController extends Controller
{
    public function show()
    {
        // Use authenticated user if available, otherwise fallback to first admin for early dev
        $user = auth()->user();
        
        if (!$user) {
            $user = Admin::first() ?: PortalUser::first();
        }

        if (!$user) {
            return response()->json(['error' => 'No user found'], 404);
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

    public function update(Request $request)
    {
        $user = auth()->user();
        
        if (!$user) {
            $user = Admin::first() ?: PortalUser::first();
        }

        if (!$user) {
            return response()->json(['error' => 'No user found'], 404);
        }

        $table = ($user instanceof Admin) ? 'admins' : 'portal_users';

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|max:255|unique:' . $table . ',email,' . $user->id,
            'role' => 'nullable|string|max:255',
            // ~2MB base64 cap; must be a valid image data URI
            'avatar' => ['nullable', 'string', 'max:2800000', 'regex:/^data:image\/(jpeg|jpg|png|gif|webp);base64,[A-Za-z0-9+\/]+=*$/i']
        ]);

        $user->update($validated);

        // Return the full user object for frontend sync
        return response()->json([
            'status' => 'success',
            'message' => 'Profile updated successfully',
            'user' => $user->fresh()
        ]);
    }
}

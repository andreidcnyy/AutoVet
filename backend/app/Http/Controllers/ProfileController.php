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
            'avatar' => 'nullable|string|max:1000000'
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

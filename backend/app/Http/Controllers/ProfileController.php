<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

use App\Models\User;

class ProfileController extends Controller
{
    public function show()
    {
        // For a single-tenant or initial local setup, returning the first user
        $user = User::first();
        if (!$user) {
            return response()->json(['error' => 'No user found'], 404);
        }
        return response()->json($user);
    }

    public function update(Request $request)
    {
        $user = User::first();
        if (!$user) {
            return response()->json(['error' => 'No user found'], 404);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|max:255|unique:users,email,' . $user->id,
            'role' => 'nullable|string|max:255',
            'avatar' => 'nullable|string|max:1000000'
        ]);

        $user->update($validated);

        return response()->json(['status' => 'success', 'user' => $user]);
    }
}

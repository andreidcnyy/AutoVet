<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use App\Models\Admin;
use App\Models\PortalUser;
use App\Models\Owner;
use Illuminate\Support\Facades\DB;
use App\Enums\Roles;

class AuthController extends Controller
{
    public function register(Request $request)
    {
        \Log::info('Registration attempt', ['email' => $request->email]);
        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:portal_users|unique:admins',
            'password' => 'required|string|min:8',
        ]);

        return DB::transaction(function () use ($request) {
            $user = PortalUser::create([
                'name' => $request->name,
                'email' => $request->email,
                'password' => Hash::make($request->password),
                'status' => 'active',
            ]);

            Owner::create([
                'name' => $request->name,
                'email' => $request->email,
                'user_id' => $user->id,
            ]);

            $token = $user->createToken('auth-token')->plainTextToken;

            \Log::info('User registered successfully in portal_users', ['user_id' => $user->id]);

            return response()->json([
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => Roles::OWNER->value,
                'token' => $token,
            ], 201);
        });
    }

    public function login(Request $request)
    {
        \Log::info('Login attempt', ['email' => $request->email]);
        $request->validate([
            'email' => 'required|email',
            'password' => 'required',
        ]);

        // Try Admin first
        $user = Admin::where('email', $request->email)->first();
        $is_admin = true;

        if (!$user) {
            // Try PortalUser
            $user = PortalUser::where('email', $request->email)->first();
            $is_admin = false;
        }

        if (!$user) {
            \Log::warning('Login failed: User not found in either table', ['email' => $request->email]);
            return response()->json(['error' => 'Invalid credentials'], 401);
        }

        if (!Hash::check($request->password, $user->password)) {
            \Log::warning('Login failed: Password mismatch', ['email' => $request->email]);
            return response()->json([
                'error' => 'Invalid credentials',
            ], 401);
        }

        // Generate Sanctum API token
        $token = $user->createToken('auth-token')->plainTextToken;

        $responseData = [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $is_admin ? $user->role : Roles::OWNER->value,
            'avatar' => $is_admin ? $user->avatar : null,
            'status' => $user->status,
            'must_change_password' => $is_admin ? $user->must_change_password : false,
            'token' => $token,
        ];

        \Log::info('User logged in successfully', [
            'user_id' => $user->id, 
            'table' => $is_admin ? 'admins' : 'portal_users',
            'role' => $responseData['role']
        ]);

        return response()->json($responseData);
    }

    public function changePassword(Request $request)
    {
        $request->validate([
            'password' => 'required|string|min:8|confirmed',
        ]);

        $user = $request->user();
        $user->update([
            'password' => Hash::make($request->password),
            'must_change_password' => false,
        ]);

        return response()->json(['message' => 'Password changed successfully']);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();
        return response()->json(['message' => 'Logged out successfully']);
    }
}

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
use Illuminate\Support\Facades\Mail;
use App\Mail\PasswordResetMail;

class AuthController extends Controller
{
    public function register(Request $request)
    {
        try {
            \Log::info('Registration attempt', ['email' => $request->email]);
            $request->validate([
                'name' => 'required|string|max:255',
                'email' => 'required|string|email:rfc,dns|max:255|unique:portal_users|unique:admins',
                'phone' => 'required|string|size:11', 
                'address' => 'required|string|max:255',
                'city' => 'required|string|max:255',
                'province' => 'required|string|max:255',
                'zip' => 'nullable|string|max:20',
                'password' => 'required|string|min:8|confirmed',
            ]);

            return DB::transaction(function () use ($request) {
                $user = PortalUser::create([
                    'name' => $request->name,
                    'email' => $request->email,
                    'phone' => $request->phone,
                    'address' => $request->address,
                    'city' => $request->city,
                    'province' => $request->province,
                    'zip' => $request->zip,
                    'password' => Hash::make($request->password),
                    'status' => 'active',
                ]);

                Owner::create([
                    'name' => $request->name,
                    'email' => $request->email,
                    'phone' => $request->phone,
                    'address' => $request->address,
                    'city' => $request->city,
                    'province' => $request->province,
                    'zip' => $request->zip,
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
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'message' => 'The given data was invalid.',
                'errors' => $e->errors(),
            ], 422);
        } catch (\Exception $e) {
            \Log::error('Registration Error: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString()
            ]);
            return response()->json(['error' => $e->getMessage()], 500);
        }
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

    public function forgotPassword(Request $request)
    {
        $request->validate(['email' => 'required|email']);

        $user = Admin::where('email', $request->email)->first() 
             ?? PortalUser::where('email', $request->email)->first();

        if (!$user) {
            return response()->json(['message' => 'If your email is in our system, you will receive a reset link.'], 200);
        }

        $token = \Illuminate\Support\Str::random(60);

        DB::table('password_reset_tokens')->updateOrInsert(
            ['email' => $request->email],
            [
                'token' => Hash::make($token),
                'created_at' => now()
            ]
        );

        // Send email
        $portalUrl = env('FRONTEND_PORTAL_URL', 'http://localhost:5174');
        $resetUrl = "{$portalUrl}/reset-password?token={$token}&email={$request->email}";

        try {
            Mail::to($request->email)->send(new PasswordResetMail($resetUrl));
            \Log::info("Password reset email sent to {$request->email}");
        } catch (\Exception $e) {
            \Log::error("Failed to send password reset email: " . $e->getMessage());
        }

        return response()->json(['message' => 'If your email is in our system, you will receive a reset link.'], 200);
    }

    public function resetPassword(Request $request)
    {
        $request->validate([
            'token' => 'required',
            'email' => 'required|email',
            'password' => 'required|string|min:8|confirmed',
        ]);

        $reset = DB::table('password_reset_tokens')->where('email', $request->email)->first();

        if (!$reset || !Hash::check($request->token, $reset->token)) {
            return response()->json(['error' => 'Invalid or expired token.'], 422);
        }

        $user = Admin::where('email', $request->email)->first() 
             ?? PortalUser::where('email', $request->email)->first();

        if (!$user) {
            return response()->json(['error' => 'User not found.'], 404);
        }

        $user->update(['password' => Hash::make($request->password)]);
        DB::table('password_reset_tokens')->where('email', $request->email)->delete();

        return response()->json(['message' => 'Password reset successfully.']);
    }
}

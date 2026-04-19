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
            // Pre-flight: purge orphan / unverified PortalUser rows that would block a
            // legitimate re-registration. An orphan is a portal_users row that either
            // (a) has no linked Owner, or (b) was never email-verified. These rows can
            // exist from earlier registration flows or abandoned verification attempts,
            // and would otherwise make the unique-email check falsely reject a brand-new user.
            $normalizedEmail = strtolower(trim((string) $request->input('email')));
            if ($normalizedEmail !== '') {
                $existing = PortalUser::where('email', $normalizedEmail)->first();
                if ($existing) {
                    $hasLinkedOwner = Owner::where('user_id', $existing->id)->exists();
                    $neverVerified = is_null($existing->email_verified_at);

                    if (!$hasLinkedOwner || $neverVerified) {
                        \Log::info('Register: cleaning stale PortalUser before re-registration', [
                            'email' => $normalizedEmail,
                            'existing_id' => $existing->id,
                            'has_linked_owner' => $hasLinkedOwner,
                            'never_verified' => $neverVerified,
                        ]);
                        Owner::where('user_id', $existing->id)->forceDelete();
                        $existing->forceDelete();
                    }
                }
            }

            $request->validate([
                'name' => 'required|string|max:255',
                'email' => [
                    'required',
                    'string',
                    'email:rfc,dns',
                    'max:255',
                    \Illuminate\Validation\Rule::unique('portal_users')->whereNull('deleted_at'),
                    \Illuminate\Validation\Rule::unique('admins')->whereNull('deleted_at'),
                ],
                'phone' => 'required|string|size:11',
                'password' => 'required|string|min:8|confirmed',
            ], [
                'email.unique' => 'An account with this email already exists. If this is you, try logging in or resetting your password.',
            ]);

            $verificationUrl = \URL::temporarySignedRoute(
                'registration.verify', now()->addHours(24), [
                    'name' => $request->name,
                    'email' => $request->email,
                    'phone' => $request->phone,
                    'address' => $request->address,
                    'city' => $request->city,
                    'province' => $request->province,
                    'zip' => $request->zip,
                    'password' => Hash::make($request->password), // Hash password before sending
                ]
            );
            
            // Send custom notification
            (new \App\Models\PortalUser(['email' => $request->email]))
                ->notify(new \App\Notifications\VerifyRegistration($verificationUrl));

            return response()->json(['message' => 'Verification email sent. Please check your inbox.']);

        } catch (\Illuminate\Validation\ValidationException $e) {
            \Log::error('Registration Validation Error', [
                'errors' => $e->errors(),
                'input' => $request->all()
            ]);
            return response()->json([
                'message' => 'The given data was invalid.',
                'errors' => $e->errors(),
            ], 422);
        } catch (\Exception $e) {
            \Log::error('Registration Error: ' . $e->getMessage());
            return response()->json(['error' => 'Could not send verification email.'], 500);
        }
    }

    public function verifyRegistration(Request $request)
    {
        if (! $request->hasValidSignature()) {
            return response()->json(['error' => 'Invalid or expired verification link.'], 401);
        }

        try {
            return DB::transaction(function () use ($request) {
                $email = strtolower(trim((string) $request->email));

                // Idempotent: if a PortalUser already exists for this email (e.g. the user
                // clicked the verification link a second time, or had a duplicate link from
                // an earlier register attempt), just make sure it's marked verified, ensure
                // the Owner companion row exists, and send them to login.
                $user = PortalUser::where('email', $email)->first();

                if ($user) {
                    if (is_null($user->email_verified_at)) {
                        $user->forceFill(['email_verified_at' => now()])->save();
                    }
                } else {
                    $user = PortalUser::create([
                        'name' => $request->name,
                        'email' => $email,
                        'phone' => $request->phone,
                        'password' => $request->password, // Already hashed
                        'address' => $request->address,
                        'city' => $request->city,
                        'province' => $request->province,
                        'zip' => $request->zip,
                        'status' => 'active',
                        'email_verified_at' => now(),
                    ]);
                }

                $ownerExists = Owner::where('user_id', $user->id)
                    ->orWhere('email', $email)
                    ->exists();

                if (!$ownerExists) {
                    Owner::create([
                        'name' => $request->name,
                        'email' => $email,
                        'phone' => $request->phone,
                        'address' => $request->address,
                        'city' => $request->city,
                        'province' => $request->province,
                        'zip' => $request->zip,
                        'user_id' => $user->id,
                    ]);
                } else {
                    // If an Owner row exists but isn't linked to this PortalUser, link it.
                    Owner::where('email', $email)
                        ->whereNull('user_id')
                        ->update(['user_id' => $user->id]);
                }

                \Log::info('User verified (idempotent)', ['user_id' => $user->id, 'email' => $email]);

                return redirect(env('FRONTEND_PORTAL_URL', 'http://localhost:5174') . '/login?verified=true');
            });
        } catch (\Exception $e) {
            \Log::error('Verification Error: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
            ]);
            return response()->json([
                'error' => 'An error occurred during account creation.',
                'detail' => config('app.debug') ? $e->getMessage() : null,
            ], 500);
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

        if (!$is_admin && !$user->hasVerifiedEmail()) {
            // Backfill: earlier versions of verifyRegistration() silently dropped
            // email_verified_at on create (field wasn't in $fillable). If this user
            // has a linked Owner, they completed verification — mark them verified now.
            $hasLinkedOwner = Owner::where('user_id', $user->id)->exists();
            if ($hasLinkedOwner && Hash::check($request->password, $user->password)) {
                $user->forceFill(['email_verified_at' => now()])->save();
            } else {
                return response()->json(['error' => 'Please verify your email before logging in.'], 403);
            }
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
            Mail::mailer('forgot_password')->to($request->email)->send(new PasswordResetMail($resetUrl));
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

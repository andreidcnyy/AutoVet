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
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
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

            $token = Str::random(64);
            Cache::put('pending_reg_' . $token, [
                'name'     => $request->name,
                'email'    => $request->email,
                'phone'    => $request->phone,
                'address'  => $request->address,
                'city'     => $request->city,
                'province' => $request->province,
                'zip'      => $request->zip,
                'password' => Hash::make($request->password),
            ], now()->addHours(24));

            $verificationUrl = \URL::temporarySignedRoute(
                'registration.verify', now()->addHours(24), ['token' => $token]
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

        $pending = Cache::get('pending_reg_' . $request->query('token'));
        if (!$pending) {
            return response()->json(['error' => 'Verification link has expired or already been used.'], 410);
        }

        try {
            return DB::transaction(function () use ($request, $pending) {
                $email = strtolower(trim((string) $pending['email']));

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
                        'clinic_id' => 1,
                        'name'              => $pending['name'],
                        'email'             => $email,
                        'phone'             => $pending['phone'],
                        'password'          => $pending['password'],
                        'address'           => $pending['address'],
                        'city'              => $pending['city'],
                        'province'          => $pending['province'],
                        'zip'               => $pending['zip'],
                        'status'            => 'active',
                        'email_verified_at' => now(),
                    ]);
                }

                Cache::forget('pending_reg_' . $request->query('token'));

                // Find the canonical owner for this user: first by user_id, then by email.
                // Must scope email fallback by clinic_id — ClinicScope is not active here (unauthenticated).
                $owner = Owner::where('user_id', $user->id)->first()
                    ?? Owner::where('email', $email)->where('clinic_id', 1)->first();

                if (!$owner) {
                    Owner::create([
                        'clinic_id' => 1,
                        'name'     => $pending['name'],
                        'email'    => $email,
                        'phone'    => $pending['phone'],
                        'address'  => $pending['address'],
                        'city'     => $pending['city'],
                        'province' => $pending['province'],
                        'zip'      => $pending['zip'],
                        'user_id'  => $user->id,
                    ]);
                } else {
                    // Always ensure the owner is linked to the current portal user.
                    if ($owner->user_id !== $user->id) {
                        $owner->update(['user_id' => $user->id]);
                    }
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
        $request->validate([
            'email' => 'required|email',
            'password' => 'required',
        ]);

        \Log::info('Login attempt', ['email' => $request->email]);

        // Try Admin first - use withoutGlobalScopes to bypass ClinicScope 
        // and withTrashed() to ensure we find the user even if soft-deleted
        $user = Admin::withoutGlobalScopes()->withTrashed()->where('email', $request->email)->first();
        $is_admin = true;

        if (!$user) {
            // Try PortalUser
            $user = PortalUser::withoutGlobalScopes()->withTrashed()->where('email', $request->email)->first();
            $is_admin = false;
        }

        if (!$user) {
            \Log::warning('Login failed: User not found in database', ['email' => $request->email]);
            return response()->json(['error' => 'Invalid credentials'], 401);
        }

        // Block admin/staff/vet accounts from logging into the web portal
        if ($is_admin && $request->input('source') === 'portal') {
            \Log::warning('Portal login blocked for admin account', ['email' => $request->email]);
            return response()->json(['error' => 'This login is for pet owners only. Please use the admin panel.'], 403);
        }

        // Migrate old soft-deleted portal users into the new grace period flow
        if ($user instanceof PortalUser && $user->deleted_at && !$user->deletion_requested_at) {
            $user->restore();
            $user->forceFill(['deletion_requested_at' => $user->deleted_at])->save();
        }

        // Check if user is soft-deleted (admin-deactivated, not self-deletion)
        if ($user->deleted_at && !($user instanceof PortalUser && $user->deletion_requested_at)) {
            \Log::warning('Login failed: User account is deactivated/deleted', ['email' => $request->email]);
            return response()->json(['error' => 'This account has been deactivated.'], 403);
        }

        // Block suspended or deactivated portal users
        if ($user instanceof PortalUser && in_array($user->status, ['suspended', 'deactivated'])) {
            $msg = $user->status === 'suspended'
                ? 'Your account has been temporarily suspended. Please contact the clinic.'
                : 'Your account has been deactivated. Please contact the clinic.';
            \Log::warning("Login blocked: portal user status={$user->status}", ['email' => $request->email]);
            return response()->json(['error' => $msg], 403);
        }

        // Portal user self-deletion: 30-day grace period
        if ($user instanceof PortalUser && $user->deletion_requested_at) {
            $deadline = $user->deletion_requested_at->copy()->addDays(30);
            $daysRemaining = max(0, (int) ceil(now()->diffInDays($deadline)));

            if ($daysRemaining <= 0) {
                // Grace period expired — fully soft-delete now
                $user->delete();
                return response()->json(['error' => 'This account has been permanently deleted.'], 403);
            }

            // Issue a token so they can recover from the portal
            $token = $user->createToken('recovery')->plainTextToken;
            return response()->json([
                'account_pending_deletion' => true,
                'days_remaining'           => $daysRemaining,
                'deletion_requested_at'    => $user->deletion_requested_at,
                'token'                    => $token,
                'id'                       => $user->id,
                'name'                     => $user->name,
                'email'                    => $user->email,
            ]);
        }

        if (!$is_admin && !$user->hasVerifiedEmail()) {
            \Log::info('Login attempt: Email not verified', ['email' => $request->email]);
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

        // Google sign-up accounts have no password set — guide them instead of a
        // confusing "Invalid credentials".
        if (!$is_admin && empty($user->password)) {
            \Log::info('Login attempt on passwordless (Google) account', ['email' => $request->email]);
            return response()->json([
                'error' => 'This account was created with Google. Continue with Google, or open Profile → Security to set a password for email login.',
            ], 403);
        }

        if (!Hash::check($request->password, $user->password)) {
            \Log::warning('Login failed: Password mismatch', ['email' => $request->email]);
            return response()->json([
                'error' => 'Invalid credentials',
            ], 401);
        }

        // One token per device — delete any existing token for this user agent before creating a new one
        $currentUserAgent = $request->userAgent();
        if ($currentUserAgent) {
            $user->tokens()->where('user_agent', $currentUserAgent)->delete();
        }

        $deviceName = $this->parseDeviceName($currentUserAgent ?? '');
        $newToken = $user->createToken($deviceName);
        $newToken->accessToken->forceFill([
            'ip_address' => $request->ip(),
            'user_agent' => $currentUserAgent,
        ])->save();
        $token = $newToken->plainTextToken;

        $responseData = [
            'id' => $user->id,
            'clinic_id' => $user->clinic_id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $is_admin ? $user->role : Roles::OWNER->value,
            'avatar' => $is_admin ? $user->avatar : null,
            'status' => $user->status,
            'must_change_password' => $is_admin ? $user->must_change_password : false,
            'ai_features_enabled' => $is_admin ? (bool) $user->ai_features_enabled : false,
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
        $user = $request->user();
        $hasPassword = !empty($user->password);

        // Google sign-up accounts have no password yet — they may SET one without a
        // current password. Accounts that already have one must confirm the current.
        $request->validate([
            'current_password' => ($hasPassword ? 'required' : 'nullable') . '|string',
            'password' => 'required|string|min:8|confirmed',
        ]);

        if ($hasPassword && !Hash::check($request->current_password, $user->password)) {
            return response()->json(['message' => 'The current password is incorrect.'], 422);
        }

        $user->update([
            'password' => Hash::make($request->password),
            'must_change_password' => false,
        ]);

        return response()->json([
            'message' => $hasPassword
                ? 'Password changed successfully'
                : 'Password set successfully. You can now log in with your email and password.',
        ]);
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

        if (\Carbon\Carbon::parse($reset->created_at)->addMinutes(60)->isPast()) {
            DB::table('password_reset_tokens')->where('email', $request->email)->delete();
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

    private function parseDeviceName(string $userAgent): string
    {
        $browser = 'Unknown Browser';
        $os = 'Unknown OS';

        if (str_contains($userAgent, 'Edg/'))       $browser = 'Edge';
        elseif (str_contains($userAgent, 'OPR/') || str_contains($userAgent, 'Opera/')) $browser = 'Opera';
        elseif (str_contains($userAgent, 'Chrome/')) $browser = 'Chrome';
        elseif (str_contains($userAgent, 'Firefox/')) $browser = 'Firefox';
        elseif (str_contains($userAgent, 'Safari/') && !str_contains($userAgent, 'Chrome')) $browser = 'Safari';
        elseif (str_contains($userAgent, 'MSIE') || str_contains($userAgent, 'Trident/')) $browser = 'Internet Explorer';

        if (str_contains($userAgent, 'iPhone') || str_contains($userAgent, 'iPad')) $os = 'iOS';
        elseif (str_contains($userAgent, 'Android')) $os = 'Android';
        elseif (str_contains($userAgent, 'Windows')) $os = 'Windows';
        elseif (str_contains($userAgent, 'Macintosh') || str_contains($userAgent, 'Mac OS')) $os = 'macOS';
        elseif (str_contains($userAgent, 'Linux')) $os = 'Linux';

        return "{$browser} on {$os}";
    }

    public function checkPortalStatus(Request $request)
    {
        $email = $request->query('email');
        if (!$email) return response()->json(['status' => 'unknown']);

        $user = PortalUser::where('email', $email)->first();
        if (!$user) return response()->json(['status' => 'not_found']);

        $messages = [
            'suspended'   => 'Your account has been temporarily suspended. Please contact the clinic.',
            'deactivated' => 'Your account has been deactivated. Please contact the clinic to restore access.',
        ];

        return response()->json([
            'status'  => $user->status ?? 'active',
            'message' => $messages[$user->status] ?? null,
        ]);
    }
}

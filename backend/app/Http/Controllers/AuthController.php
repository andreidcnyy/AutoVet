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
use App\Support\AccountStatus;

class AuthController extends Controller
{
    public function register(Request $request)
    {
        try {
            // An unverified portal_users row (left by an older registration flow)
            // must not block signing up again with the same address. It is no
            // longer deleted here: this endpoint is unauthenticated, so deleting
            // on request let anyone destroy someone else's account by email.
            // The stale row is reclaimed in verifyRegistration() instead, once
            // the caller has proven they own the mailbox.
            $request->validate([
                'name' => 'required|string|max:255',
                'email' => [
                    'required',
                    'string',
                    'email:rfc,dns',
                    'max:255',
                    \Illuminate\Validation\Rule::unique('portal_users')->whereNull('deleted_at')->whereNotNull('email_verified_at'),
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
            // Field names only — the input holds the plaintext password.
            \Log::info('Registration validation failed', [
                'fields' => array_keys($e->errors()),
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
            return response()->json(['error' => 'Invalid or expired verification link.'], 403);
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
                $clinicId = config('app.default_clinic_id');

                if ($user) {
                    // A row that was never verified is left over from an
                    // abandoned signup. Whoever clicked this link has just
                    // proven they own the mailbox, so the details they
                    // registered with replace the stale ones.
                    if (is_null($user->email_verified_at)) {
                        $user->forceFill([
                            'name'              => $pending['name'],
                            'phone'             => $pending['phone'],
                            'password'          => $pending['password'],
                            'address'           => $pending['address'],
                            'city'              => $pending['city'],
                            'province'          => $pending['province'],
                            'zip'               => $pending['zip'],
                            'email_verified_at' => now(),
                        ])->save();
                        $user->tokens()->delete();
                    }
                } else {
                    $user = PortalUser::create([
                        'clinic_id'         => $clinicId,
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
                    ?? Owner::where('email', $email)->where('clinic_id', $clinicId)->first();

                if (!$owner) {
                    Owner::create([
                        'clinic_id' => $clinicId,
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

                return redirect(config('app.portal_url') . '/login?verified=true');
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

        // Admins first, then portal users. Scopes are bypassed (no user is
        // authenticated yet) and soft-deleted rows are included so a deleted
        // account gets the right answer instead of looking unregistered.
        $user = Admin::withoutGlobalScopes()->withTrashed()->where('email', $request->email)->first();
        $is_admin = true;

        if (!$user) {
            $user = PortalUser::withoutGlobalScopes()->withTrashed()->where('email', $request->email)->first();
            $is_admin = false;
        }

        // Nothing about the account is revealed until the password matches.
        // Every branch below used to run first and answer differently
        // (deactivated, unverified, Google-only, pending deletion), which told
        // anyone with a list of emails who was registered and in what state —
        // and the pending-deletion branch handed out a token with no password.
        // A Google-only account has no password and can never match here; the
        // message points those users at the Google button instead.
        if (!$user || empty($user->password) || !Hash::check($request->password, $user->password)) {
            \Log::warning('Login failed', ['reason' => $user ? 'password' : 'unknown_email']);
            return response()->json([
                'error' => 'Invalid credentials. If you signed up with Google, use "Continue with Google".',
            ], 401);
        }

        // Block admin/staff/vet accounts from logging into the web portal
        if ($is_admin && $request->input('source') === 'portal') {
            return response()->json(['error' => 'This login is for pet owners only. Please use the admin panel.'], 403);
        }

        // A soft-deleted row without a deletion request was archived by the
        // clinic. It used to be silently restored into the self-deletion grace
        // flow here, which let an archived client sign straight back in.
        if ($user->deleted_at && !($user instanceof PortalUser && $user->deletion_requested_at)) {
            \Log::warning('Login blocked: account archived', ['user_id' => $user->id]);
            return response()->json(['error' => 'This account has been deactivated.'], 403);
        }

        if ($block = AccountStatus::blockReason($user)) {
            \Log::warning('Login blocked', ['user_id' => $user->id, 'code' => $block['code']]);
            return response()->json(['error' => $block['message'], 'code' => $block['code']], 403);
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

            return response()->json(self::recoveryResponse($user, $daysRemaining));
        }

        if (!$is_admin && !$user->hasVerifiedEmail()) {
            // Backfill: earlier versions of verifyRegistration() silently dropped
            // email_verified_at on create (field wasn't in $fillable). If this user
            // has a linked Owner, they completed verification — mark them verified now.
            if (Owner::where('user_id', $user->id)->exists()) {
                $user->forceFill(['email_verified_at' => now()])->save();
            } else {
                return response()->json(['error' => 'Please verify your email before logging in.'], 403);
            }
        }

        $currentUserAgent = $request->userAgent();

        // Signing in no longer revokes the session already running on this
        // device. Deleting the token that matched this user agent meant a
        // second tab — or simply reloading the login page — invalidated the tab
        // the user was working in, which then failed its next request with a
        // 401 and looked like being logged out at random.
        //
        // Sessions are still bounded rather than unbounded: tokens past
        // Sanctum's expiration window are already dead and are cleared out, and
        // only the most recent few are kept per account.
        $this->pruneStaleTokens($user);

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

        // Sign out every other device: a password change is usually a
        // response to a suspected leak, so sessions opened with the old one
        // must not survive it. The current session stays signed in.
        $currentId = $user->currentAccessToken()?->id;
        $user->tokens()->when($currentId, fn ($q) => $q->where('id', '!=', $currentId))->delete();

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
        $resetUrl = config('app.portal_url') . '/reset-password?' . http_build_query([
            'token' => $token,
            'email' => $request->email,
        ]);

        try {
            Mail::mailer('forgot_password')->to($request->email)->send(new PasswordResetMail($resetUrl));
            \Log::info('Password reset email sent', ['user_id' => $user->id]);
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
        // Whoever held the old password may still hold a session made with it.
        $user->tokens()->delete();
        DB::table('password_reset_tokens')->where('email', $request->email)->delete();

        return response()->json(['message' => 'Password reset successfully.']);
    }

    /** How many concurrent sign-ins an account may hold before the oldest is dropped. */
    private const MAX_ACTIVE_SESSIONS = 10;

    /**
     * Keeps the token table bounded without revoking sessions still in use.
     *
     * Runs before a new token is issued, so it leaves room for the one about to
     * be created. Two passes: anything older than Sanctum's expiration window
     * cannot authenticate anyway, then the oldest surplus beyond the cap.
     */
    private function pruneStaleTokens($user): void
    {
        $expirationMinutes = config('sanctum.expiration');
        if ($expirationMinutes) {
            $user->tokens()
                ->where('created_at', '<', now()->subMinutes($expirationMinutes))
                ->delete();
        }

        $keep = $user->tokens()
            ->orderByDesc('id')
            ->take(self::MAX_ACTIVE_SESSIONS - 1)
            ->pluck('id');

        // whereNotIn with an empty list resolves to 1=1 in Laravel, which would
        // delete every remaining token. Only prune when something is being kept.
        if ($keep->isNotEmpty()) {
            $user->tokens()->whereNotIn('id', $keep)->delete();
        }
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

    /**
     * Response for a portal account inside its 30-day self-deletion window.
     *
     * The token carries only the `recover` ability. EnsureAccountActive turns
     * it away from everything except recovering or signing out, so holding it
     * does not open the account; recoverAccount() swaps it for a full token.
     */
    public static function recoveryResponse(PortalUser $user, int $daysRemaining): array
    {
        $token = $user->createToken('recovery', ['recover'], now()->addDay())->plainTextToken;

        return [
            'account_pending_deletion' => true,
            'days_remaining'           => $daysRemaining,
            'deletion_requested_at'    => $user->deletion_requested_at,
            'token'                    => $token,
            'id'                       => $user->id,
            'name'                     => $user->name,
            'email'                    => $user->email,
            'role'                     => Roles::OWNER->value,
        ];
    }
}

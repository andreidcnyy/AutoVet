<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use App\Models\Owner;
use App\Models\PortalUser;
use App\Models\Clinic;
use App\Enums\Roles;
use App\Support\AccountStatus;

class GoogleAuthController extends Controller
{
    public function handle(Request $request)
    {
        $request->validate(['access_token' => 'required|string']);

        $googleUser = $this->verifiedGoogleUser($request->access_token);
        if (!$googleUser) {
            return response()->json(['error' => 'Invalid Google token.'], 401);
        }

        $user = PortalUser::withoutGlobalScopes()
            ->withTrashed()
            ->where(function ($q) use ($googleUser) {
                $q->where('google_id', $googleUser['sub'])
                  ->orWhere('email', $googleUser['email']);
            })
            ->first();

        if ($user) {
            // Archived by the clinic (soft-deleted without a deletion request).
            // The password login refuses these, so Google must too.
            if ($user->deleted_at && !$user->deletion_requested_at) {
                return response()->json(['error' => 'This account has been deactivated.'], 403);
            }

            // Suspension, deactivation and an inactive clinic used to be
            // checked by the password login only, so Google was a way round.
            if ($block = AccountStatus::blockReason($user)) {
                return response()->json(['error' => $block['message'], 'code' => $block['code']], 403);
            }

            if ($user->deletion_requested_at) {
                $deadline      = $user->deletion_requested_at->copy()->addDays(30);
                $daysRemaining = max(0, (int) ceil(now()->diffInDays($deadline)));

                if ($daysRemaining <= 0) {
                    $user->delete();
                    return response()->json(['error' => 'This account has been permanently deleted.'], 403);
                }

                return response()->json(AuthController::recoveryResponse($user, $daysRemaining));
            }

            if (!$user->google_id) {
                $user->update(['google_id' => $googleUser['sub']]);
            }
            // Lifetime comes from config('sanctum.expiration'), like every other sign-in.
            $token = $user->createToken('portal-google')->plainTextToken;
            $profileComplete = !empty($user->phone) && !empty($user->address)
                            && !empty($user->province) && !empty($user->city);
            return response()->json(array_merge($this->userPayload($user), [
                'token'            => $token,
                'profile_complete' => $profileComplete,
            ]));
        }

        // New user — if no profile data yet, ask frontend to collect it first
        if (!$request->filled('phone')) {
            return response()->json([
                'needs_profile' => true,
                'name'          => $googleUser['name'] ?? '',
                'email'         => $googleUser['email'],
                'avatar'        => $googleUser['picture'] ?? null,
            ]);
        }

        // New user with profile data — create account
        $request->validate([
            'phone'    => 'required|string|max:20',
            'address'  => 'required|string|max:500',
            'province' => 'required|string|max:255',
            'city'     => 'required|string|max:255',
            'zip'      => 'nullable|string|max:10',
        ]);

        $clinic = Clinic::find(config('app.default_clinic_id')) ?? Clinic::first();
        if (!$clinic) {
            return response()->json(['error' => 'No clinic configured.'], 500);
        }

        $user = DB::transaction(function () use ($request, $googleUser, $clinic) {
            $user = PortalUser::create([
                'clinic_id'         => $clinic->id,
                'name'              => $googleUser['name'] ?? $googleUser['email'],
                'email'             => $googleUser['email'],
                'google_id'         => $googleUser['sub'],
                'avatar'            => $googleUser['picture'] ?? null,
                'phone'             => $request->phone,
                'address'           => $request->address,
                'province'          => $request->province,
                'city'              => $request->city,
                'zip'               => $request->zip ?? null,
                'email_verified_at' => now(),
                'status'            => 'active',
            ]);

            // Link or create the Owner companion record (same as manual registration).
            // Must scope by clinic_id — ClinicScope is not active in unauthenticated contexts.
            $owner = Owner::where('email', $googleUser['email'])->where('clinic_id', $clinic->id)->first();
            if ($owner) {
                if ($owner->user_id !== $user->id) {
                    $owner->update(['user_id' => $user->id]);
                }
            } else {
                Owner::create([
                    'clinic_id' => $clinic->id,
                    'name'      => $googleUser['name'] ?? $googleUser['email'],
                    'email'     => $googleUser['email'],
                    'phone'     => $request->phone,
                    'address'   => $request->address,
                    'province'  => $request->province,
                    'city'      => $request->city,
                    'zip'       => $request->zip ?? null,
                    'user_id'   => $user->id,
                ]);
            }

            return $user;
        });

        $token = $user->createToken('portal-google')->plainTextToken;

        return response()->json(array_merge($this->userPayload($user), [
            'token'            => $token,
            'profile_complete' => true,
        ]));
    }

    /**
     * Resolves a Google access token to its profile, or null if it cannot be
     * trusted.
     *
     * The userinfo endpoint alone accepts a token issued to any Google OAuth
     * client, so a token another app obtained from a victim signed in as the
     * victim here. tokeninfo reports which client the token was issued to; it
     * must be ours, and Google must have verified the address.
     */
    private function verifiedGoogleUser(string $accessToken): ?array
    {
        $clientId = config('services.google.client_id');
        if (!$clientId) {
            Log::error('[google-auth] GOOGLE_CLIENT_ID is not configured; refusing Google sign-in.');
            return null;
        }

        $info = Http::get('https://oauth2.googleapis.com/tokeninfo', ['access_token' => $accessToken]);
        if (!$info->ok()) {
            return null;
        }

        $audience = $info->json('aud') ?? $info->json('azp');
        if ($audience !== $clientId) {
            Log::warning('[google-auth] Token issued to a different client was rejected.');
            return null;
        }

        $profile = Http::withToken($accessToken)->get('https://www.googleapis.com/oauth2/v3/userinfo');
        if (!$profile->ok()) {
            return null;
        }

        $googleUser = $profile->json();
        $verified = filter_var($googleUser['email_verified'] ?? false, FILTER_VALIDATE_BOOLEAN);

        if (empty($googleUser['sub']) || empty($googleUser['email']) || !$verified
            || (string) $googleUser['sub'] !== (string) $info->json('sub')) {
            return null;
        }

        $googleUser['email'] = strtolower(trim($googleUser['email']));
        return $googleUser;
    }

    /** The same account fields the password login returns, plus contact details. */
    private function userPayload(PortalUser $user): array
    {
        return [
            'id'        => $user->id,
            'clinic_id' => $user->clinic_id,
            'name'      => $user->name,
            'email'     => $user->email,
            'role'      => Roles::OWNER->value,
            'avatar'    => $user->avatar,
            'status'    => $user->status,
            'phone'     => $user->phone,
            'address'   => $user->address,
            'city'      => $user->city,
            'province'  => $user->province,
            'zip'       => $user->zip,
        ];
    }
}

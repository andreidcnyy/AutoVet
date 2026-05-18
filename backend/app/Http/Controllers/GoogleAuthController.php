<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use App\Models\PortalUser;
use App\Models\Clinic;

class GoogleAuthController extends Controller
{
    public function handle(Request $request)
    {
        $request->validate(['access_token' => 'required|string']);

        $response = Http::get('https://www.googleapis.com/oauth2/v3/userinfo', [
            'access_token' => $request->access_token,
        ]);

        if (!$response->ok()) {
            return response()->json(['error' => 'Invalid Google token.'], 401);
        }

        $googleUser = $response->json();

        if (empty($googleUser['sub']) || empty($googleUser['email'])) {
            return response()->json(['error' => 'Invalid Google token.'], 401);
        }

        $user = PortalUser::withoutGlobalScopes()
            ->where(function ($q) use ($googleUser) {
                $q->where('google_id', $googleUser['sub'])
                  ->orWhere('email', $googleUser['email']);
            })
            ->first();

        // Existing user — check pending deletion first
        if ($user) {
            // Support both new flow (deletion_requested_at) and old flow (deleted_at only)
            $deletionDate = $user->deletion_requested_at ?? ($user->deleted_at ?: null);

            if ($deletionDate) {
                // Migrate old soft-deleted accounts into the new grace period flow
                if ($user->deleted_at && !$user->deletion_requested_at) {
                    $user->restore();
                    $user->forceFill(['deletion_requested_at' => $user->deleted_at])->save();
                    $deletionDate = $user->deletion_requested_at;
                }

                $daysElapsed   = (int) now()->diffInDays($deletionDate);
                $daysRemaining = max(0, 30 - $daysElapsed);

                if ($daysRemaining <= 0) {
                    $user->delete();
                    return response()->json(['error' => 'This account has been permanently deleted.'], 403);
                }

                $token = $user->createToken('recovery')->plainTextToken;
                return response()->json([
                    'account_pending_deletion' => true,
                    'days_remaining'           => $daysRemaining,
                    'deletion_requested_at'    => $deletionDate,
                    'token'                    => $token,
                    'id'                       => $user->id,
                    'name'                     => $user->name,
                    'email'                    => $user->email,
                ]);
            }

            if (!$user->google_id) {
                $user->update(['google_id' => $googleUser['sub']]);
            }
            $token = $user->createToken('portal-google', ['*'], now()->addDays(30))->plainTextToken;
            $profileComplete = !empty($user->phone) && !empty($user->address)
                            && !empty($user->province) && !empty($user->city);
            return response()->json(array_merge($user->makeHidden(['password', 'remember_token'])->toArray(), [
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
            'phone'    => 'required|string',
            'address'  => 'required|string',
            'province' => 'required|string',
            'city'     => 'required|string',
        ]);

        $clinic = Clinic::first();
        if (!$clinic) {
            return response()->json(['error' => 'No clinic configured.'], 500);
        }

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

        $token = $user->createToken('portal-google', ['*'], now()->addDays(30))->plainTextToken;

        return response()->json(array_merge($user->makeHidden(['password', 'remember_token'])->toArray(), [
            'token'            => $token,
            'profile_complete' => true,
        ]));
    }
}

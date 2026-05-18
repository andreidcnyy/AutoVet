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

        if (!$user) {
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
                'email_verified_at' => now(),
                'status'            => 'active',
            ]);
        } elseif (!$user->google_id) {
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
}

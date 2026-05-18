<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\PortalUser;
use App\Models\Clinic;
use Laravel\Socialite\Facades\Socialite;

class GoogleAuthController extends Controller
{
    public function handle(Request $request)
    {
        $request->validate(['access_token' => 'required|string']);

        try {
            $googleUser = Socialite::driver('google')->stateless()->userFromToken($request->access_token);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Invalid Google token.'], 401);
        }

        $user = PortalUser::withoutGlobalScopes()
            ->where(function ($q) use ($googleUser) {
                $q->where('google_id', $googleUser->getId())
                  ->orWhere('email', $googleUser->getEmail());
            })
            ->first();

        if (!$user) {
            $clinic = Clinic::first();
            if (!$clinic) {
                return response()->json(['error' => 'No clinic configured.'], 500);
            }

            $user = PortalUser::create([
                'clinic_id'         => $clinic->id,
                'name'              => $googleUser->getName(),
                'email'             => $googleUser->getEmail(),
                'google_id'         => $googleUser->getId(),
                'avatar'            => $googleUser->getAvatar(),
                'email_verified_at' => now(),
                'status'            => 'active',
            ]);
        } elseif (!$user->google_id) {
            $user->update(['google_id' => $googleUser->getId()]);
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

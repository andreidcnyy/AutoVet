<?php

namespace App\Support;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Cloudflare Turnstile check for the public sign-up form.
 *
 * Off until TURNSTILE_SECRET_KEY is set, so local and offline setups keep
 * working without Cloudflare. Once it is set, a missing or failed token is
 * refused.
 */
class Turnstile
{
    private const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

    public static function enabled(): bool
    {
        return trim((string) config('services.turnstile.secret_key')) !== '';
    }

    public static function passes(?string $token, ?string $ip = null): bool
    {
        if (! self::enabled()) {
            return true;
        }

        if (! is_string($token) || $token === '') {
            return false;
        }

        try {
            $response = Http::asForm()->timeout(10)->post(self::VERIFY_URL, array_filter([
                'secret' => config('services.turnstile.secret_key'),
                'response' => $token,
                'remoteip' => $ip,
            ]));

            return $response->ok() && $response->json('success') === true;
        } catch (\Throwable $e) {
            Log::warning('Turnstile verification failed: '.$e->getMessage());

            return false;
        }
    }
}
